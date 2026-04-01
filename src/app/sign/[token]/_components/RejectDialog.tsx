"use client";

import { useState } from "react";

interface RejectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isSubmitting: boolean;
}

export function RejectDialog({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
}: RejectDialogProps) {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    onConfirm(reason.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Bottom sheet */}
      <div className="relative w-full max-w-[480px] bg-white rounded-t-3xl p-6 space-y-5 shadow-xl">
        <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto" />

        <div>
          <h3 className="text-lg font-semibold text-gray-900">确认拒收</h3>
          <p className="mt-1 text-sm text-gray-500">
            请说明拒收原因（可选），确认后此操作不可撤销
          </p>
        </div>

        <textarea
          className="w-full min-h-[80px] px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
          placeholder="例如：货物破损、数量不符、品种错误..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
          disabled={isSubmitting}
        />

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 min-h-[44px] rounded-xl border border-gray-200 text-gray-600 font-medium text-sm disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="flex-1 min-h-[44px] rounded-xl bg-red-500 text-white font-semibold text-sm disabled:opacity-60 active:bg-red-600"
          >
            {isSubmitting ? "提交中..." : "确认拒收"}
          </button>
        </div>
      </div>
    </div>
  );
}
