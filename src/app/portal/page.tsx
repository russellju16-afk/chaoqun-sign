"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 内部入口页 —— 路径隐蔽，需知道 /portal 才能访问
// 检查 session cookie，若已登录则直接跳转对应端
export default function PortalPage() {
  const router = useRouter();

  useEffect(() => {
    // 读取 cookie 判断当前已登录身份，优先跳转
    const cookies = document.cookie;
    if (cookies.includes("admin_session=")) {
      router.replace("/admin");
      return;
    }
    if (cookies.includes("driver_session=")) {
      router.replace("/driver");
      return;
    }
    // 未登录则停留在此页，展示两个入口卡片
  }, [router]);

  return (
    // 与首页保持同款渐变背景
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-800 via-blue-900 to-slate-900 p-6">
      {/* 页面标题区 */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600 shadow-md">
          <span className="text-2xl font-bold text-white">超</span>
        </div>
        <h1 className="text-2xl font-bold text-white">超群签收</h1>
        <p className="mt-1 text-sm text-blue-200">请选择登录入口</p>
      </div>

      {/* 入口卡片区 */}
      <div className="flex w-full max-w-md flex-col gap-4 sm:flex-row">
        {/* 管理后台卡片 */}
        <a
          href="/admin"
          className="group flex flex-1 flex-col items-center gap-3 rounded-2xl bg-white/10 px-8 py-8 text-center shadow-xl backdrop-blur-sm transition-all duration-200 hover:bg-white/20 hover:scale-105"
        >
          {/* 图标 */}
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-500 shadow-md group-hover:bg-blue-400">
            {/* 简单 SVG 管理图标 */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-7 w-7 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 17v-2a4 4 0 014-4h0a4 4 0 014 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 21h18"
              />
            </svg>
          </div>
          <div>
            <p className="text-lg font-semibold text-white">管理后台</p>
            <p className="mt-1 text-xs text-white/60">订单管理 · 客户维护 · 数据统计</p>
          </div>
        </a>

        {/* 司机端卡片 */}
        <a
          href="/driver"
          className="group flex flex-1 flex-col items-center gap-3 rounded-2xl bg-white/10 px-8 py-8 text-center shadow-xl backdrop-blur-sm transition-all duration-200 hover:bg-white/20 hover:scale-105"
        >
          {/* 图标 */}
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-500 shadow-md group-hover:bg-emerald-400">
            {/* 简单 SVG 卡车图标 */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-7 w-7 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M1 3h13v13H1zM14 8h4l3 3v5h-7V8z"
              />
              <circle cx="5.5" cy="18.5" r="1.5" />
              <circle cx="18.5" cy="18.5" r="1.5" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-semibold text-white">司机端</p>
            <p className="mt-1 text-xs text-white/60">送货任务 · 客户签收 · 路线导航</p>
          </div>
        </a>
      </div>

      {/* 底部提示 */}
      <p className="mt-8 text-xs text-white/30">内部系统 · 请勿转发此链接</p>
    </main>
  );
}
