import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { enqueuePrintJob } from "@/lib/print/queue";
import { serializeBigInt } from "@/lib/serialize";
import { badRequest, serverError } from "@/lib/errors";
import type { PrintFormat } from "@/lib/print/types";

const MAX_BATCH = 50;

const batchPrintSchema = z.object({
  orderIds: z
    .array(z.string().cuid())
    .min(1, "至少选择一个订单")
    .max(MAX_BATCH, `最多批量打印 ${MAX_BATCH} 张`),
  copies: z.number().int().min(1).max(10).optional().default(1),
  printerName: z.string().min(1).optional().default("default"),
  format: z.enum(["a4", "receipt", "dot-matrix"]).optional().default("a4"),
});

/**
 * POST /api/admin/batch/print
 *
 * Body: { orderIds: string[], copies?: number, printerName?: string, format?: string }
 *
 * Creates a PrintJob record and enqueues it to BullMQ for each order.
 * Returns { created: number, jobs: [...] }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("请求体不是合法的 JSON");
  }

  const parsed = batchPrintSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const { orderIds, copies, printerName, format } = parsed.data;

  // Validate all order IDs exist
  const foundOrders = await prisma.deliveryOrder.findMany({
    where: { id: { in: orderIds } },
    select: { id: true, orderNo: true },
  });

  if (foundOrders.length !== orderIds.length) {
    const foundIds = new Set(foundOrders.map((o) => o.id));
    const missing = orderIds.filter((id) => !foundIds.has(id));
    return badRequest(`以下订单 ID 不存在：${missing.join(", ")}`);
  }

  try {
    // Create all PrintJob records in a transaction, then enqueue
    const printJobs = await prisma.$transaction(
      foundOrders.map((order) =>
        prisma.printJob.create({
          data: {
            orderId: order.id,
            printerName,
            copies,
            status: "QUEUED",
          },
        }),
      ),
    );

    // Enqueue after DB records are committed
    await Promise.all(
      printJobs.map((job) =>
        enqueuePrintJob({
          printJobId: job.id,
          orderId: job.orderId,
          printerName,
          copies,
          format: format as PrintFormat,
        }),
      ),
    );

    return NextResponse.json(
      serializeBigInt({
        created: printJobs.length,
        jobs: printJobs,
      }),
      { status: 201 },
    );
  } catch (err: unknown) {
    console.error("[batch/print] 批量打印任务创建失败:", err);
    return serverError("批量打印任务创建失败，请稍后重试");
  }
}
