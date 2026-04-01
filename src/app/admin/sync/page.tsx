"use client";

import { useEffect, useState, useCallback } from "react";

type SyncStatus = "SUCCESS" | "FAILED" | "PARTIAL" | "RUNNING";

interface SyncRecord {
  id: string;
  triggeredAt: string; // ISO datetime
  completedAt: string | null; // ISO datetime
  triggeredBy: string;
  status: SyncStatus;
  syncedCount: number;
  failedCount: number;
  note: string | null;
}

interface SyncHistoryResponse {
  records: SyncRecord[];
  lastSyncAt: string | null;
}

const SYNC_STATUS_CONFIG: Record<SyncStatus, { label: string; className: string }> = {
  SUCCESS: {
    label: "成功",
    className: "bg-green-100 text-green-800 border border-green-200",
  },
  FAILED: {
    label: "失败",
    className: "bg-red-100 text-red-800 border border-red-200",
  },
  PARTIAL: {
    label: "部分成功",
    className: "bg-yellow-100 text-yellow-800 border border-yellow-200",
  },
  RUNNING: {
    label: "同步中",
    className: "bg-blue-100 text-blue-800 border border-blue-200",
  },
};

function SyncStatusBadge({ status }: { status: SyncStatus }) {
  const config = SYNC_STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {status === "RUNNING" && (
        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
      )}
      {config.label}
    </span>
  );
}

function formatDatetime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

export default function SyncPage() {
  const [records, setRecords] = useState<SyncRecord[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Sync recent orders
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // Single order sync
  const [singleOrderNo, setSingleOrderNo] = useState("");
  const [singleSyncing, setSingleSyncing] = useState(false);
  const [singleResult, setSingleResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      // TODO: replace with real sync history endpoint when available
      const res = await fetch("/api/admin/sync/history");
      if (!res.ok) throw new Error("加载失败");
      const data = (await res.json()) as SyncHistoryResponse;
      setRecords(data.records);
      setLastSyncAt(data.lastSyncAt);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  async function handleSyncRecent() {
    setSyncing(true);
    setSyncResult(null);
    try {
      // TODO: replace with real sync endpoint
      const res = await fetch("/api/admin/sync/recent", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "同步失败");
      }
      const body = (await res.json()) as { message?: string; syncedCount?: number };
      setSyncResult({
        ok: true,
        message: body.message ?? `同步完成，共处理 ${body.syncedCount ?? 0} 条订单`,
      });
      void fetchHistory();
    } catch (err) {
      setSyncResult({
        ok: false,
        message: err instanceof Error ? err.message : "同步失败",
      });
    } finally {
      setSyncing(false);
    }
  }

  async function handleSyncSingle() {
    const trimmed = singleOrderNo.trim();
    if (!trimmed) return;
    setSingleSyncing(true);
    setSingleResult(null);
    try {
      // TODO: replace with real single-order sync endpoint
      const res = await fetch("/api/admin/sync/single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kingdeeOrderNo: trimmed }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "同步失败");
      }
      const body = (await res.json()) as { message?: string };
      setSingleResult({
        ok: true,
        message: body.message ?? `单据 ${trimmed} 同步成功`,
      });
      setSingleOrderNo("");
      void fetchHistory();
    } catch (err) {
      setSingleResult({
        ok: false,
        message: err instanceof Error ? err.message : "同步失败",
      });
    } finally {
      setSingleSyncing(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">金蝶同步</h1>
        <p className="mt-1 text-sm text-gray-500">
          {lastSyncAt ? (
            <>
              上次同步：
              <span className="font-medium text-gray-700">
                {formatDatetime(lastSyncAt)}
              </span>
              <span className="ml-2 text-gray-400">({formatRelative(lastSyncAt)})</span>
            </>
          ) : (
            "尚未同步"
          )}
        </p>
      </div>

      {/* Sync recent orders */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <h2 className="mb-1 text-base font-semibold text-gray-900">同步最近订单</h2>
        <p className="mb-4 text-sm text-gray-500">
          从金蝶拉取最近的出库单并同步到签收系统
        </p>

        <button
          type="button"
          onClick={() => void handleSyncRecent()}
          disabled={syncing}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {syncing ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
              同步中...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              同步最近订单
            </>
          )}
        </button>

        {syncResult && (
          <div
            className={`mt-4 rounded-lg px-4 py-3 text-sm ${
              syncResult.ok
                ? "bg-green-50 text-green-700 ring-1 ring-green-200"
                : "bg-red-50 text-red-700 ring-1 ring-red-200"
            }`}
          >
            {syncResult.message}
          </div>
        )}
      </div>

      {/* Single order sync */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <h2 className="mb-1 text-base font-semibold text-gray-900">指定单号同步</h2>
        <p className="mb-4 text-sm text-gray-500">输入金蝶出库单号，手动同步单条记录</p>

        <div className="flex gap-3">
          <input
            type="text"
            value={singleOrderNo}
            onChange={(e) => setSingleOrderNo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSyncSingle();
            }}
            placeholder="输入金蝶单号，如 CKCK240001"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <button
            type="button"
            onClick={() => void handleSyncSingle()}
            disabled={singleSyncing || !singleOrderNo.trim()}
            className="rounded-lg bg-gray-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {singleSyncing ? "同步中..." : "同步"}
          </button>
        </div>

        {singleResult && (
          <div
            className={`mt-4 rounded-lg px-4 py-3 text-sm ${
              singleResult.ok
                ? "bg-green-50 text-green-700 ring-1 ring-green-200"
                : "bg-red-50 text-red-700 ring-1 ring-red-200"
            }`}
          >
            {singleResult.message}
          </div>
        )}
      </div>

      {/* Sync history */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">同步记录</h2>
          <button
            type="button"
            onClick={() => void fetchHistory()}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            刷新
          </button>
        </div>

        {fetchError && (
          <div className="px-6 py-4 text-sm text-red-700 bg-red-50">
            {fetchError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["触发时间", "触发人", "状态", "成功", "失败", "备注"].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 animate-pulse rounded bg-gray-200" />
                        </td>
                      ))}
                    </tr>
                  ))
                : records.map((rec) => (
                    <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-600 tabular-nums whitespace-nowrap">
                        {formatDatetime(rec.triggeredAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {rec.triggeredBy}
                      </td>
                      <td className="px-4 py-3">
                        <SyncStatusBadge status={rec.status} />
                      </td>
                      <td className="px-4 py-3 text-sm tabular-nums text-green-700 font-medium">
                        {rec.syncedCount}
                      </td>
                      <td className="px-4 py-3 text-sm tabular-nums">
                        {rec.failedCount > 0 ? (
                          <span className="font-medium text-red-600">{rec.failedCount}</span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {rec.note ?? <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  ))}

              {!loading && records.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-sm text-gray-400"
                  >
                    暂无同步记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
