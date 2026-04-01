"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import StatusBadge, { type OrderStatus } from "@/components/StatusBadge";

// ─── Types ──────────────────────────────────────────────────────────────────

interface OrderSummary {
  id: string;
  orderNo: string;
  customerName: string;
  totalAmount: number; // cents
  status: OrderStatus;
  itemCount: number;
}

interface OrdersResponse {
  orders: OrderSummary[];
  total: number;
}

type StatusFilter = "ALL" | "PENDING" | "DELIVERED" | "SIGNED";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "全部" },
  { value: "PENDING", label: "待送货" },
  { value: "DELIVERED", label: "已送达" },
  { value: "SIGNED", label: "已签收" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatAmount(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function displayDate(dateStr: string): string {
  const today = formatDate(new Date());
  const yesterday = formatDate(new Date(Date.now() - 86400000));
  if (dateStr === today) return "今天";
  if (dateStr === yesterday) return "昨天";
  return dateStr.replace(/-/g, "/");
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function OrderCard({ order }: { order: OrderSummary }) {
  const truncatedNo =
    order.orderNo.length > 16 ? `...${order.orderNo.slice(-12)}` : order.orderNo;

  return (
    <Link href={`/driver/orders/${order.id}`}>
      <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-4 shadow-sm active:bg-gray-50">
        {/* Left accent */}
        <div
          className={`h-10 w-1 flex-shrink-0 rounded-full ${
            order.status === "PENDING"
              ? "bg-yellow-400"
              : order.status === "DELIVERED"
              ? "bg-blue-400"
              : order.status === "SIGNED"
              ? "bg-green-400"
              : "bg-red-400"
          }`}
        />

        {/* Main info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-base font-semibold text-gray-900">
              {order.customerName}
            </p>
            <StatusBadge status={order.status} />
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-xs text-gray-400">{truncatedNo}</p>
            <span className="text-xs text-gray-400">{order.itemCount} 件</span>
          </div>
          <div className="mt-1">
            <span className="text-sm font-medium text-gray-700">
              {formatAmount(order.totalAmount)}
            </span>
          </div>
        </div>

        {/* Chevron */}
        <svg
          className="h-4 w-4 flex-shrink-0 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {/* Placeholder illustration */}
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
        <svg className="h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      </div>
      <p className="text-base font-medium text-gray-500">今日暂无订单</p>
      <p className="mt-1 text-sm text-gray-400">休息一下，等待新任务</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DriverOrdersPage() {
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(
    async (date: string, status: StatusFilter, isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ date });
        if (status !== "ALL") params.set("status", status);
        const res = await fetch(`/api/driver/orders?${params.toString()}`);
        if (!res.ok) throw new Error("加载失败");
        const data = (await res.json()) as OrdersResponse;
        setOrders(data.orders);
      } catch {
        setError("加载订单失败，请下拉刷新重试");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchOrders(selectedDate, statusFilter);
  }, [selectedDate, statusFilter, fetchOrders]);

  // Derived stats for the summary row
  const pendingCount = orders.filter(
    (o) => o.status === "PENDING",
  ).length;
  const deliveredCount = orders.filter(
    (o) => o.status === "DELIVERED",
  ).length;
  const signedCount = orders.filter((o) => o.status === "SIGNED").length;

  return (
    <div className="flex flex-col">
      {/* Date selector */}
      <div className="bg-white px-4 pb-3 pt-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-medium text-gray-700">{displayDate(selectedDate)}</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              max={formatDate(new Date())}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 outline-none focus:border-blue-400"
            />
            <button
              type="button"
              onClick={() => void fetchOrders(selectedDate, statusFilter, true)}
              disabled={refreshing}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 active:bg-gray-100 disabled:opacity-50"
            >
              <svg
                className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              刷新
            </button>
          </div>
        </div>

        {/* Stats summary row */}
        {!loading && orders.length > 0 && (
          <div className="mt-3 flex gap-2">
            <div className="flex flex-1 flex-col items-center rounded-lg bg-yellow-50 py-2">
              <span className="text-lg font-bold text-yellow-700">{pendingCount}</span>
              <span className="text-xs text-yellow-600">待送货</span>
            </div>
            <div className="flex flex-1 flex-col items-center rounded-lg bg-blue-50 py-2">
              <span className="text-lg font-bold text-blue-700">{deliveredCount}</span>
              <span className="text-xs text-blue-600">待签收</span>
            </div>
            <div className="flex flex-1 flex-col items-center rounded-lg bg-green-50 py-2">
              <span className="text-lg font-bold text-green-700">{signedCount}</span>
              <span className="text-xs text-green-600">已签收</span>
            </div>
          </div>
        )}
      </div>

      {/* Status filter chips */}
      <div className="flex gap-2 overflow-x-auto bg-white px-4 pb-3 pt-2 scrollbar-hide">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatusFilter(f.value)}
            className={`flex-shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              statusFilter === f.value
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Orders list */}
      <div className="flex-1 px-4 py-3 space-y-2.5">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-200" />
          ))
        ) : error ? (
          <div className="rounded-xl bg-red-50 px-4 py-6 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => void fetchOrders(selectedDate, statusFilter)}
              className="mt-3 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700"
            >
              重新加载
            </button>
          </div>
        ) : orders.length === 0 ? (
          <EmptyState />
        ) : (
          orders.map((order) => <OrderCard key={order.id} order={order} />)
        )}
      </div>
    </div>
  );
}
