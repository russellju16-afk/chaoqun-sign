"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import StatusBadge, { type OrderStatus } from "@/components/StatusBadge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
  id: string;
  productName: string;
  spec: string;
  quantity: number;
  unitPrice: number; // cents
  amount: number; // cents
}

interface SignRecord {
  signerName: string;
  signerPhone: string;
  signedAt: string; // ISO
  signatureImageUrl: string | null;
  photoUrls: string[];
}

interface RejectionInfo {
  reason: string;
  rejectedAt: string; // ISO
  rejectorName: string;
}

interface OrderDetail {
  id: string;
  orderNo: string;
  status: OrderStatus;
  totalAmount: number; // cents
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: OrderItem[];
  signRecord: SignRecord | null;
  rejectionInfo: RejectionInfo | null;
  createdAt: string; // ISO
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-200" />
      ))}
    </div>
  );
}

// ─── Action buttons ───────────────────────────────────────────────────────────

function ActionButton({
  onClick,
  loading,
  disabled,
  variant = "primary",
  children,
}: {
  onClick: () => void;
  loading: boolean;
  disabled?: boolean;
  variant?: "primary" | "success" | "secondary";
  children: React.ReactNode;
}) {
  const base =
    "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
  const variants: Record<string, string> = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    success: "bg-green-600 text-white hover:bg-green-700",
    secondary:
      "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      className={`${base} ${variants[variant]}`}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
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
            d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DriverOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Action states
  const [delivering, setDelivering] = useState(false);
  const [deliverError, setDeliverError] = useState("");

  const [sendingSms, setSendingSms] = useState(false);
  const [smsError, setSmsError] = useState("");
  const [signUrl, setSignUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState("");
  const [printDone, setPrintDone] = useState(false);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch(`/api/driver/orders/${id}`);
      if (!res.ok) throw new Error("加载失败");
      const data = (await res.json()) as OrderDetail;
      setOrder(data);
    } catch {
      setLoadError("加载订单失败，请返回重试");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchOrder();
  }, [fetchOrder]);

  async function handleDeliver() {
    setDeliverError("");
    setDelivering(true);
    try {
      const res = await fetch(`/api/driver/orders/${id}/deliver`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("操作失败");
      await fetchOrder();
    } catch {
      setDeliverError("确认送达失败，请重试");
    } finally {
      setDelivering(false);
    }
  }

  async function handleSendSms() {
    setSmsError("");
    setSendingSms(true);
    try {
      const res = await fetch(`/api/driver/orders/${id}/send-sms`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("发送失败");
      const data = (await res.json()) as { signUrl: string };
      setSignUrl(data.signUrl);
    } catch {
      setSmsError("短信发送失败，请重试");
    } finally {
      setSendingSms(false);
    }
  }

  async function handlePrint() {
    setPrintError("");
    setPrintDone(false);
    setPrinting(true);
    try {
      const res = await fetch(`/api/driver/orders/${id}/print`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("打印失败");
      setPrintDone(true);
    } catch {
      setPrintError("打印任务创建失败，请重试");
    } finally {
      setPrinting(false);
    }
  }

  async function handleCopyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) return <Skeleton />;

  if (loadError || !order) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
        <p className="text-sm text-red-600">{loadError || "订单不存在"}</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-4 rounded-xl bg-gray-100 px-6 py-3 text-sm font-medium text-gray-700"
        >
          返回
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-6">
      {/* Back + header */}
      <div className="sticky top-14 z-10 bg-white px-4 pb-3 pt-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-gray-500 active:bg-gray-100"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="truncate text-base font-semibold text-gray-900">
              {order.customerName}
            </p>
            <p className="text-xs text-gray-400">{order.orderNo}</p>
          </div>
          <StatusBadge status={order.status} />
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Amount banner */}
        <div className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3">
          <span className="text-sm text-blue-700">订单金额</span>
          <span className="text-xl font-bold text-blue-800">
            {formatAmount(order.totalAmount)}
          </span>
        </div>

        {/* Customer info card */}
        <div className="rounded-xl bg-white p-4 shadow-sm space-y-2.5">
          <h3 className="text-sm font-semibold text-gray-700">客户信息</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-start justify-between gap-2">
              <span className="flex-shrink-0 text-gray-400">客户</span>
              <span className="text-right font-medium text-gray-900">{order.customerName}</span>
            </div>
            <div className="flex items-start justify-between gap-2">
              <span className="flex-shrink-0 text-gray-400">电话</span>
              <a
                href={`tel:${order.customerPhone}`}
                className="font-medium text-blue-600 underline underline-offset-2"
              >
                {order.customerPhone}
              </a>
            </div>
            <div className="flex items-start justify-between gap-2">
              <span className="flex-shrink-0 text-gray-400">地址</span>
              <span className="text-right text-gray-900">{order.customerAddress}</span>
            </div>
            <div className="flex items-start justify-between gap-2">
              <span className="flex-shrink-0 text-gray-400">下单时间</span>
              <span className="text-right text-gray-500">{formatDateTime(order.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Items list */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            商品明细 ({order.items.length} 件)
          </h3>
          <div className="divide-y divide-gray-100">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-2 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">{item.productName}</p>
                  {item.spec && (
                    <p className="text-xs text-gray-400">{item.spec}</p>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-gray-500">
                    {formatAmount(item.unitPrice)} × {item.quantity}
                  </p>
                  <p className="font-semibold text-gray-900">{formatAmount(item.amount)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2.5 text-sm">
            <span className="font-medium text-gray-700">合计</span>
            <span className="text-base font-bold text-gray-900">
              {formatAmount(order.totalAmount)}
            </span>
          </div>
        </div>

        {/* ── Actions by status ── */}

        {order.status === "PENDING" && (
          <div className="space-y-2">
            {deliverError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {deliverError}
              </p>
            )}
            <ActionButton
              variant="primary"
              onClick={() => void handleDeliver()}
              loading={delivering}
            >
              {!delivering && (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              确认送达
            </ActionButton>
          </div>
        )}

        {order.status === "DELIVERED" && (
          <div className="space-y-3">
            {/* Send SMS */}
            <div className="space-y-2">
              {smsError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{smsError}</p>
              )}
              <ActionButton
                variant="success"
                onClick={() => void handleSendSms()}
                loading={sendingSms}
              >
                {!sendingSms && (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                )}
                发送签收短信
              </ActionButton>
            </div>

            {/* Sign URL result */}
            {signUrl && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                <p className="mb-2 text-xs font-medium text-green-700">签收链接已发送，也可手动分享：</p>
                <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs text-gray-600 shadow-sm">
                  <span className="min-w-0 flex-1 truncate">{signUrl}</span>
                  <button
                    type="button"
                    onClick={() => void handleCopyLink(signUrl)}
                    className={`flex-shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                      copied
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600 active:bg-gray-200"
                    }`}
                  >
                    {copied ? "已复制" : "复制链接"}
                  </button>
                </div>
              </div>
            )}

            {/* Print */}
            <div className="space-y-2">
              {printError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{printError}</p>
              )}
              {printDone && (
                <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                  打印任务已创建
                </p>
              )}
              <ActionButton
                variant="secondary"
                onClick={() => void handlePrint()}
                loading={printing}
              >
                {!printing && (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                )}
                打印送货单
              </ActionButton>
            </div>
          </div>
        )}

        {order.status === "SIGNED" && order.signRecord && (
          <div className="rounded-xl bg-green-50 p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-sm font-semibold text-green-800">签收记录</h3>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-green-700">签收人</span>
                <span className="font-medium text-green-900">{order.signRecord.signerName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-green-700">联系方式</span>
                <a
                  href={`tel:${order.signRecord.signerPhone}`}
                  className="font-medium text-blue-600"
                >
                  {order.signRecord.signerPhone}
                </a>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-green-700">签收时间</span>
                <span className="text-green-900">{formatDateTime(order.signRecord.signedAt)}</span>
              </div>
            </div>

            {order.signRecord.signatureImageUrl && (
              <div>
                <p className="mb-1.5 text-xs text-green-700">签名</p>
                <div className="overflow-hidden rounded-lg border border-green-200 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={order.signRecord.signatureImageUrl}
                    alt="签名"
                    className="h-24 w-full object-contain"
                  />
                </div>
              </div>
            )}

            {order.signRecord.photoUrls.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs text-green-700">
                  现场照片 ({order.signRecord.photoUrls.length} 张)
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {order.signRecord.photoUrls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`照片 ${i + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {order.status === "REJECTED" && order.rejectionInfo && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-sm font-semibold text-red-800">拒收信息</h3>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="flex-shrink-0 text-red-700">拒收人</span>
                <span className="text-right font-medium text-red-900">
                  {order.rejectionInfo.rejectorName}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="flex-shrink-0 text-red-700">拒收时间</span>
                <span className="text-right text-red-900">
                  {formatDateTime(order.rejectionInfo.rejectedAt)}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="flex-shrink-0 text-red-700">拒收原因</span>
                <span className="text-right text-red-900">{order.rejectionInfo.reason}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
