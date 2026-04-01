"use client";

import { useState, useEffect } from "react";

interface DriverStats {
  totalOrders: number;
  pending: number;
  delivered: number;
  signed: number;
  rejected: number;
}

interface StatCardProps {
  label: string;
  value: number;
  bgColor: string;
  textColor: string;
  valueColor: string;
  icon: React.ReactNode;
}

function StatCard({
  label,
  value,
  bgColor,
  textColor,
  valueColor,
  icon,
}: StatCardProps) {
  return (
    <div className={`flex flex-col gap-3 rounded-xl p-4 ${bgColor}`}>
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium ${textColor}`}>{label}</span>
        <span className={`${textColor} opacity-70`}>{icon}</span>
      </div>
      <div className={`text-3xl font-bold ${valueColor}`}>{value}</div>
    </div>
  );
}

export default function DriverStatsPage() {
  const [stats, setStats] = useState<DriverStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/driver/stats")
      .then((res) => {
        if (!res.ok) throw new Error("加载失败");
        return res.json() as Promise<DriverStats>;
      })
      .then((data) => setStats(data))
      .catch(() => setError("加载统计失败"))
      .finally(() => setLoading(false));
  }, []);

  const signedRate =
    stats && stats.totalOrders > 0
      ? Math.round((stats.signed / stats.totalOrders) * 100)
      : 0;

  return (
    <div className="px-4 py-4">
      <h2 className="mb-4 text-base font-semibold text-gray-900">今日统计</h2>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-200" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl bg-red-50 px-4 py-8 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700"
          >
            重新加载
          </button>
        </div>
      ) : stats ? (
        <div className="space-y-4">
          {/* Main stat - full width */}
          <div className="rounded-xl bg-blue-600 p-5 text-white shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-200">今日总单数</p>
                <p className="mt-1 text-4xl font-bold">{stats.totalOrders}</p>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
                <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Grid of status stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="待送货"
              value={stats.pending}
              bgColor="bg-yellow-50"
              textColor="text-yellow-700"
              valueColor="text-yellow-800"
              icon={
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatCard
              label="已送达"
              value={stats.delivered}
              bgColor="bg-blue-50"
              textColor="text-blue-700"
              valueColor="text-blue-800"
              icon={
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              }
            />
            <StatCard
              label="已签收"
              value={stats.signed}
              bgColor="bg-green-50"
              textColor="text-green-700"
              valueColor="text-green-800"
              icon={
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatCard
              label="拒收"
              value={stats.rejected}
              bgColor="bg-red-50"
              textColor="text-red-700"
              valueColor="text-red-800"
              icon={
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          </div>

          {/* Daily progress bar */}
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">签收完成率</span>
              <span className="text-sm font-bold text-green-700">{signedRate}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500"
                style={{ width: `${signedRate}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-gray-400">
              <span>0</span>
              <span>{stats.signed} / {stats.totalOrders} 单已签收</span>
            </div>
          </div>

          {/* Pending reminder */}
          {stats.pending > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">
              <svg className="h-5 w-5 flex-shrink-0 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-yellow-800">
                还有 <strong>{stats.pending}</strong> 单待送货，加油！
              </p>
            </div>
          )}

          {stats.pending === 0 && stats.totalOrders > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
              <svg className="h-5 w-5 flex-shrink-0 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-green-800">今日送货任务全部完成，辛苦了！</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
