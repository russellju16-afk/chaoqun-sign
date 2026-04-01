"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type SignMode = "DIGITAL" | "PAPER" | "BOTH";

interface CustomerDetail {
  id: string;
  name: string;
  kingdeeId: string;
  signMode: SignMode;
  contactName: string | null;
  contactPhone: string | null;
  requirePhoto: boolean;
  autoPrint: boolean;
}

interface FormState {
  signMode: SignMode;
  contactName: string;
  contactPhone: string;
  requirePhoto: boolean;
  autoPrint: boolean;
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div
          className={`h-5 w-9 rounded-full transition-colors ${
            checked ? "bg-blue-600" : "bg-gray-300"
          }`}
        />
        <div
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </div>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

export default function CustomerEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [form, setForm] = useState<FormState>({
    signMode: "DIGITAL",
    contactName: "",
    contactPhone: "",
    requirePhoto: false,
    autoPrint: false,
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setLoadError(null);
    fetch(`/api/admin/customers/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("加载失败");
        return res.json() as Promise<CustomerDetail>;
      })
      .then((data) => {
        setCustomer(data);
        setForm({
          signMode: data.signMode,
          contactName: data.contactName ?? "",
          contactPhone: data.contactPhone ?? "",
          requirePhoto: data.requirePhoto,
          autoPrint: data.autoPrint,
        });
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : "加载失败");
      });
  }, [id]);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        signMode: form.signMode,
        contactName: form.contactName || null,
        contactPhone: form.contactPhone || null,
        requirePhoto: form.requirePhoto,
        autoPrint: form.autoPrint,
      };

      const res = await fetch(`/api/admin/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "保存失败");
      }

      router.push("/admin/customers");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div className="rounded-xl bg-red-50 p-6 text-sm text-red-700 ring-1 ring-red-200">
        {loadError}
        <button
          type="button"
          onClick={() => router.back()}
          className="ml-3 underline"
        >
          返回
        </button>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="space-y-4 max-w-lg">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-200" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      {/* Header */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回列表
        </button>
        <h1 className="text-2xl font-bold text-gray-900">编辑客户配置</h1>
        <p className="mt-1 text-sm text-gray-500">
          {customer.name}
          <span className="ml-2 font-mono text-gray-400">{customer.kingdeeId}</span>
        </p>
      </div>

      {/* Form card */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <div className="space-y-5">
          {/* Sign mode */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              签收模式
            </label>
            <select
              value={form.signMode}
              onChange={(e) =>
                setForm((f) => ({ ...f, signMode: e.target.value as SignMode }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="DIGITAL">数字签收</option>
              <option value="PAPER">纸质签收</option>
              <option value="BOTH">双模式</option>
            </select>
          </div>

          {/* Contact name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              联系人姓名
            </label>
            <input
              type="text"
              value={form.contactName}
              onChange={(e) =>
                setForm((f) => ({ ...f, contactName: e.target.value }))
              }
              placeholder="请输入联系人姓名"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Contact phone */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              联系人手机
            </label>
            <input
              type="tel"
              value={form.contactPhone}
              onChange={(e) =>
                setForm((f) => ({ ...f, contactPhone: e.target.value }))
              }
              placeholder="请输入联系人手机"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Toggles */}
          <div className="flex flex-col gap-4 rounded-xl bg-gray-50 p-4">
            <Toggle
              checked={form.requirePhoto}
              onChange={(v) => setForm((f) => ({ ...f, requirePhoto: v }))}
              label="是否需要拍照"
            />
            <Toggle
              checked={form.autoPrint}
              onChange={(v) => setForm((f) => ({ ...f, autoPrint: v }))}
              label="是否自动打印"
            />
          </div>
        </div>

        {saveError && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
            {saveError}
          </p>
        )}

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-100 pt-5">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={saving}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "保存中..." : "保存更改"}
          </button>
        </div>
      </div>
    </div>
  );
}
