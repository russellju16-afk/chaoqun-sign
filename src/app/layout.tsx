import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "超群签收",
  description: "粮油批发送货签收数字化系统",
  // PWA manifest 链接
  manifest: "/manifest.json",
  // iOS PWA 全屏支持
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "超群签收",
  },
  // iOS 主屏图标
  icons: {
    apple: "/icons/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        {/* PWA 主题色，控制浏览器地址栏颜色 */}
        <meta name="theme-color" content="#2563eb" />
      </head>
      <body className="min-h-screen bg-gray-50 antialiased">{children}</body>
    </html>
  );
}
