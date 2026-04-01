import { NextRequest, NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  unauthorized,
  forbidden,
  notFound,
  badRequest,
  serverError,
} from "@/lib/errors";
import { getDriverSession } from "@/lib/driver-session";
import { generateSignToken } from "@/lib/auth";
import { sendSignLink } from "@/lib/sms";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface SendSmsBody {
  phone?: string;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const session = await getDriverSession();
  if (!session.driverId) {
    return unauthorized();
  }

  const { id } = await params;

  // Parse optional phone override from request body
  let body: SendSmsBody = {};
  try {
    const text = await request.text();
    if (text.trim().length > 0) {
      body = JSON.parse(text) as SendSmsBody;
    }
  } catch {
    return badRequest("请求体格式错误");
  }

  const order = await prisma.deliveryOrder.findUnique({
    where: { id },
    select: {
      id: true,
      driverId: true,
      status: true,
      orderNo: true,
      customerName: true,
      customerPhone: true,
    },
  });

  if (order === null) {
    return notFound("送货单不存在");
  }

  if (order.driverId !== session.driverId) {
    return forbidden("无权操作此送货单");
  }

  if (order.status !== OrderStatus.DELIVERED) {
    return badRequest(
      `当前状态为 ${order.status}，只有已送达 (DELIVERED) 的订单才能发送签收短信`,
    );
  }

  // Resolve which phone number to send to
  const targetPhone = body.phone?.trim() ?? order.customerPhone ?? null;
  if (targetPhone === null || targetPhone.length === 0) {
    return badRequest("客户手机号未配置，请在请求体中提供 phone 字段");
  }

  // Generate a time-limited sign token
  const { token, expiry } = generateSignToken(order.id);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (appUrl.length === 0) {
    return serverError("签收链接基础 URL 未配置 (NEXT_PUBLIC_APP_URL)");
  }
  const signUrl = `${appUrl}/sign/${token}`;

  // Persist token and expiry before sending so the sign page can validate
  await prisma.deliveryOrder.update({
    where: { id },
    data: {
      signToken: token,
      signTokenExpiry: expiry,
    },
  });

  try {
    await sendSignLink(targetPhone, {
      customerName: order.customerName,
      orderNo: order.orderNo,
      signUrl,
    });
  } catch (err) {
    // Log and surface SMS failure without hiding the cause
    console.error("[send-sms] SMS dispatch failed:", err);
    return serverError("短信发送失败，请稍后重试");
  }

  return NextResponse.json({ ok: true, signUrl });
}
