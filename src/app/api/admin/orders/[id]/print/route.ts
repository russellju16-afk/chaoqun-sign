import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { enqueuePrintJob } from "@/lib/print/queue";
import { serializeBigInt } from "@/lib/serialize";
import { badRequest, notFound, serverError } from "@/lib/errors";
import type { PrintFormat } from "@/lib/print/types";
import { requireRole } from "@/lib/role-guard";

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
  // 写操作仅允许 ADMIN 角色
  const roleError = await requireRole(request, ["ADMIN"]);
  if (roleError) return roleError;

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

  // 先创建 DB 记录，再入队；入队失败时将记录标记为 FAILED（补偿模式），
  // 避免留下状态永远为 QUEUED 却永远不会被处理的孤儿记录。
  let printJob: Awaited<ReturnType<typeof prisma.printJob.create>> | undefined;
  try {
    printJob = await prisma.printJob.create({
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

    // 如果 DB 记录已创建但入队失败，将其标记为 FAILED 避免成为孤儿记录
    if (printJob !== undefined) {
      await prisma.printJob
        .update({
          where: { id: printJob.id },
          data: { status: "FAILED", error: "入队失败: " + String(err) },
        })
        .catch((updateErr: unknown) => {
          console.error(
            "[print route] failed to mark print job as FAILED:",
            updateErr,
          );
        });
    }

    return serverError("打印任务创建失败，请稍后重试");
  }
}
