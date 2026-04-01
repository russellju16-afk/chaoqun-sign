import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "送货签收 · 超群粮油",
  description: "超群粮油送货签收",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function SignLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-4 px-4">
      <div className="w-full max-w-[480px]">{children}</div>
    </div>
  );
}
