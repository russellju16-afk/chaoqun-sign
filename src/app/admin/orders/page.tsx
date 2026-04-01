"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import StatusBadge, { type OrderStatus } from "@/components/StatusBadge";

interface OrderRow {
  id: string;
  orderNo: string;
  customerName: string;
  totalAmount: string; // BigInt serialised as string (cents)
  status: OrderStatus;
  deliveryDate: string; // ISO date string
  driverName: string | null;
}

interface OrdersResponse {
  orders: OrderRow[];
  total: number;
  page: number;
  pageSize: number;
}

interface BatchPrintResponse {
  created: number;
  jobs: unknown[];
}

interface BatchSmsResponse {
  sent: number;
  skipped: number;
  errors: number;
  details: unknown[];
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "全部状态" },
  { value: "PENDING", label: "待送货" },
  { value: "DELIVERED", label: "已送达" },
  { value: "SIGNED", label: "已签收" },
  { value: "REJECTED", label: "拒收" },
  { value: "CANCELLED", label: "已取消" },
];

const PAGE_SIZE = 20;

function formatAmount(cents: string): string {
  const num = Number(BigInt(cents)) / 100;
  return `¥${num.toFixed(2)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// ── Confirmation dialog ───────────────────────────────────────────────────────

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <p className="text-sm text-gray-700">{message}</p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Toast notification ────────────────────────────────────────────────────────

function Toast({
  message,
  type,
  onDismiss,
}: {
  message: string;
  type: "success" | "error" | "info";
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const colors =
    type === "success"
      ? "bg-green-50 text-green-800 ring-green-200"
      : type === "error"
        ? "bg-red-50 text-red-800 ring-red-200"
        : "bg-blue-50 text-blue-800 ring-blue-200";

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-xl px-4 py-3 shadow-lg ring-1 text-sm ${colors}`}
    >
      {message}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Batch action state
  const [batchLoading, setBatchLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | {
    label: string;
    action: () => Promise<void>;
  }>(null);

  // Toast
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info") => {
      setToast({ message, type });
    },
    [],
  );

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (status) params.set("status", status);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      if (!res.ok) throw new Error("加载失败");
      const data = (await res.json()) as OrdersResponse;
      setOrders(data.orders);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, status, dateFrom, dateTo]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  // Reset page and selection when filters change
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [debouncedSearch, status, dateFrom, dateTo]);

  // Clear selection when page changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Selection helpers
  const allCurrentSelected =
    orders.length > 0 && orders.every((o) => selectedIds.has(o.id));
  const someSelected = selectedIds.size > 0;

  function toggleSelectAll() {
    if (allCurrentSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map((o) => o.id)));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // ── Batch actions ──────────────────────────────────────────────────────────

  async function handleBatchPrint() {
    setBatchLoading(true);
    try {
      const res = await fetch("/api/admin/batch/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: Array.from(selectedIds) }),
      });
      const data = (await res.json()) as BatchPrintResponse;
      if (!res.ok) throw new Error("打印任务创建失败");
      showToast(`已创建 ${data.created} 个打印任务`, "success");
      setSelectedIds(new Set());
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "批量打印失败",
        "error",
      );
    } finally {
      setBatchLoading(false);
    }
  }

  async function handleBatchSms() {
    setBatchLoading(true);
    try {
      const res = await fetch("/api/admin/batch/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: Array.from(selectedIds) }),
      });
      const data = (await res.json()) as BatchSmsResponse;
      if (!res.ok && res.status !== 207)
        throw new Error("短信发送失败");
      showToast(
        `已发送 ${data.sent} 条，跳过 ${data.skipped} 条，失败 ${data.errors} 条`,
        data.errors > 0 ? "error" : "success",
      );
      setSelectedIds(new Set());
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "批量发短信失败",
        "error",
      );
    } finally {
      setBatchLoading(false);
    }
  }

  function handleExportCsv() {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    window.open(`/api/admin/batch/export?${params.toString()}`, "_blank");
    showToast("正在导出 CSV 文件…", "info");
  }

  function askConfirm(label: string, action: () => Promise<void>) {
    setConfirmAction({ label, action });
  }

  const selectedCount = selectedIds.size;

  return (
    <div>
      {/* Confirm dialog */}
      {confirmAction && (
        <ConfirmDialog
          message={`确认${confirmAction.label}？已选择 ${selectedCount} 条订单。`}
          onConfirm={() => {
            const act = confirmAction;
            setConfirmAction(null);
            void act.action();
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">订单管理</h1>
          <p className="mt-1 text-sm text-gray-500">共 {total} 条订单</p>
        </div>
        {/* Export CSV (always available, uses filters) */}
        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          导出 CSV
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </span>
            <input
              type="text"
              placeholder="搜索客户名称..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Status filter */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {STATUS_OPTIONS.map((opt) => (
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

          {/* Clear filters */}
          {(search || status || dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatus("");
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

      {/* Batch action bar — shown when items are selected */}
      {someSelected && (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-blue-50 px-4 py-3 ring-1 ring-blue-200">
          <span className="text-sm font-medium text-blue-800">
            已选 {selectedCount} 条
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={batchLoading}
              onClick={() => askConfirm("批量打印", handleBatchPrint)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                />
              </svg>
              批量打印
            </button>

            <button
              type="button"
              disabled={batchLoading}
              onClick={() => askConfirm("批量发短信", handleBatchSms)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
              批量发短信
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="rounded-lg px-3 py-1.5 text-sm text-blue-700 hover:text-blue-900 transition-colors"
            >
              取消选择
            </button>
          </div>
          {batchLoading && (
            <span className="ml-auto text-xs text-blue-600 animate-pulse">
              处理中…
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
        {error && (
          <div className="p-4 text-sm text-red-700 bg-red-50">
            加载失败：{error}
            <button
              type="button"
              onClick={() => void fetchOrders()}
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
                {/* Checkbox header */}
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allCurrentSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    title="全选"
                    aria-label="全选当前页"
                  />
                </th>
                {["单号", "客户", "金额", "状态", "送货日期", "司机", "操作"].map(
                  (col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      {col}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 animate-pulse rounded bg-gray-200" />
                        </td>
                      ))}
                    </tr>
                  ))
                : orders.map((order) => {
                    const isSelected = selectedIds.has(order.id);
                    return (
                      <tr
                        key={order.id}
                        className={`cursor-pointer hover:bg-gray-50 transition-colors ${isSelected ? "bg-blue-50" : ""}`}
                        onClick={() => router.push(`/admin/orders/${order.id}`)}
                      >
                        {/* Checkbox cell */}
                        <td
                          className="px-4 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(order.id)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            aria-label={`选择订单 ${order.orderNo}`}
                          />
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {order.orderNo}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {order.customerName}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 tabular-nums">
                          {formatAmount(order.totalAmount)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatDate(order.deliveryDate)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {order.driverName ?? (
                            <span className="text-gray-400">未分配</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/admin/orders/${order.id}`);
                            }}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            查看
                          </button>
                        </td>
                      </tr>
                    );
                  })}

              {!loading && orders.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-gray-400"
                  >
                    暂无订单数据
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
              第 {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, total)} 条，共 {total} 条
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
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                      p === page
                        ? "bg-blue-600 text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
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
