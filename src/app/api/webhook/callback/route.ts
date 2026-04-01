/**
 * POST /api/webhook/callback
 * 金蝶/莱运 状态回调 — 接收单据状态变更事件并同步到 DeliveryOrder。
 *
 * Security: HMAC-SHA256 via `x-webhook-signature` header.
 * Secret:   LAIYUN_WEBHOOK_SECRET env var.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyWebhookSignature } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { badRequest, forbidden, serverError } from "@/lib/errors";
import { OrderStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const KdStatusSchema = z.enum([
  "Approved",   // 已审核
  "Voided",     // 已作废
  "Draft",      // 草稿（反审核回草稿）
]);

const CallbackSchema = z.object({
  /** 金蝶内部单据 ID。 */
  kdBillId: z.string().min(1),
  /** 金蝶单据编号（可选，用于日志）。 */
  kdBillNo: z.string().optional(),
  /** 新状态。 */
  status: KdStatusSchema,
  /** 事件时间（可选）。 */
  eventTime: z.string().optional(),
  /** 备注（可选）。 */
  remark: z.string().optional(),
});

type CallbackInput = z.infer<typeof CallbackSchema>;

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

const STATUS_MAP: Record<z.infer<typeof KdStatusSchema>, OrderStatus | null> = {
  Approved: OrderStatus.PENDING,   // 审核通过 → 等待送货签收
  Voided: OrderStatus.CANCELLED,   // 已作废 → 取消
  Draft: null,                     // 反审核回草稿 → 不处理
};

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.LAIYUN_WEBHOOK_SECRET;
  if (!secret) {
    console.error(
      "[webhook/callback] LAIYUN_WEBHOOK_SECRET is not configured.",
    );
    return serverError("Webhook secret not configured.");
  }

  const rawBody = await req.text();

  const signature = req.headers.get("x-webhook-signature") ?? "";
  if (!signature) {
    return forbidden("Missing x-webhook-signature header.");
  }

  let signatureValid = false;
  try {
    signatureValid = verifyWebhookSignature(rawBody, signature, secret);
  } catch {
    return forbidden("Signature verification error.");
  }

  if (!signatureValid) {
    return forbidden("Invalid webhook signature.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return badRequest("Request body is not valid JSON.");
  }

  const parseResult = CallbackSchema.safeParse(parsed);
  if (!parseResult.success) {
    return badRequest(
      `Validation failed: ${parseResult.error.issues.map((i) => i.message).join("; ")}`,
    );
  }

  const input: CallbackInput = parseResult.data;

  console.info(
    `[webhook/callback] Received callback for bill ${input.kdBillNo ?? input.kdBillId}: status=${input.status}`,
  );

  const targetStatus = STATUS_MAP[input.status];
  if (targetStatus === null) {
    return NextResponse.json({ ok: true, updated: false });
  }

  try {
    const existing = await prisma.deliveryOrder.findFirst({
      where: { kdBillId: input.kdBillId },
      select: { id: true, status: true, orderNo: true },
    });

    if (!existing) {
      console.warn(
        `[webhook/callback] DeliveryOrder for kdBillId=${input.kdBillId} not found; ignoring.`,
      );
      return NextResponse.json({ ok: true, updated: false });
    }

    // 终态保护：已签收/已取消的订单不被覆盖。
    const terminalStatuses: OrderStatus[] = [
      OrderStatus.SIGNED,
      OrderStatus.CANCELLED,
    ];
    if (terminalStatuses.includes(existing.status)) {
      console.info(
        `[webhook/callback] Order ${existing.orderNo} is in terminal status ${existing.status}; skipping.`,
      );
      return NextResponse.json({ ok: true, updated: false });
    }

    await prisma.deliveryOrder.update({
      where: { id: existing.id },
      data: { status: targetStatus },
    });

    console.info(
      `[webhook/callback] Updated order ${existing.orderNo}: ${existing.status} → ${targetStatus}`,
    );

    return NextResponse.json({
      ok: true,
      updated: true,
      orderNo: existing.orderNo,
    });
  } catch (err) {
    console.error("[webhook/callback] Failed to update order status:", err);
    return serverError("Failed to update delivery order status.");
  }
}
