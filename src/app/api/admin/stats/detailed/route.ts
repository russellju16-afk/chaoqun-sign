import { NextRequest, NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/serialize";

const DEFAULT_DAYS = 30;
const MAX_CUSTOMER_RANKING = 10;

function parseDateRange(
  params: URLSearchParams,
): { dateFrom: Date; dateTo: Date } {
  const rawFrom = params.get("dateFrom");
  const rawTo = params.get("dateTo");

  const dateTo = rawTo ? new Date(rawTo) : new Date();
  dateTo.setHours(23, 59, 59, 999);

  const dateFrom = rawFrom
    ? new Date(rawFrom)
    : new Date(dateTo.getTime() - DEFAULT_DAYS * 24 * 60 * 60 * 1000);
  dateFrom.setHours(0, 0, 0, 0);

  return { dateFrom, dateTo };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { dateFrom, dateTo } = parseDateRange(request.nextUrl.searchParams);
  const whereRange = { deliveryDate: { gte: dateFrom, lte: dateTo } };

  // Parallel fetches
  const [overviewGroups, ordersInRange, signRecords, driverDeliveryCounts] =
    await Promise.all([
      prisma.deliveryOrder.groupBy({
        by: ["status"],
        where: whereRange,
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),

      prisma.deliveryOrder.findMany({
        where: whereRange,
        select: {
          id: true,
          status: true,
          deliveryDate: true,
          totalAmount: true,
          customerName: true,
          customerId: true,
          driverId: true,
          signRecord: { select: { signedAt: true } },
        },
        orderBy: { deliveryDate: "asc" },
      }),

      prisma.signRecord.findMany({
        where: { order: { deliveryDate: { gte: dateFrom, lte: dateTo } } },
        select: {
          signedAt: true,
          order: { select: { deliveryDate: true } },
        },
      }),

      prisma.deliveryOrder.groupBy({
        by: ["driverId"],
        where: { ...whereRange, driverId: { not: null } },
        _count: { _all: true },
      }),
    ]);

  // ── Overview ─────────────────────────────────────────────────────────────────
  type StatusAgg = { count: number; amount: bigint };
  const statusMap = new Map<OrderStatus, StatusAgg>();
  for (const g of overviewGroups) {
    statusMap.set(g.status, {
      count: g._count._all,
      amount: g._sum.totalAmount ?? 0n,
    });
  }

  const totalOrders = Array.from(statusMap.values()).reduce(
    (s, v) => s + v.count,
    0,
  );
  const totalSigned = statusMap.get(OrderStatus.SIGNED)?.count ?? 0;
  const totalRejected = statusMap.get(OrderStatus.REJECTED)?.count ?? 0;
  const totalAmount = Array.from(statusMap.values()).reduce(
    (s, v) => s + v.amount,
    0n,
  );
  const completedOrders = totalSigned + totalRejected;
  const signingRate =
    completedOrders > 0
      ? Math.round((totalSigned / completedOrders) * 1000) / 10
      : 0;

  const overview = {
    totalOrders,
    totalSigned,
    totalRejected,
    totalAmount: totalAmount.toString(),
    signingRate,
  };

  // ── Daily trend ──────────────────────────────────────────────────────────────
  type DayData = {
    date: string;
    orders: number;
    signed: number;
    rejected: number;
    amount: bigint;
  };

  const dayMap = new Map<string, DayData>();
  for (const order of ordersInRange) {
    const key = order.deliveryDate.toISOString().slice(0, 10);
    const prev = dayMap.get(key) ?? {
      date: key,
      orders: 0,
      signed: 0,
      rejected: 0,
      amount: 0n,
    };
    dayMap.set(key, {
      ...prev,
      orders: prev.orders + 1,
      signed: prev.signed + (order.status === OrderStatus.SIGNED ? 1 : 0),
      rejected:
        prev.rejected + (order.status === OrderStatus.REJECTED ? 1 : 0),
      amount: prev.amount + order.totalAmount,
    });
  }

  const dailyTrend = Array.from(dayMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ ...d, amount: d.amount.toString() }));

  // ── Customer ranking ──────────────────────────────────────────────────────────
  type CustomerAgg = { name: string; orders: number; amount: bigint };
  const customerMap = new Map<string, CustomerAgg>();
  for (const order of ordersInRange) {
    const prev = customerMap.get(order.customerName) ?? {
      name: order.customerName,
      orders: 0,
      amount: 0n,
    };
    customerMap.set(order.customerName, {
      ...prev,
      orders: prev.orders + 1,
      amount: prev.amount + order.totalAmount,
    });
  }

  const customerRanking = Array.from(customerMap.values())
    .sort((a, b) => b.orders - a.orders || Number(b.amount - a.amount))
    .slice(0, MAX_CUSTOMER_RANKING)
    .map((c) => ({ ...c, amount: c.amount.toString() }));

  // ── Driver performance ────────────────────────────────────────────────────────
  const driverIds = driverDeliveryCounts
    .map((g) => g.driverId)
    .filter((id): id is string => id !== null);

  const drivers = await prisma.driver.findMany({
    where: { id: { in: driverIds } },
    select: { id: true, name: true },
  });
  const driverNameMap = new Map(drivers.map((d) => [d.id, d.name]));

  type DriverPerf = {
    driverId: string;
    driverName: string;
    deliveries: number;
    signed: number;
    totalSignMs: number;
  };
  const driverPerfMap = new Map<string, DriverPerf>();
  for (const g of driverDeliveryCounts) {
    if (g.driverId === null) continue;
    driverPerfMap.set(g.driverId, {
      driverId: g.driverId,
      driverName: driverNameMap.get(g.driverId) ?? "未知",
      deliveries: g._count._all,
      signed: 0,
      totalSignMs: 0,
    });
  }

  for (const order of ordersInRange) {
    if (
      order.status !== OrderStatus.SIGNED ||
      !order.driverId ||
      !order.signRecord
    )
      continue;
    const perf = driverPerfMap.get(order.driverId);
    if (!perf) continue;
    const signMs = Math.max(
      0,
      order.signRecord.signedAt.getTime() - order.deliveryDate.getTime(),
    );
    driverPerfMap.set(order.driverId, {
      ...perf,
      signed: perf.signed + 1,
      totalSignMs: perf.totalSignMs + signMs,
    });
  }

  const driverPerformance = Array.from(driverPerfMap.values())
    .sort((a, b) => b.deliveries - a.deliveries)
    .map(({ driverId, driverName, deliveries, signed, totalSignMs }) => ({
      driverId,
      driverName,
      deliveries,
      signed,
      avgSignTimeHours:
        signed > 0
          ? Math.round((totalSignMs / signed / 3_600_000) * 10) / 10
          : null,
    }));

  // ── Sign mode distribution ────────────────────────────────────────────────────
  const uniqueCustomerIds = Array.from(
    new Set(
      ordersInRange
        .map((o) => o.customerId)
        .filter((id): id is string => id !== null),
    ),
  );

  const customerConfigs = await prisma.customerConfig.findMany({
    where: { id: { in: uniqueCustomerIds } },
    select: { id: true, signMode: true },
  });
  const signModeConfigMap = new Map(
    customerConfigs.map((c) => [c.id, c.signMode]),
  );

  const signModeCount: Record<string, number> = {};
  for (const order of ordersInRange) {
    const mode =
      order.customerId !== null
        ? (signModeConfigMap.get(order.customerId) ?? "UNKNOWN")
        : "UNKNOWN";
    signModeCount[mode] = (signModeCount[mode] ?? 0) + 1;
  }

  const signModeDistribution = Object.entries(signModeCount)
    .filter(([, count]) => count > 0)
    .map(([mode, count]) => ({ mode, count }))
    .sort((a, b) => b.count - a.count);

  // ── Global avg sign time ─────────────────────────────────────────────────────
  const signTimesMs = signRecords
    .map((r) => r.signedAt.getTime() - r.order.deliveryDate.getTime())
    .filter((ms) => ms > 0);

  const avgSignTimeHours =
    signTimesMs.length > 0
      ? Math.round(
          (signTimesMs.reduce((s, ms) => s + ms, 0) /
            signTimesMs.length /
            3_600_000) *
            10,
        ) / 10
      : null;

  return NextResponse.json(
    serializeBigInt({
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo.toISOString(),
      overview,
      dailyTrend,
      customerRanking,
      driverPerformance,
      signModeDistribution,
      avgSignTimeHours,
    }),
  );
}
