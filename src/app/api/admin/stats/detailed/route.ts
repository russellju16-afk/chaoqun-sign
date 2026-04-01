import { NextRequest, NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/serialize";

const DEFAULT_DAYS = 30;
const MAX_CUSTOMER_RANKING = 10;

function parseDateRange(params: URLSearchParams): {
  dateFrom: Date;
  dateTo: Date;
} {
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

  // ── 并行数据库查询（全部在数据库层聚合，避免全量加载） ──────────────────────────
  const [
    overviewGroups,
    dailyGroups,
    dailySignedGroups,
    dailyRejectedGroups,
    customerGroups,
    driverDeliveryCounts,
    driverSignedCounts,
    signedOrdersForTime,
    signRecords,
    signModeOrders,
  ] = await Promise.all([
    // 概览：按状态分组
    prisma.deliveryOrder.groupBy({
      by: ["status"],
      where: whereRange,
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),

    // 日趋势：按日期分组，统计总订单数和金额（一次查询同时获取）
    prisma.deliveryOrder.groupBy({
      by: ["deliveryDate"],
      where: whereRange,
      _count: { _all: true },
      _sum: { totalAmount: true },
      orderBy: { deliveryDate: "asc" },
    }),

    // 日趋势：按日期分组，统计已签收数
    prisma.deliveryOrder.groupBy({
      by: ["deliveryDate"],
      where: { ...whereRange, status: OrderStatus.SIGNED },
      _count: { _all: true },
      orderBy: { deliveryDate: "asc" },
    }),

    // 日趋势：按日期分组，统计已拒收数
    prisma.deliveryOrder.groupBy({
      by: ["deliveryDate"],
      where: { ...whereRange, status: OrderStatus.REJECTED },
      _count: { _all: true },
      orderBy: { deliveryDate: "asc" },
    }),

    // 客户排名：按 customerId 分组（取前 10）
    prisma.deliveryOrder.groupBy({
      by: ["customerId", "customerName"],
      where: whereRange,
      _count: { _all: true },
      _sum: { totalAmount: true },
      orderBy: [{ _count: { id: "desc" } }, { _sum: { totalAmount: "desc" } }],
      take: MAX_CUSTOMER_RANKING,
    }),

    // 司机绩效：按司机分组，统计总配送数
    prisma.deliveryOrder.groupBy({
      by: ["driverId"],
      where: { ...whereRange, driverId: { not: null } },
      _count: { _all: true },
    }),

    // 司机绩效：按司机分组，统计已签收数
    prisma.deliveryOrder.groupBy({
      by: ["driverId"],
      where: {
        ...whereRange,
        driverId: { not: null },
        status: OrderStatus.SIGNED,
      },
      _count: { _all: true },
    }),

    // 司机绩效：仅查 SIGNED 订单的 deliveryDate + signRecord.signedAt，用于计算平均签收时长
    prisma.deliveryOrder.findMany({
      where: {
        ...whereRange,
        status: OrderStatus.SIGNED,
        driverId: { not: null },
        signRecord: { isNot: null },
      },
      select: {
        driverId: true,
        deliveryDate: true,
        signRecord: { select: { signedAt: true } },
      },
    }),

    // 全局平均签收时间：仅查 signRecord（不全量加载 orders）
    prisma.signRecord.findMany({
      where: { order: { deliveryDate: { gte: dateFrom, lte: dateTo } } },
      select: {
        signedAt: true,
        order: { select: { deliveryDate: true } },
      },
    }),

    // 签收模式分布：仅查 customerId，不加载其他字段
    prisma.deliveryOrder.groupBy({
      by: ["customerId"],
      where: whereRange,
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

  // ── Daily trend（数据库 groupBy 结果合并） ────────────────────────────────────
  // 以 dailyGroups 为主，合并 signed/rejected 子计数
  const signedByDay = new Map<string, number>();
  for (const g of dailySignedGroups) {
    signedByDay.set(g.deliveryDate.toISOString().slice(0, 10), g._count._all);
  }
  const rejectedByDay = new Map<string, number>();
  for (const g of dailyRejectedGroups) {
    rejectedByDay.set(g.deliveryDate.toISOString().slice(0, 10), g._count._all);
  }

  const dailyTrend = dailyGroups.map((g) => {
    const key = g.deliveryDate.toISOString().slice(0, 10);
    return {
      date: key,
      orders: g._count._all,
      signed: signedByDay.get(key) ?? 0,
      rejected: rejectedByDay.get(key) ?? 0,
      amount: (g._sum.totalAmount ?? 0n).toString(),
    };
  });

  // ── Customer ranking（数据库 groupBy 结果直接使用） ───────────────────────────
  // Prisma groupBy 不直接支持 customerName 字段聚合展示（需要和 customerId 一起），
  // 结果已按 _count desc 排序，直接映射
  const customerRanking = customerGroups.map((g) => ({
    name: g.customerName,
    orders: g._count._all,
    amount: (g._sum.totalAmount ?? 0n).toString(),
  }));

  // ── Driver performance ────────────────────────────────────────────────────────
  const driverIds = driverDeliveryCounts
    .map((g) => g.driverId)
    .filter((id): id is string => id !== null);

  const drivers = await prisma.driver.findMany({
    where: { id: { in: driverIds } },
    select: { id: true, name: true },
  });
  const driverNameMap = new Map(drivers.map((d) => [d.id, d.name]));

  // 已签收数量按司机汇总（来自数据库 groupBy）
  const driverSignedMap = new Map<string, number>();
  for (const g of driverSignedCounts) {
    if (g.driverId !== null) {
      driverSignedMap.set(g.driverId, g._count._all);
    }
  }

  // 平均签收时长按司机汇总（仅 SIGNED 订单，有 signRecord 的子集）
  type SignTimeAgg = { totalMs: number; count: number };
  const driverSignTimeMap = new Map<string, SignTimeAgg>();
  for (const order of signedOrdersForTime) {
    if (!order.driverId || !order.signRecord) continue;
    const ms = Math.max(
      0,
      order.signRecord.signedAt.getTime() - order.deliveryDate.getTime(),
    );
    const prev = driverSignTimeMap.get(order.driverId) ?? {
      totalMs: 0,
      count: 0,
    };
    driverSignTimeMap.set(order.driverId, {
      totalMs: prev.totalMs + ms,
      count: prev.count + 1,
    });
  }

  const driverPerformance = driverDeliveryCounts
    .filter((g): g is typeof g & { driverId: string } => g.driverId !== null)
    .map((g) => {
      const signed = driverSignedMap.get(g.driverId) ?? 0;
      const signTime = driverSignTimeMap.get(g.driverId);
      return {
        driverId: g.driverId,
        driverName: driverNameMap.get(g.driverId) ?? "未知",
        deliveries: g._count._all,
        signed,
        avgSignTimeHours:
          signTime && signTime.count > 0
            ? Math.round((signTime.totalMs / signTime.count / 3_600_000) * 10) /
              10
            : null,
      };
    })
    .sort((a, b) => b.deliveries - a.deliveries);

  // ── Sign mode distribution（数据库 groupBy，再关联 customerConfig） ────────────
  const customerIds = signModeOrders
    .map((g) => g.customerId)
    .filter((id): id is string => id !== null);

  const uniqueCustomerIds = Array.from(new Set(customerIds));
  const customerConfigs = await prisma.customerConfig.findMany({
    where: { id: { in: uniqueCustomerIds } },
    select: { id: true, signMode: true },
  });
  const signModeConfigMap = new Map(
    customerConfigs.map((c) => [c.id, c.signMode]),
  );

  const signModeCount: Record<string, number> = {};
  for (const g of signModeOrders) {
    const mode =
      g.customerId !== null
        ? (signModeConfigMap.get(g.customerId) ?? "UNKNOWN")
        : "UNKNOWN";
    signModeCount[mode] = (signModeCount[mode] ?? 0) + g._count._all;
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
