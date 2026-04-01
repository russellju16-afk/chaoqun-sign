import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifySignToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { badRequest, notFound } from "@/lib/errors";
import { notifyOrderRejected } from "@/lib/lark";

interface RouteContext {
  params: Promise<{ token: string }>;
}

const RejectSchema = z.object({
  reason: z.string().min(1, "拒收原因不能为空").max(500),
});

/**
 * POST /api/sign/[token]/reject
 *
 * Record a delivery rejection:
 *  - Verifies sign token
 *  - Validates { reason } body
 *  - Transitions order status → REJECTED, storing the reason in remark
 *
 * Errors:
 *   400 — invalid/expired token or bad body
 *   404 — order not found
 *   409 — order already in a terminal state (SIGNED / REJECTED / CANCELLED)
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { token } = await context.params;

  if (!token) {
    return badRequest("缺少签收凭证");
  }

  const payload = verifySignToken(token);
  if (!payload) {
    return badRequest("签收链接无效或已过期");
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return badRequest("请求体格式错误");
  }

  const parsed = RejectSchema.safeParse(raw);
  if (!parsed.success) {
    return badRequest(parsed.error.errors.map((e) => e.message).join("; "));
  }

  const { reason } = parsed.data;

  const order = await prisma.deliveryOrder.findFirst({
    where: {
      id: payload.orderId,
      signToken: token,
    },
  });

  if (!order) {
    return notFound("送货单不存在");
  }

  if (order.status === "SIGNED") {
    return NextResponse.json(
      { error: "ALREADY_SIGNED", message: "该送货单已完成签收，无法拒收" },
      { status: 409 },
    );
  }

  if (order.status === "REJECTED") {
    return NextResponse.json(
      { error: "ALREADY_REJECTED", message: "该送货单已被拒收" },
      { status: 409 },
    );
  }

  if (order.status === "CANCELLED") {
    return NextResponse.json(
      { error: "CANCELLED", message: "该送货单已取消" },
      { status: 409 },
    );
  }

  // Store rejection reason in the SignRecord remark via a partial sign record,
  // or simply log it. Since REJECTED orders have no SignRecord, we store the
  // reason on an audit log entry. For simplicity we create a minimal SignRecord
  // with a placeholder signatureUrl so the DB constraint is satisfied, and mark
  // the reason in the remark field.
  //
  // Alternatively, if the schema gains a `rejectReason` field on DeliveryOrder,
  // the update below is the only write needed.

  await prisma.$transaction(async (tx) => {
    // 同时更新状态和拒收原因，避免需要额外查询 SignRecord
    await tx.deliveryOrder.update({
      where: { id: order.id },
      data: { status: "REJECTED", rejectReason: reason },
    });

    // 同时写入审计日志，便于后台追溯
    await tx.auditLog.create({
      data: {
        action: "order.rejected",
        target: `delivery_order:${order.id}`,
        detail: JSON.stringify({ reason, orderNo: order.orderNo }),
        ipAddress:
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          request.headers.get("x-real-ip") ??
          undefined,
      },
    });
  });

  // Fire-and-forget 飞书通知
  void notifyOrderRejected({
    orderId: order.id,
    orderNo: order.orderNo,
    customerName: order.customerName,
    reason,
  });

  return NextResponse.json({
    success: true,
    orderId: order.id,
    orderNo: order.orderNo,
    status: "REJECTED",
    reason,
  });
}
