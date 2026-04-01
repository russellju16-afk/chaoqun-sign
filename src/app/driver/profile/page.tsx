"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface DriverUser {
  id: string;
  name: string;
  phone: string;
}

const APP_VERSION = "1.0.0";

export default function DriverProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<DriverUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetch("/api/driver/auth/me")
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<DriverUser>;
      })
      .then((data) => setUser(data))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/driver/auth/logout", { method: "POST" });
      router.replace("/driver/login");
    } catch {
      // Even on error, redirect to login
      router.replace("/driver/login");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <h2 className="text-base font-semibold text-gray-900">我的</h2>

      {/* User info card */}
      <div className="rounded-xl bg-white p-5 shadow-sm">
        {loading ? (
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 animate-pulse rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-32 animate-pulse rounded bg-gray-200" />
            </div>
          </div>
        ) : user ? (
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-700">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-gray-900">{user.name}</p>
              <a
                href={`tel:${user.phone}`}
                className="text-sm text-blue-600"
              >
                {user.phone}
              </a>
              <p className="mt-0.5 text-xs text-gray-400">司机</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">无法加载用户信息</p>
        )}
      </div>

      {/* Info list */}
      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-50">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <span className="text-sm text-gray-700">姓名</span>
          </div>
          <span className="text-sm text-gray-500">{user?.name ?? "—"}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-50">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-green-600">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <span className="text-sm text-gray-700">手机号</span>
          </div>
          <span className="text-sm text-gray-500">{user?.phone ?? "—"}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-sm text-gray-700">应用版本</span>
          </div>
          <span className="text-sm text-gray-400">v{APP_VERSION}</span>
        </div>
      </div>

      {/* App info */}
      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 text-gray-500">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <span className="text-sm text-gray-700">超群粮油</span>
          </div>
          <span className="text-xs text-gray-400">数字化签收系统</span>
        </div>
      </div>

      {/* Logout button */}
      <button
        type="button"
        onClick={() => void handleLogout()}
        disabled={loggingOut}
        className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-50 text-base font-semibold text-red-600 transition active:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loggingOut ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8z" />
            </svg>
            退出中...
          </>
        ) : (
          <>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            退出登录
          </>
        )}
      </button>
    </div>
  );
}
