import { NextRequest, NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { unauthorized } from "@/lib/errors";
import { getDriverSession } from "@/lib/driver-session";

interface DriverStatsResponse {
  readonly totalOrders: number;
  readonly pending: number;
  readonly delivered: number;
  readonly signed: number;
  readonly rejected: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getDriverSession();
  if (!session.driverId) {
    return unauthorized();
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const baseWhere = {
    driverId: session.driverId,
    deliveryDate: { gte: todayStart, lte: todayEnd },
  };

  const [totalOrders, pending, delivered, signed, rejected] = await Promise.all(
    [
      prisma.deliveryOrder.count({ where: baseWhere }),
      prisma.deliveryOrder.count({
        where: { ...baseWhere, status: OrderStatus.PENDING },
      }),
      prisma.deliveryOrder.count({
        where: { ...baseWhere, status: OrderStatus.DELIVERED },
      }),
      prisma.deliveryOrder.count({
        where: { ...baseWhere, status: OrderStatus.SIGNED },
      }),
      prisma.deliveryOrder.count({
        where: { ...baseWhere, status: OrderStatus.REJECTED },
      }),
    ],
  );

  const stats: DriverStatsResponse = {
    totalOrders,
    pending,
    delivered,
    signed,
    rejected,
  };

  return NextResponse.json(stats);
}
