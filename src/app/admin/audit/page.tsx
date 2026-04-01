"use client";

import { useEffect, useState, useCallback } from "react";

interface AuditLogRow {
  id: string;
  createdAt: string; // ISO datetime
  username: string;
  displayName: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  detail: string | null;
  ipAddress: string | null;
}

interface AuditLogResponse {
  logs: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
}

const ACTION_OPTIONS = [
  { value: "", label: "全部操作" },
  { value: "LOGIN", label: "登录" },
  { value: "LOGOUT", label: "退出" },
  { value: "ORDER_UPDATE", label: "更新订单" },
  { value: "ORDER_SIGN", label: "签收" },
  { value: "ORDER_PRINT", label: "打印" },
  { value: "CUSTOMER_CREATE", label: "新增客户" },
  { value: "CUSTOMER_UPDATE", label: "更新客户" },
  { value: "SYNC", label: "数据同步" },
  { value: "CONFIG_CHANGE", label: "配置变更" },
];

const PAGE_SIZE = 30;

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

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [action, setAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (action) params.set("action", action);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/admin/audit-log?${params.toString()}`);
      if (!res.ok) throw new Error("加载失败");
      const data = (await res.json()) as AuditLogResponse;
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }, [page, action, dateFrom, dateTo]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setPage(1);
  }, [action, dateFrom, dateTo]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">审计日志</h1>
        <p className="mt-1 text-sm text-gray-500">只读记录，共 {total} 条</p>
      </div>

      {/* Filters */}
      <div className="mb-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
        <div className="flex flex-wrap gap-3">
          {/* Action filter */}
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Date from */}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            title="开始日期"
          />

          {/* Date to */}
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            title="结束日期"
          />

          {/* Clear */}
          {(action || dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => {
                setAction("");
                setDateFrom("");
                setDateTo("");
              }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              清除筛选
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
        {error && (
          <div className="p-4 text-sm text-red-700 bg-red-50">
            加载失败：{error}
            <button
              type="button"
              onClick={() => void fetchLogs()}
              className="ml-2 underline"
            >
              重试
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["时间", "操作人", "操作", "对象", "详情", "IP 地址"].map((col) => (
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
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 animate-pulse rounded bg-gray-200" />
                        </td>
                      ))}
                    </tr>
                  ))
                : logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-600 tabular-nums whitespace-nowrap">
                        {formatDatetime(log.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <div className="font-medium">{log.displayName}</div>
                        <div className="text-xs text-gray-400">{log.username}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {log.targetLabel ? (
                          <span>
                            {log.targetType && (
                              <span className="mr-1 text-xs text-gray-400">
                                [{log.targetType}]
                              </span>
                            )}
                            {log.targetLabel}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                        {log.detail ? (
                          <span className="line-clamp-2">{log.detail}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 font-mono tabular-nums">
                        {log.ipAddress ?? <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  ))}

              {!loading && logs.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-sm text-gray-400"
                  >
                    暂无审计日志
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <p className="text-sm text-gray-500">
              第 {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} 条，共{" "}
              {total} 条
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                上一页
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    p === page ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
