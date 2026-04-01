import { NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

interface StatsResponse {
  byStatus: Record<OrderStatus, number>;
  todayOrders: number;
  todaySigned: number;
  signingRate: number;
}

export async function GET(): Promise<NextResponse> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [statusGroups, todayOrders, todaySigned] = await Promise.all([
    prisma.deliveryOrder.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.deliveryOrder.count({
      where: {
        deliveryDate: { gte: todayStart, lte: todayEnd },
      },
    }),
    prisma.deliveryOrder.count({
      where: {
        status: OrderStatus.SIGNED,
        deliveryDate: { gte: todayStart, lte: todayEnd },
      },
    }),
  ]);

  // Build a zero-initialised map for all statuses
  const allStatuses = Object.values(OrderStatus) as OrderStatus[];
  const byStatus = allStatuses.reduce<Record<OrderStatus, number>>(
    (acc, s) => ({ ...acc, [s]: 0 }),
    {} as Record<OrderStatus, number>,
  );

  for (const group of statusGroups) {
    byStatus[group.status] = group._count._all;
  }

  const signingRate =
    todayOrders > 0
      ? Math.round((todaySigned / todayOrders) * 100 * 10) / 10
      : 0;

  const stats: StatsResponse = {
    byStatus,
    todayOrders,
    todaySigned,
    signingRate,
  };

  return NextResponse.json(stats);
}
