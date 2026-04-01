import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "超群签收",
  description: "粮油批发送货签收数字化系统",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gray-50 antialiased">{children}</body>
    </html>
  );
}
