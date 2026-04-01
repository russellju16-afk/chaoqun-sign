import { NextRequest, NextResponse } from "next/server";
import { verifySignToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { badRequest, notFound, unauthorized } from "@/lib/errors";
import { serializeBigInt } from "@/lib/serialize";

interface RouteContext {
  params: Promise<{ token: string }>;
}

/**
 * GET /api/sign/[token]
 *
 * Verify the sign token and return the order info needed to render the
 * signing page (customer name, order number, delivery date, line items,
 * total amount).  Monetary amounts are serialized as strings (分).
 *
 * Errors:
 *   400 — token missing or malformed / expired
 *   404 — no order matches the token's orderId or the stored signToken
 *   409 — order has already been signed or rejected
 */
export async function GET(
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

  const order = await prisma.deliveryOrder.findFirst({
    where: {
      id: payload.orderId,
      signToken: token,
    },
    include: {
      items: {
        orderBy: { id: "asc" },
      },
    },
  });

  if (!order) {
    return notFound("送货单不存在");
  }

  if (order.status === "SIGNED") {
    return NextResponse.json(
      { error: "ALREADY_SIGNED", message: "该送货单已完成签收" },
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

  const responseData = {
    id: order.id,
    orderNo: order.orderNo,
    customerName: order.customerName,
    customerAddress: order.customerAddress,
    deliveryDate: order.deliveryDate.toISOString(),
    status: order.status,
    totalAmount: order.totalAmount.toString(), // 分
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      spec: item.spec,
      unit: item.unit,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(), // 分
      amount: item.amount.toString(), // 分
      remark: item.remark,
    })),
  };

  return NextResponse.json(serializeBigInt(responseData));
}
