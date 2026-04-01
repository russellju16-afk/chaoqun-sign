// Formatting utilities for the sign page

export function formatCents(cents: string): string {
  const n = parseInt(cents, 10);
  if (isNaN(n)) return "¥0.00";
  return `¥${(n / 100).toFixed(2)}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function parseDecimal(s: string): string {
  const n = parseFloat(s);
  if (isNaN(n)) return "0";
  return n % 1 === 0 ? String(Math.floor(n)) : n.toFixed(2).replace(/0+$/, "");
}
