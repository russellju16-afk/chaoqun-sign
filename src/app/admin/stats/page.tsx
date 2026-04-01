"use client";

import { useEffect, useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DailyTrendItem {
  date: string;
  orders: number;
  signed: number;
  rejected: number;
  amount: string;
}

interface CustomerRankingItem {
  name: string;
  orders: number;
  amount: string;
}

interface DriverPerformanceItem {
  driverId: string;
  driverName: string;
  deliveries: number;
  signed: number;
  avgSignTimeHours: number | null;
}

interface SignModeItem {
  mode: string;
  count: number;
}

interface Overview {
  totalOrders: number;
  totalSigned: number;
  totalRejected: number;
  totalAmount: string;
  signingRate: number;
}

interface DetailedStats {
  dateFrom: string;
  dateTo: string;
  overview: Overview;
  dailyTrend: DailyTrendItem[];
  customerRanking: CustomerRankingItem[];
  driverPerformance: DriverPerformanceItem[];
  signModeDistribution: SignModeItem[];
  avgSignTimeHours: number | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(cents: string): string {
  const yuan = Number(BigInt(cents)) / 100;
  return `¥${yuan.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

const SIGN_MODE_LABELS: Record<string, string> = {
  DIGITAL: "电子签收",
  PAPER: "纸质签收",
  BOTH: "双轨签收",
  UNKNOWN: "未配置",
};

type DatePreset = "7d" | "30d" | "90d" | "custom";

function getPresetDates(preset: DatePreset): { from: string; to: string } {
  const to = new Date();
  const toStr = to.toISOString().slice(0, 10);
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString().slice(0, 10), to: toStr };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function OverviewCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${accent}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function BarChart({ data }: { data: DailyTrendItem[] }) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-400">暂无趋势数据</p>
    );
  }

  const maxOrders = Math.max(...data.map((d) => d.orders), 1);

  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.date} className="flex items-center gap-3 text-xs">
          <span className="w-20 shrink-0 text-gray-500">{formatDate(d.date)}</span>
          <div className="flex flex-1 gap-0.5">
            {/* Total bar */}
            <div
              className="h-5 rounded-sm bg-blue-200 transition-all"
              style={{ width: `${(d.orders / maxOrders) * 100}%` }}
              title={`总订单 ${d.orders}`}
            />
          </div>
          <div className="flex gap-3 w-32 shrink-0">
            <span className="text-blue-600 w-8 text-right">{d.orders}</span>
            <span className="text-green-600 w-8 text-right">✓{d.signed}</span>
            <span className="text-red-500 w-8 text-right">✗{d.rejected}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function PercentBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const [preset, setPreset] = useState<DatePreset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [stats, setStats] = useState<DetailedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { from: presetFrom, to: presetTo } =
    preset !== "custom" ? getPresetDates(preset) : { from: customFrom, to: customTo };

  const fetchStats = useCallback(async () => {
    const from = preset !== "custom" ? presetFrom : customFrom;
    const to = preset !== "custom" ? presetTo : customTo;
    if (!from || !to) return;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ dateFrom: from, dateTo: to });
      const res = await fetch(`/api/admin/stats/detailed?${params.toString()}`);
      if (!res.ok) throw new Error("加载失败");
      const data = (await res.json()) as DetailedStats;
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }, [preset, presetFrom, presetTo, customFrom, customTo]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const ov = stats?.overview;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">数据统计</h1>
        <p className="mt-1 text-sm text-gray-500">签收业务数据分析</p>
      </div>

      {/* Date range selector */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {(["7d", "30d", "90d", "custom"] as DatePreset[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPreset(p)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              preset === p
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
            }`}
          >
            {p === "7d" ? "近7天" : p === "30d" ? "近30天" : p === "90d" ? "近90天" : "自定义"}
          </button>
        ))}

        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <span className="text-gray-400">至</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              type="button"
              onClick={() => void fetchStats()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              查询
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
          数据加载失败：{error}
          <button
            type="button"
            onClick={() => void fetchStats()}
            className="ml-2 underline"
          >
            重试
          </button>
        </div>
      )}

      {/* Overview cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-200" />
            ))
          : ov && (
              <>
                <OverviewCard
                  label="总订单"
                  value={ov.totalOrders}
                  accent="text-blue-700"
                />
                <OverviewCard
                  label="已签收"
                  value={ov.totalSigned}
                  accent="text-green-700"
                />
                <OverviewCard
                  label="拒收"
                  value={ov.totalRejected}
                  accent="text-red-700"
                />
                <OverviewCard
                  label="总金额"
                  value={formatAmount(ov.totalAmount)}
                  accent="text-purple-700"
                />
                <OverviewCard
                  label="签收率"
                  value={`${ov.signingRate.toFixed(1)}%`}
                  sub="签收 / (签收 + 拒收)"
                  accent="text-orange-700"
                />
              </>
            )}
      </div>

      {stats && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Daily trend */}
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="mb-4 text-base font-semibold text-gray-900">
              每日趋势
            </h2>
            <div className="mb-2 flex gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-3 rounded-sm bg-blue-200" />
                总量
              </span>
              <span className="text-green-600">✓ 签收</span>
              <span className="text-red-500">✗ 拒收</span>
            </div>
            <BarChart data={stats.dailyTrend} />
          </div>

          {/* Sign mode distribution */}
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="mb-4 text-base font-semibold text-gray-900">
              签收方式分布
            </h2>
            {stats.signModeDistribution.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">暂无数据</p>
            ) : (
              <div className="space-y-4">
                {(() => {
                  const total = stats.signModeDistribution.reduce(
                    (s, m) => s + m.count,
                    0,
                  );
                  return stats.signModeDistribution.map((m) => (
                    <div key={m.mode}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-gray-700">
                          {SIGN_MODE_LABELS[m.mode] ?? m.mode}
                        </span>
                        <span className="tabular-nums text-gray-500">
                          {m.count} 单 (
                          {total > 0
                            ? Math.round((m.count / total) * 100)
                            : 0}
                          %)
                        </span>
                      </div>
                      <PercentBar
                        value={m.count}
                        max={total}
                        color={
                          m.mode === "DIGITAL"
                            ? "bg-blue-500"
                            : m.mode === "PAPER"
                              ? "bg-amber-500"
                              : m.mode === "BOTH"
                                ? "bg-purple-500"
                                : "bg-gray-400"
                        }
                      />
                    </div>
                  ));
                })()}
              </div>
            )}
            {stats.avgSignTimeHours !== null && (
              <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3">
                <p className="text-xs text-gray-500">平均签收时长</p>
                <p className="text-lg font-semibold text-gray-900">
                  {stats.avgSignTimeHours} 小时
                </p>
                <p className="text-xs text-gray-400">从已送达到完成签收</p>
              </div>
            )}
          </div>

          {/* Customer ranking */}
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="mb-4 text-base font-semibold text-gray-900">
              客户排行 TOP10
            </h2>
            {stats.customerRanking.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">暂无数据</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="pb-2 text-left text-xs font-medium text-gray-400">
                        #
                      </th>
                      <th className="pb-2 text-left text-xs font-medium text-gray-400">
                        客户名称
                      </th>
                      <th className="pb-2 text-right text-xs font-medium text-gray-400">
                        订单数
                      </th>
                      <th className="pb-2 text-right text-xs font-medium text-gray-400">
                        总金额
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {stats.customerRanking.map((c, i) => (
                      <tr key={c.name} className="hover:bg-gray-50">
                        <td className="py-2.5 text-sm text-gray-400">
                          {i + 1}
                        </td>
                        <td className="py-2.5 text-sm font-medium text-gray-900">
                          {c.name}
                        </td>
                        <td className="py-2.5 text-right text-sm tabular-nums text-gray-700">
                          {c.orders}
                        </td>
                        <td className="py-2.5 text-right text-sm tabular-nums text-gray-700">
                          {formatAmount(c.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Driver performance */}
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="mb-4 text-base font-semibold text-gray-900">
              司机绩效
            </h2>
            {stats.driverPerformance.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">暂无数据</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="pb-2 text-left text-xs font-medium text-gray-400">
                        司机
                      </th>
                      <th className="pb-2 text-right text-xs font-medium text-gray-400">
                        送货
                      </th>
                      <th className="pb-2 text-right text-xs font-medium text-gray-400">
                        签收
                      </th>
                      <th className="pb-2 text-right text-xs font-medium text-gray-400">
                        签收率
                      </th>
                      <th className="pb-2 text-right text-xs font-medium text-gray-400">
                        平均签收时长
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {stats.driverPerformance.map((d) => {
                      const rate =
                        d.deliveries > 0
                          ? Math.round((d.signed / d.deliveries) * 100)
                          : 0;
                      return (
                        <tr key={d.driverId} className="hover:bg-gray-50">
                          <td className="py-2.5 text-sm font-medium text-gray-900">
                            {d.driverName}
                          </td>
                          <td className="py-2.5 text-right text-sm tabular-nums text-gray-700">
                            {d.deliveries}
                          </td>
                          <td className="py-2.5 text-right text-sm tabular-nums text-gray-700">
                            {d.signed}
                          </td>
                          <td className="py-2.5 text-right text-sm tabular-nums">
                            <span
                              className={
                                rate >= 80
                                  ? "text-green-600"
                                  : rate >= 50
                                    ? "text-yellow-600"
                                    : "text-red-500"
                              }
                            >
                              {rate}%
                            </span>
                          </td>
                          <td className="py-2.5 text-right text-sm tabular-nums text-gray-500">
                            {d.avgSignTimeHours !== null
                              ? `${d.avgSignTimeHours}h`
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
