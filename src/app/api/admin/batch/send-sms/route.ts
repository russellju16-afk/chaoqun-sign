import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { generateSignToken } from "@/lib/auth";
import { sendSignLink } from "@/lib/sms";
import { badRequest, serverError } from "@/lib/errors";
import { requireRole } from "@/lib/role-guard";

const MAX_BATCH = 50;

const batchSmsSchema = z.object({
  orderIds: z
    .array(z.string().cuid())
    .min(1, "至少选择一个订单")
    .max(MAX_BATCH, `最多批量发短信 ${MAX_BATCH} 条`),
});

interface SmsDetail {
  orderId: string;
  orderNo: string;
  status: "sent" | "skipped" | "error";
  reason?: string;
}

interface BatchSmsResponse {
  sent: number;
  skipped: number;
  errors: number;
  details: SmsDetail[];
}

/**
 * POST /api/admin/batch/send-sms
 *
 * Body: { orderIds: string[] }
 *
 * For each DELIVERED order that has a customer phone number:
 *   1. Generate/refresh the sign token.
 *   2. Send the signing link SMS.
 *
 * Returns { sent, skipped, errors, details }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 写操作仅允许 ADMIN 角色
  const roleError = await requireRole(request, ["ADMIN"]);
  if (roleError) return roleError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("请求体不是合法的 JSON");
  }

  const parsed = batchSmsSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const { orderIds } = parsed.data;

  const orders = await prisma.deliveryOrder.findMany({
    where: { id: { in: orderIds } },
    select: {
      id: true,
      orderNo: true,
      status: true,
      customerName: true,
      customerPhone: true,
    },
  });

  if (orders.length === 0) {
    return badRequest("未找到指定订单");
  }

  const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3000";

  const details: SmsDetail[] = [];
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const order of orders) {
    // Only process DELIVERED orders
    if (order.status !== OrderStatus.DELIVERED) {
      details.push({
        orderId: order.id,
        orderNo: order.orderNo,
        status: "skipped",
        reason: `状态为 ${order.status}，仅已送达订单可发送签收短信`,
      });
      skipped++;
      continue;
    }

    // Must have a phone number
    if (!order.customerPhone) {
      details.push({
        orderId: order.id,
        orderNo: order.orderNo,
        status: "skipped",
        reason: "客户无手机号码",
      });
      skipped++;
      continue;
    }

    try {
      // Generate (or refresh) sign token
      const { token, expiry } = generateSignToken(order.id);

      await prisma.deliveryOrder.update({
        where: { id: order.id },
        data: { signToken: token, signTokenExpiry: expiry },
      });

      const signUrl = `${appBaseUrl}/sign/${token}`;

      await sendSignLink(order.customerPhone, {
        customerName: order.customerName,
        orderNo: order.orderNo,
        signUrl,
      });

      details.push({
        orderId: order.id,
        orderNo: order.orderNo,
        status: "sent",
      });
      sent++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "未知错误";
      console.error(`[batch/send-sms] 发送失败 orderId=${order.id}:`, err);
      details.push({
        orderId: order.id,
        orderNo: order.orderNo,
        status: "error",
        reason: message,
      });
      errors++;
    }
  }

  const response: BatchSmsResponse = { sent, skipped, errors, details };

  // Use 207 Multi-Status when there is a mix of success and failure
  const httpStatus = errors > 0 && sent === 0 ? 500 : errors > 0 ? 207 : 200;

  if (httpStatus === 500) {
    return serverError("所有短信发送均失败，请检查短信配置");
  }

  return NextResponse.json(response, { status: httpStatus });
}
