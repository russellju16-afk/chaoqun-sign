"use client";

export type OrderStatus =
  | "PENDING"
  | "DELIVERED"
  | "SIGNED"
  | "REJECTED"
  | "CANCELLED";

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; className: string }
> = {
  PENDING: {
    label: "待送货",
    className: "bg-yellow-100 text-yellow-800 border border-yellow-200",
  },
  DELIVERED: {
    label: "已送达",
    className: "bg-blue-100 text-blue-800 border border-blue-200",
  },
  SIGNED: {
    label: "已签收",
    className: "bg-green-100 text-green-800 border border-green-200",
  },
  REJECTED: {
    label: "拒收",
    className: "bg-red-100 text-red-800 border border-red-200",
  },
  CANCELLED: {
    label: "已取消",
    className: "bg-gray-100 text-gray-600 border border-gray-200",
  },
};

interface StatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

export default function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: "bg-gray-100 text-gray-600 border border-gray-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className} ${className}`}
    >
      {config.label}
    </span>
  );
}

export function getStatusLabel(status: OrderStatus): string {
  return STATUS_CONFIG[status]?.label ?? status;
}
