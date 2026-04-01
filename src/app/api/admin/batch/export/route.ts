import { NextRequest, NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { badRequest } from "@/lib/errors";

const MAX_ROWS = 1000;

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "待送货",
  DELIVERED: "已送达",
  SIGNED: "已签收",
  REJECTED: "拒收",
  CANCELLED: "已取消",
};

function escapeCsvField(value: string): string {
  // Wrap in double quotes if the field contains a comma, newline, or double quote
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildCsvRow(fields: string[]): string {
  return fields.map(escapeCsvField).join(",");
}

function formatAmount(cents: bigint): string {
  return (Number(cents) / 100).toFixed(2);
}

function formatDate(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateTime(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * GET /api/admin/batch/export
 *
 * Query params: dateFrom, dateTo, status
 * Returns a CSV file download (max 1000 rows).
 *
 * Columns: 单号, 客户, 金额(元), 状态, 送货日期, 签收人, 签收时间
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;

  const rawDateFrom = searchParams.get("dateFrom");
  const rawDateTo = searchParams.get("dateTo");
  const rawStatus = searchParams.get("status");

  // Parse dates
  const dateFrom = rawDateFrom ? new Date(rawDateFrom) : undefined;
  const dateTo = rawDateTo ? new Date(rawDateTo) : undefined;

  if (dateFrom && isNaN(dateFrom.getTime())) {
    return badRequest("dateFrom 日期格式无效");
  }
  if (dateTo && isNaN(dateTo.getTime())) {
    return badRequest("dateTo 日期格式无效");
  }
  if (dateTo) dateTo.setHours(23, 59, 59, 999);

  // Parse status filter
  const status =
    rawStatus !== null && rawStatus in OrderStatus
      ? (rawStatus as OrderStatus)
      : undefined;

  const where = {
    ...(status !== undefined ? { status } : {}),
    ...(dateFrom !== undefined || dateTo !== undefined
      ? {
          deliveryDate: {
            ...(dateFrom !== undefined ? { gte: dateFrom } : {}),
            ...(dateTo !== undefined ? { lte: dateTo } : {}),
          },
        }
      : {}),
  };

  const orders = await prisma.deliveryOrder.findMany({
    where,
    orderBy: { deliveryDate: "desc" },
    take: MAX_ROWS,
    select: {
      orderNo: true,
      customerName: true,
      totalAmount: true,
      status: true,
      deliveryDate: true,
      signRecord: {
        select: {
          signerName: true,
          signedAt: true,
        },
      },
    },
  });

  // Build CSV
  const headerRow = buildCsvRow([
    "单号",
    "客户",
    "金额(元)",
    "状态",
    "送货日期",
    "签收人",
    "签收时间",
  ]);

  const dataRows = orders.map((order) =>
    buildCsvRow([
      order.orderNo,
      order.customerName,
      formatAmount(order.totalAmount),
      STATUS_LABELS[order.status],
      formatDate(order.deliveryDate),
      order.signRecord?.signerName ?? "",
      order.signRecord ? formatDateTime(order.signRecord.signedAt) : "",
    ]),
  );

  const csvContent = [headerRow, ...dataRows].join("\r\n");

  // UTF-8 BOM so Excel opens the file correctly
  const bom = "\uFEFF";
  const body = bom + csvContent;

  const exportDate = new Date().toISOString().slice(0, 10);
  const filename = `orders_export_${exportDate}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Total-Rows": String(orders.length),
      "X-Max-Rows": String(MAX_ROWS),
    },
  });
}
