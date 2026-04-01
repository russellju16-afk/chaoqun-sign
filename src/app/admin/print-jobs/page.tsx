"use client";

import { useEffect, useState, useCallback } from "react";

type PrintJobStatus = "QUEUED" | "PRINTING" | "COMPLETED" | "FAILED";

interface PrintJobRow {
  id: string;
  orderId: string;
  orderNo: string;
  customerName: string;
  printerName: string;
  copies: number;
  status: PrintJobStatus;
  errorMessage: string | null;
  createdAt: string; // ISO datetime
}

interface PrintJobsResponse {
  jobs: PrintJobRow[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_CONFIG: Record<
  PrintJobStatus,
  { label: string; className: string }
> = {
  QUEUED: {
    label: "排队中",
    className: "bg-gray-100 text-gray-600 border border-gray-200",
  },
  PRINTING: {
    label: "打印中",
    className: "bg-blue-100 text-blue-800 border border-blue-200",
  },
  COMPLETED: {
    label: "已完成",
    className: "bg-green-100 text-green-800 border border-green-200",
  },
  FAILED: {
    label: "失败",
    className: "bg-red-100 text-red-800 border border-red-200",
  },
};

const STATUS_OPTIONS = [
  { value: "", label: "全部状态" },
  { value: "QUEUED", label: "排队中" },
  { value: "PRINTING", label: "打印中" },
  { value: "COMPLETED", label: "已完成" },
  { value: "FAILED", label: "失败" },
];

const PAGE_SIZE = 20;

function PrintStatusBadge({ status }: { status: PrintJobStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
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
    hour12: false,
  });
}

export default function PrintJobsPage() {
  const [jobs, setJobs] = useState<PrintJobRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/admin/print-jobs?${params.toString()}`);
      if (!res.ok) throw new Error("加载失败");
      const data = (await res.json()) as PrintJobsResponse;
      setJobs(data.jobs);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  async function handleRetry(job: PrintJobRow) {
    setRetryingId(job.id);
    try {
      const res = await fetch(`/api/admin/orders/${job.orderId}/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retryJobId: job.id }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "重新打印失败");
      }
      void fetchJobs();
    } catch (err) {
      alert(err instanceof Error ? err.message : "重新打印失败");
    } finally {
      setRetryingId(null);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">打印任务</h1>
          <p className="mt-1 text-sm text-gray-500">共 {total} 条记录</p>
        </div>
        <button
          type="button"
          onClick={() => void fetchJobs()}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          刷新
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
        <div className="flex flex-wrap gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {statusFilter && (
            <button
              type="button"
              onClick={() => setStatusFilter("")}
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
              onClick={() => void fetchJobs()}
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
                {["单号", "客户", "打印机", "份数", "状态", "创建时间", "操作"].map((col) => (
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
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 animate-pulse rounded bg-gray-200" />
                        </td>
                      ))}
                    </tr>
                  ))
                : jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {job.orderNo}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {job.customerName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {job.printerName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 tabular-nums">
                        {job.copies}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <PrintStatusBadge status={job.status} />
                          {job.status === "FAILED" && job.errorMessage && (
                            <span className="text-xs text-red-600 max-w-[180px] line-clamp-2">
                              {job.errorMessage}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 tabular-nums whitespace-nowrap">
                        {formatDatetime(job.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        {job.status === "FAILED" && (
                          <button
                            type="button"
                            onClick={() => void handleRetry(job)}
                            disabled={retryingId === job.id}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50 transition-colors"
                          >
                            {retryingId === job.id ? "重试中..." : "重新打印"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}

              {!loading && jobs.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm text-gray-400"
                  >
                    暂无打印任务
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
