import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { enqueuePrintJob } from "@/lib/print/queue";
import { serializeBigInt } from "@/lib/serialize";
import { badRequest, notFound, serverError } from "@/lib/errors";
import type { PrintFormat } from "@/lib/print/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const printRequestSchema = z.object({
  copies: z.number().int().min(1).max(10).optional().default(1),
  printerName: z.string().min(1).optional().default("default"),
  format: z.enum(["a4", "receipt", "dot-matrix"]).optional().default("a4"),
});

/**
 * POST /api/admin/orders/:id/print
 *
 * Creates a PrintJob record and enqueues it to BullMQ.
 * Body (all optional):
 *   { copies?: number, printerName?: string, format?: "a4" | "receipt" | "dot-matrix" }
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const { id } = await params;

  // Parse + validate body (empty body is fine — all fields have defaults)
  let body: Record<string, unknown> = {};
  try {
    const text = await request.text();
    if (text.length > 0) {
      body = JSON.parse(text) as Record<string, unknown>;
    }
  } catch {
    return badRequest("请求体不是合法的 JSON");
  }

  const parsed = printRequestSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const { copies, printerName, format } = parsed.data;

  // Verify the order exists
  const order = await prisma.deliveryOrder.findUnique({
    where: { id },
    select: { id: true, orderNo: true },
  });

  if (order === null) {
    return notFound("送货单不存在");
  }

  // Create a PrintJob record, then enqueue — keep these in the same try block
  // so a queue failure does not leave a dangling QUEUED record unprocessed
  try {
    const printJob = await prisma.printJob.create({
      data: {
        orderId: id,
        printerName,
        copies,
        status: "QUEUED",
      },
    });

    await enqueuePrintJob({
      printJobId: printJob.id,
      orderId: id,
      printerName,
      copies,
      format: format as PrintFormat,
    });

    return NextResponse.json(serializeBigInt(printJob), { status: 201 });
  } catch (err: unknown) {
    console.error("[print route] failed to create/enqueue print job:", err);
    return serverError("打印任务创建失败，请稍后重试");
  }
}
