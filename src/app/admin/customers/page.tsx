"use client";

import { useEffect, useState, useCallback } from "react";

type SignMode = "DIGITAL" | "PAPER" | "BOTH";

interface CustomerRow {
  id: string;
  name: string;
  kingdeeId: string;
  signMode: SignMode;
  contactName: string | null;
  contactPhone: string | null;
  requirePhoto: boolean;
  autoPrint: boolean;
}

interface CustomersResponse {
  customers: CustomerRow[];
  total: number;
  page: number;
  pageSize: number;
}

interface CustomerFormData {
  signMode: SignMode;
  contactName: string;
  contactPhone: string;
  requirePhoto: boolean;
  autoPrint: boolean;
}

const SIGN_MODE_CONFIG: Record<SignMode, { label: string; className: string }> = {
  DIGITAL: {
    label: "数字签收",
    className: "bg-blue-100 text-blue-800 border border-blue-200",
  },
  PAPER: {
    label: "纸质签收",
    className: "bg-yellow-100 text-yellow-800 border border-yellow-200",
  },
  BOTH: {
    label: "双模式",
    className: "bg-purple-100 text-purple-800 border border-purple-200",
  },
};

const PAGE_SIZE = 20;

function SignModeBadge({ mode }: { mode: SignMode }) {
  const config = SIGN_MODE_CONFIG[mode];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
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
    <label className="flex cursor-pointer items-center gap-2">
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

const EMPTY_FORM: CustomerFormData = {
  signMode: "DIGITAL",
  contactName: "",
  contactPhone: "",
  requirePhoto: false,
  autoPrint: false,
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Modal state
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/admin/customers?${params.toString()}`);
      if (!res.ok) throw new Error("加载失败");
      const data = (await res.json()) as CustomersResponse;
      setCustomers(data.customers);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    void fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  function openAddModal() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSaveError(null);
    setModalMode("add");
  }

  function openEditModal(customer: CustomerRow) {
    setEditingId(customer.id);
    setForm({
      signMode: customer.signMode,
      contactName: customer.contactName ?? "",
      contactPhone: customer.contactPhone ?? "",
      requirePhoto: customer.requirePhoto,
      autoPrint: customer.autoPrint,
    });
    setSaveError(null);
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setEditingId(null);
    setSaveError(null);
  }

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

      const url =
        modalMode === "edit" && editingId
          ? `/api/admin/customers/${editingId}`
          : "/api/admin/customers";
      const method = modalMode === "edit" ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "保存失败");
      }

      closeModal();
      void fetchCustomers();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">客户配置</h1>
          <p className="mt-1 text-sm text-gray-500">共 {total} 个客户</p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新增客户配置
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
        <div className="relative max-w-sm">
          <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
        {error && (
          <div className="p-4 text-sm text-red-700 bg-red-50">
            加载失败：{error}
            <button
              type="button"
              onClick={() => void fetchCustomers()}
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
                {["客户名称", "金蝶ID", "签收模式", "联系人", "联系电话", "自动打印", "操作"].map(
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
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 animate-pulse rounded bg-gray-200" />
                        </td>
                      ))}
                    </tr>
                  ))
                : customers.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {c.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                        {c.kingdeeId}
                      </td>
                      <td className="px-4 py-3">
                        <SignModeBadge mode={c.signMode} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {c.contactName ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 tabular-nums">
                        {c.contactPhone ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            c.autoPrint
                              ? "bg-green-100 text-green-800 border border-green-200"
                              : "bg-gray-100 text-gray-600 border border-gray-200"
                          }`}
                        >
                          {c.autoPrint ? "是" : "否"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => openEditModal(c)}
                          className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                        >
                          编辑
                        </button>
                      </td>
                    </tr>
                  ))}

              {!loading && customers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">
                    暂无客户数据
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
              第 {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} 条，共 {total}{" "}
              条
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

      {/* Modal */}
      {modalMode !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeModal}
          />

          {/* Panel */}
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-5 text-lg font-semibold text-gray-900">
              {modalMode === "add" ? "新增客户配置" : "编辑客户配置"}
            </h2>

            <div className="space-y-4">
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Toggles */}
              <div className="flex flex-col gap-3 pt-1">
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
              <p className="mt-4 text-sm text-red-600">{saveError}</p>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
