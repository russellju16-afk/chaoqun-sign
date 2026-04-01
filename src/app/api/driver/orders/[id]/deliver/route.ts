import { NextRequest, NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/serialize";
import { unauthorized, forbidden, notFound, badRequest } from "@/lib/errors";
import { validateDriverSession } from "@/lib/driver-session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const session = await validateDriverSession();
  if (!session) {
    return unauthorized();
  }

  const { id } = await params;

  const order = await prisma.deliveryOrder.findUnique({
    where: { id },
    select: {
      id: true,
      driverId: true,
      status: true,
      orderNo: true,
    },
  });

  if (order === null) {
    return notFound("送货单不存在");
  }

  if (order.driverId !== session.driverId) {
    return forbidden("无权操作此送货单");
  }

  if (order.status !== OrderStatus.PENDING) {
    return badRequest(
      `当前状态为 ${order.status}，只有待送货 (PENDING) 的订单才能标记为已送达`,
    );
  }

  const updated = await prisma.deliveryOrder.update({
    where: { id },
    data: { status: OrderStatus.DELIVERED },
    include: {
      customer: {
        select: {
          id: true,
          customerName: true,
          signMode: true,
        },
      },
      _count: {
        select: { items: true },
      },
    },
  });

  // 审计日志：记录状态变更（fire-and-forget，不阻塞响应）
  void prisma.auditLog.create({
    data: {
      userId: null, // 司机无 AdminUser，userId 为 null
      action: "order.deliver",
      target: `delivery_order:${id}`,
      detail: JSON.stringify({
        driverId: session.driverId,
        driverName: session.driverName,
        orderNo: order.orderNo,
        fromStatus: OrderStatus.PENDING,
        toStatus: OrderStatus.DELIVERED,
      }),
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown",
    },
  });

  return NextResponse.json(serializeBigInt(updated));
}
