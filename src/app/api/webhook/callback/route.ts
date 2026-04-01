/**
 * POST /api/webhook/callback
 * Kingdee status-update callback — receives bill lifecycle events
 * (approved, cancelled, etc.) and mirrors them to the corresponding
 * DeliveryOrder status.
 *
 * Security: same HMAC-SHA256 mechanism as the inbound order webhook,
 * using the LAIYUN_WEBHOOK_SECRET env var.
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

/**
 * Kingdee bill status values we care about.
 * Unknown values are logged and ignored rather than causing errors.
 */
const KdStatusSchema = z.enum([
  "APPROVED",   // 审核通过
  "CANCELLED",  // 已取消/作废
  "REJECTED",   // 审核拒绝
  "PENDING",    // 待审核 / reset
]);

const CallbackSchema = z.object({
  /** Kingdee internal bill ID — matches kdBillId on DeliveryOrder. */
  kdBillId: z.string().min(1),
  /** Kingdee human-readable bill number (optional; used for logging). */
  kdBillNo: z.string().optional(),
  /** New status reported by Kingdee. */
  status: KdStatusSchema,
  /** ISO timestamp of the event from Kingdee. */
  eventTime: z.string().optional(),
  /** Free-form note or reason attached to the status change. */
  remark: z.string().optional(),
});

type CallbackInput = z.infer<typeof CallbackSchema>;

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

/** Map Kingdee bill status → DeliveryOrder status. */
const STATUS_MAP: Record<
  z.infer<typeof KdStatusSchema>,
  OrderStatus | null
> = {
  APPROVED: OrderStatus.PENDING,   // Bill approved — order stays PENDING (awaiting delivery)
  CANCELLED: OrderStatus.CANCELLED,
  REJECTED: OrderStatus.CANCELLED, // Rejected at Kingdee = treat as cancelled here
  PENDING: null,                    // Reset to pending — no-op for delivery side
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

  // --- 1. Raw body + HMAC verification ---
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

  // --- 2. Parse body ---
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
    `[webhook/callback] Received Kingdee callback for bill ${input.kdBillNo ?? input.kdBillId}: status=${input.status} eventTime=${input.eventTime ?? "-"}`,
  );

  // --- 3. Determine the target DeliveryOrder status ---
  const targetStatus = STATUS_MAP[input.status];
  if (targetStatus === null) {
    // No DB change needed — acknowledge receipt only.
    return NextResponse.json({ ok: true, updated: false });
  }

  // --- 4. Find and update the order ---
  try {
    const existing = await prisma.deliveryOrder.findFirst({
      where: { kdBillId: input.kdBillId },
      select: { id: true, status: true, orderNo: true },
    });

    if (!existing) {
      // Bill not in our system yet — could arrive before the order webhook.
      // Log and acknowledge; no error.
      console.warn(
        `[webhook/callback] DeliveryOrder for kdBillId=${input.kdBillId} not found; ignoring.`,
      );
      return NextResponse.json({ ok: true, updated: false });
    }

    // Avoid overwriting a terminal status (SIGNED / CANCELLED) with a stale callback.
    const terminalStatuses: OrderStatus[] = [
      OrderStatus.SIGNED,
      OrderStatus.CANCELLED,
    ];
    if (terminalStatuses.includes(existing.status)) {
      console.info(
        `[webhook/callback] Order ${existing.orderNo} is already in terminal status ${existing.status}; skipping update.`,
      );
      return NextResponse.json({ ok: true, updated: false });
    }

    await prisma.deliveryOrder.update({
      where: { id: existing.id },
      data: { status: targetStatus },
    });

    console.info(
      `[webhook/callback] Updated order ${existing.orderNo} status: ${existing.status} → ${targetStatus}`,
    );

    return NextResponse.json({ ok: true, updated: true, orderNo: existing.orderNo });
  } catch (err) {
    console.error("[webhook/callback] Failed to update order status:", err);
    return serverError("Failed to update delivery order status.");
  }
}
