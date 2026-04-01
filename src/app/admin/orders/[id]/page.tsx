"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import StatusBadge, { type OrderStatus } from "@/components/StatusBadge";

// ---- Types ----------------------------------------------------------------

interface DeliveryItem {
  id: string;
  productName: string;
  spec: string | null;
  unit: string;
  quantity: string; // Decimal serialised as string
  unitPrice: string; // BigInt string (cents)
  amount: string; // BigInt string (cents)
  remark: string | null;
}

interface SignRecord {
  signerName: string;
  signerPhone: string | null;
  signatureUrl: string;
  photoUrls: string[];
  remark: string | null;
  signedAt: string; // ISO
}

interface PrintJob {
  id: string;
  printerName: string;
  copies: number;
  status: "QUEUED" | "PRINTING" | "COMPLETED" | "FAILED";
  error: string | null;
  createdAt: string;
}

interface OrderDetail {
  id: string;
  orderNo: string;
  kdBillNo: string | null;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  driverName: string | null;
  driverPhone: string | null;
  totalAmount: string; // cents
  status: OrderStatus;
  deliveryDate: string;
  createdAt: string;
  updatedAt: string;
  items: DeliveryItem[];
  signRecord: SignRecord | null;
  printJobs: PrintJob[];
}

// ---- Helpers ---------------------------------------------------------------

function formatAmount(cents: string): string {
  const num = Number(BigInt(cents)) / 100;
  return `¥${num.toFixed(2)}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

const PRINT_STATUS_MAP: Record<PrintJob["status"], { label: string; className: string }> = {
  QUEUED: { label: "排队中", className: "text-yellow-700 bg-yellow-50" },
  PRINTING: { label: "打印中", className: "text-blue-700 bg-blue-50" },
  COMPLETED: { label: "已完成", className: "text-green-700 bg-green-50" },
  FAILED: { label: "失败", className: "text-red-700 bg-red-50" },
};

// ---- Component -------------------------------------------------------------

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingSms, setSendingSms] = useState(false);
  const [smsFeedback, setSmsFeedback] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/orders/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "订单不存在" : "加载失败");
        return res.json() as Promise<OrderDetail>;
      })
      .then(setOrder)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handlePrint() {
    if (!order) return;
    try {
      const res = await fetch(`/api/admin/orders/${id}/print`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("打印失败");
      // Refresh order to show updated print jobs
      const fresh = await fetch(`/api/admin/orders/${id}`).then((r) =>
        r.json() as Promise<OrderDetail>,
      );
      setOrder(fresh);
    } catch (err) {
      alert(err instanceof Error ? err.message : "打印失败");
    }
  }

  async function handleSendSms() {
    if (!order) return;
    setSendingSms(true);
    setSmsFeedback(null);
    try {
      const res = await fetch(`/api/admin/orders/${id}/send-sms`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSmsFeedback({ ok: true, msg: "签收短信已发送" });
      } else {
        setSmsFeedback({
          ok: false,
          msg: (data as { error?: string }).error ?? "发送失败",
        });
      }
    } catch {
      setSmsFeedback({ ok: false, msg: "网络错误" });
    } finally {
      setSendingSms(false);
    }
  }

  // ---- Loading / error states ----------------------------------------------

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-gray-200" />
        ))}
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="rounded-xl bg-red-50 p-6 text-center ring-1 ring-red-200">
        <p className="text-sm text-red-700">{error ?? "订单不存在"}</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-4 text-sm text-red-600 underline"
        >
          返回
        </button>
      </div>
    );
  }

  // ---- Render --------------------------------------------------------------

  return (
    <div className="max-w-4xl space-y-6">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回列表
        </button>

        <div className="flex items-center gap-2">
          {smsFeedback && (
            <span
              className={`text-xs ${smsFeedback.ok ? "text-green-600" : "text-red-600"}`}
            >
              {smsFeedback.msg}
            </span>
          )}
          <button
            type="button"
            onClick={handleSendSms}
            disabled={sendingSms}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {sendingSms ? "发送中..." : "发送签收短信"}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            打印
          </button>
        </div>
      </div>

      {/* Order Header */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">
                {order.orderNo}
              </h1>
              <StatusBadge status={order.status} />
            </div>
            {order.kdBillNo && (
              <p className="mt-1 text-sm text-gray-500">
                金蝶单号：{order.kdBillNo}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">
              {formatAmount(order.totalAmount)}
            </p>
            <p className="text-sm text-gray-400">订单金额</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-gray-100 pt-5 sm:grid-cols-3">
          <InfoItem label="客户名称" value={order.customerName} />
          <InfoItem
            label="联系电话"
            value={order.customerPhone ?? "—"}
          />
          <InfoItem
            label="送货地址"
            value={order.customerAddress ?? "—"}
          />
          <InfoItem
            label="司机"
            value={order.driverName ?? "未分配"}
          />
          <InfoItem
            label="司机电话"
            value={order.driverPhone ?? "—"}
          />
          <InfoItem
            label="送货日期"
            value={formatDate(order.deliveryDate)}
          />
          <InfoItem
            label="创建时间"
            value={formatDateTime(order.createdAt)}
          />
          <InfoItem
            label="更新时间"
            value={formatDateTime(order.updatedAt)}
          />
        </div>
      </div>

      {/* Items Table */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">货品明细</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {["商品名称", "规格", "单位", "数量", "单价", "金额", "备注"].map(
                  (col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500"
                    >
                      {col}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {item.productName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {item.spec ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {item.unit}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 tabular-nums">
                    {item.quantity}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 tabular-nums">
                    {formatAmount(item.unitPrice)}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 tabular-nums">
                    {formatAmount(item.amount)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {item.remark ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-gray-200 bg-gray-50">
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-3 text-sm font-semibold text-gray-700 text-right"
                >
                  合计
                </td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900 tabular-nums">
                  {formatAmount(order.totalAmount)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Sign Record */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">签收记录</h2>
        </div>
        {order.signRecord ? (
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <InfoItem label="签收人" value={order.signRecord.signerName} />
              <InfoItem
                label="联系电话"
                value={order.signRecord.signerPhone ?? "—"}
              />
              <InfoItem
                label="签收时间"
                value={formatDateTime(order.signRecord.signedAt)}
              />
              {order.signRecord.remark && (
                <InfoItem
                  label="备注"
                  value={order.signRecord.remark}
                />
              )}
            </div>

            {/* Signature image */}
            <div>
              <p className="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                签名
              </p>
              <div className="inline-block rounded-lg border border-gray-200 bg-gray-50 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={order.signRecord.signatureUrl}
                  alt="签名"
                  className="h-20 object-contain"
                />
              </div>
            </div>

            {/* Photos */}
            {order.signRecord.photoUrls.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  现场照片
                </p>
                <div className="flex flex-wrap gap-3">
                  {order.signRecord.photoUrls.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`照片 ${i + 1}`}
                        className="h-24 w-24 object-cover"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="px-6 py-8 text-center text-sm text-gray-400">
            暂无签收记录
          </div>
        )}
      </div>

      {/* Print History */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">打印历史</h2>
        </div>
        {order.printJobs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {["打印机", "份数", "状态", "时间", "错误信息"].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {order.printJobs.map((job) => {
                  const st = PRINT_STATUS_MAP[job.status];
                  return (
                    <tr key={job.id}>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {job.printerName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {job.copies} 份
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${st.className}`}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDateTime(job.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-red-600">
                        {job.error ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-8 text-center text-sm text-gray-400">
            暂无打印记录
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Small helper ----------------------------------------------------------

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm text-gray-900">{value}</p>
    </div>
  );
}
