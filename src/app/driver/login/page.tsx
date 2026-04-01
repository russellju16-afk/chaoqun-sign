"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const COUNTDOWN_SECONDS = 60;
const PHONE_REGEX = /^1[3-9]\d{9}$/;

type Step = "phone" | "code";

export default function DriverLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startCountdown() {
    setCountdown(COUNTDOWN_SECONDS);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleSendCode() {
    if (!PHONE_REGEX.test(phone)) {
      setError("请输入正确的手机号");
      return;
    }
    setError("");
    setSending(true);
    try {
      const res = await fetch("/api/driver/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "发送失败，请稍后重试");
        return;
      }
      setStep("code");
      startCountdown();
      setTimeout(() => codeInputRef.current?.focus(), 100);
    } catch {
      setError("网络错误，请检查网络后重试");
    } finally {
      setSending(false);
    }
  }

  async function handleResendCode() {
    if (countdown > 0) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/driver/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "发送失败，请稍后重试");
        return;
      }
      startCountdown();
    } catch {
      setError("网络错误，请检查网络后重试");
    } finally {
      setSending(false);
    }
  }

  async function handleVerify() {
    if (code.length !== 6) {
      setError("请输入6位验证码");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/driver/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "验证码错误，请重新输入");
        return;
      }
      router.replace("/driver");
    } catch {
      setError("网络错误，请检查网络后重试");
    } finally {
      setSubmitting(false);
    }
  }

  function handlePhoneKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && PHONE_REGEX.test(phone) && countdown === 0) {
      void handleSendCode();
    }
  }

  function handleCodeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && code.length === 6) {
      void handleVerify();
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-gray-100 px-4">
      {/* Logo area */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white text-2xl font-bold shadow-lg">
          超
        </div>
        <h1 className="text-xl font-bold text-gray-900">超群签收</h1>
        <p className="mt-1 text-sm text-gray-500">司机端</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-[400px] rounded-2xl bg-white px-6 py-8 shadow-md">
        <h2 className="mb-6 text-center text-lg font-semibold text-gray-900">司机登录</h2>

        {step === "phone" && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                手机号
              </label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={11}
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, ""));
                  setError("");
                }}
                onKeyDown={handlePhoneKeyDown}
                placeholder="请输入手机号"
                className="block w-full rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder-gray-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                autoComplete="tel"
                autoFocus
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <button
              type="button"
              onClick={() => void handleSendCode()}
              disabled={!PHONE_REGEX.test(phone) || sending}
              className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 text-base font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8z" />
                  </svg>
                  发送中...
                </span>
              ) : (
                "获取验证码"
              )}
            </button>
          </div>
        )}

        {step === "code" && (
          <div className="space-y-4">
            <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
              验证码已发送至 <strong>{phone}</strong>
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setCode("");
                  setError("");
                }}
                className="ml-2 text-blue-500 underline underline-offset-2"
              >
                更改
              </button>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                验证码
              </label>
              <input
                ref={codeInputRef}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, ""));
                  setError("");
                }}
                onKeyDown={handleCodeKeyDown}
                placeholder="请输入6位验证码"
                className="block w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                autoComplete="one-time-code"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <button
              type="button"
              onClick={() => void handleVerify()}
              disabled={code.length !== 6 || submitting}
              className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 text-base font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8z" />
                  </svg>
                  验证中...
                </span>
              ) : (
                "登录"
              )}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => void handleResendCode()}
                disabled={countdown > 0 || sending}
                className="text-sm text-gray-500 disabled:cursor-default"
              >
                {countdown > 0 ? (
                  <span>
                    重新发送 <span className="font-medium text-blue-600">{countdown}s</span>
                  </span>
                ) : sending ? (
                  "发送中..."
                ) : (
                  <span className="text-blue-600 underline underline-offset-2">重新发送验证码</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-gray-400">超群粮油 · 数字化签收系统</p>
    </div>
  );
}
