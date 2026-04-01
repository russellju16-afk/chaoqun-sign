"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import SignaturePad from "@/components/SignaturePad";
import PhotoCapture from "@/components/PhotoCapture";
import type { OrderData, PageState } from "./_components/types";
import {
  LoadingSkeleton,
  ErrorCard,
  AlreadySignedCard,
  AlreadyRejectedCard,
  CancelledCard,
} from "./_components/StatusCards";
import { SuccessCard } from "./_components/SuccessCard";
import { RejectDialog } from "./_components/RejectDialog";
import {
  OrderHeaderCard,
  OrderInfoCard,
  OrderItemsCard,
} from "./_components/OrderCard";

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      <svg
        className="w-5 h-5 text-blue-500 animate-spin"
        fill="none"
        viewBox="0 0 24 24"
      >
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
          d="M4 12a8 8 0 018-8v8H4z"
        />
      </svg>
      <span className="text-sm text-gray-500">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Submit overlay
// ---------------------------------------------------------------------------

function SubmittingOverlay() {
  return (
    <div className="fixed inset-0 z-40 bg-white/80 flex flex-col items-center justify-center gap-3">
      <svg
        className="w-10 h-10 text-blue-500 animate-spin"
        fill="none"
        viewBox="0 0 24 24"
      >
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
          d="M4 12a8 8 0 018-8v8H4z"
        />
      </svg>
      <p className="text-sm text-gray-600 font-medium">正在提交签收...</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SignPage() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";

  const [pageState, setPageState] = useState<PageState>({ kind: "loading" });
  const [signerName, setSignerName] = useState("");
  const [signerPhone, setSignerPhone] = useState("");
  const [remark, setRemark] = useState("");
  const [signatureEmpty, setSignatureEmpty] = useState(true);
  const [photos, setPhotos] = useState<
    { id: string; file: File; preview: string }[]
  >([]);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const signaturePadRef = useRef<{
    toDataURL: () => string;
    isEmpty: () => boolean;
    clear: () => void;
  } | null>(null);

  // Fetch order info on mount
  useEffect(() => {
    if (!token) {
      setPageState({ kind: "error", message: "签收链接不完整，请重新获取" });
      return;
    }

    let cancelled = false;

    async function fetchOrder() {
      try {
        const res = await fetch(`/api/sign/${token}`);
        if (cancelled) return;

        if (res.status === 409) {
          const body = (await res.json()) as { error: string };
          if (body.error === "ALREADY_SIGNED") {
            setPageState({ kind: "already_signed" });
          } else if (body.error === "ALREADY_REJECTED") {
            setPageState({ kind: "already_rejected" });
          } else {
            setPageState({ kind: "cancelled" });
          }
          return;
        }

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            message?: string;
          };
          setPageState({
            kind: "error",
            message: body.message ?? "链接无效或已过期",
          });
          return;
        }

        const order = (await res.json()) as OrderData;
        setPageState({ kind: "form", order });
      } catch {
        if (!cancelled) {
          setPageState({ kind: "error", message: "网络异常，请稍后重试" });
        }
      }
    }

    void fetchOrder();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const canSubmit = signerName.trim().length > 0 && !signatureEmpty;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    const currentState = pageState;
    if (currentState.kind !== "form") return;

    const signatureDataUrl = signaturePadRef.current?.toDataURL() ?? "";
    if (!signatureDataUrl) return;

    const photoDataUrls = await Promise.all(
      photos.map(
        (p) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(p.file);
          }),
      ),
    );

    setPageState({ kind: "submitting", order: currentState.order });

    try {
      const res = await fetch(`/api/sign/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signerName: signerName.trim(),
          signerPhone: signerPhone.trim() || undefined,
          signatureDataUrl,
          photoDataUrls: photoDataUrls.length > 0 ? photoDataUrls : undefined,
          remark: remark.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        setPageState({ kind: "form", order: currentState.order });
        alert(body.message ?? "提交失败，请重试");
        return;
      }

      const result = (await res.json()) as {
        orderNo?: string;
        signerName: string;
        signedAt: string;
      };

      setPageState({
        kind: "success",
        data: {
          orderNo: result.orderNo ?? currentState.order.orderNo,
          signerName: result.signerName,
          signedAt: result.signedAt,
        },
      });
    } catch {
      setPageState({ kind: "form", order: currentState.order });
      alert("网络异常，请稍后重试");
    }
  }, [canSubmit, pageState, photos, signerName, signerPhone, remark, token]);

  const handleReject = useCallback(
    async (reason: string) => {
      setRejectSubmitting(true);
      try {
        const res = await fetch(`/api/sign/${token}/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason || undefined }),
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            message?: string;
          };
          alert(body.message ?? "拒收失败，请重试");
          return;
        }

        setRejectDialogOpen(false);
        setPageState({ kind: "already_rejected" });
      } catch {
        alert("网络异常，请稍后重试");
      } finally {
        setRejectSubmitting(false);
      }
    },
    [token],
  );

  // ---------------------------------------------------------------------------
  // Early-exit renders
  // ---------------------------------------------------------------------------

  if (pageState.kind === "loading") {
    return (
      <div className="space-y-4 pt-2">
        <Spinner label="加载中..." />
        <LoadingSkeleton />
      </div>
    );
  }
  if (pageState.kind === "error") return <ErrorCard message={pageState.message} />;
  if (pageState.kind === "already_signed") return <AlreadySignedCard />;
  if (pageState.kind === "already_rejected") return <AlreadyRejectedCard />;
  if (pageState.kind === "cancelled") return <CancelledCard />;
  if (pageState.kind === "success") return <SuccessCard data={pageState.data} />;

  // "form" or "submitting"
  const order = pageState.order;
  const isSubmitting = pageState.kind === "submitting";

  // ---------------------------------------------------------------------------
  // Form render
  // ---------------------------------------------------------------------------

  return (
    <>
      {isSubmitting && <SubmittingOverlay />}

      <div className="space-y-4 pb-8">
        <OrderHeaderCard />
        <OrderInfoCard order={order} />
        <OrderItemsCard order={order} />

        {/* Divider */}
        <div className="relative flex items-center">
          <div className="flex-1 border-t border-gray-200" />
          <span className="mx-3 text-xs text-gray-400">签收确认</span>
          <div className="flex-1 border-t border-gray-200" />
        </div>

        {/* Signer info */}
        <div className="bg-white rounded-2xl px-5 py-5 shadow-sm space-y-4">
          <div>
            <label
              htmlFor="signerName"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              签收人姓名
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              id="signerName"
              type="text"
              inputMode="text"
              placeholder="请输入签收人姓名"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              maxLength={50}
              disabled={isSubmitting}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50"
            />
          </div>

          <div>
            <label
              htmlFor="signerPhone"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              联系电话
              <span className="text-xs text-gray-400 ml-1">（可选）</span>
            </label>
            <input
              id="signerPhone"
              type="tel"
              inputMode="tel"
              placeholder="请输入联系电话"
              value={signerPhone}
              onChange={(e) => setSignerPhone(e.target.value)}
              maxLength={20}
              disabled={isSubmitting}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50"
            />
          </div>
        </div>

        {/* Signature pad */}
        <div className="bg-white rounded-2xl px-5 py-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                签名确认
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <p className="text-xs text-gray-400 mt-0.5">请在下方手写签名</p>
            </div>
            {!signatureEmpty && (
              <button
                type="button"
                onClick={() => {
                  signaturePadRef.current?.clear();
                  setSignatureEmpty(true);
                }}
                disabled={isSubmitting}
                className="text-xs text-gray-400 underline disabled:opacity-50"
              >
                重新签名
              </button>
            )}
          </div>
          <div className="rounded-xl overflow-hidden border border-gray-200">
            <SignaturePad
              ref={signaturePadRef}
              onSignatureChange={(empty) => setSignatureEmpty(empty)}
            />
          </div>
          {signatureEmpty && (
            <p className="text-xs text-gray-400 text-center">
              ↑ 请在上方空白区域手写签名
            </p>
          )}
        </div>

        {/* Photo capture */}
        <div className="bg-white rounded-2xl px-5 py-5 shadow-sm space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              拍照留证
              <span className="text-xs text-gray-400 ml-1">（可选）</span>
            </label>
            <p className="text-xs text-gray-400 mt-0.5">
              可拍摄货物照片作为凭证，最多 5 张
            </p>
          </div>
          <PhotoCapture maxPhotos={5} onPhotosChange={setPhotos} />
        </div>

        {/* Remark */}
        <div className="bg-white rounded-2xl px-5 py-5 shadow-sm">
          <label
            htmlFor="remark"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            备注
            <span className="text-xs text-gray-400 ml-1">（可选）</span>
          </label>
          <textarea
            id="remark"
            placeholder="如有特殊情况，请在此备注"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            maxLength={500}
            rows={3}
            disabled={isSubmitting}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none disabled:bg-gray-50"
          />
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit || isSubmitting}
            className="w-full min-h-[52px] rounded-xl bg-blue-600 text-white text-base font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:bg-blue-700 transition-colors"
          >
            {isSubmitting ? "提交中..." : "确认签收"}
          </button>

          <button
            type="button"
            onClick={() => setRejectDialogOpen(true)}
            disabled={isSubmitting}
            className="w-full min-h-[44px] rounded-xl border border-red-200 text-red-500 text-sm font-medium disabled:opacity-50 active:bg-red-50 transition-colors"
          >
            拒收
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 pb-4">
          点击"确认签收"即表示您已验收上述货品，签收记录将实时同步至超群粮油系统
        </p>
      </div>

      <RejectDialog
        isOpen={rejectDialogOpen}
        onClose={() => setRejectDialogOpen(false)}
        onConfirm={(reason) => void handleReject(reason)}
        isSubmitting={rejectSubmitting}
      />
    </>
  );
}
