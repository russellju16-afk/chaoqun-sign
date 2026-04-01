/**
 * POST /api/webhook/order
 * Inbound webhook from the 莱运 agent — creates a new DeliveryOrder when
 * 莱运 pushes a sales outbound bill from 金蝶.
 *
 * Security: HMAC-SHA256 signature on raw body via `x-webhook-signature` header.
 * Secret:   LAIYUN_WEBHOOK_SECRET env var.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyWebhookSignature } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { badRequest, forbidden, serverError } from "@/lib/errors";
import { generateOrderNo } from "@/lib/order-number";
import { serializeBigInt } from "@/lib/serialize";
import { notifyNewOrder } from "@/lib/lark";
import { SignMode } from "@prisma/client";

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const ItemSchema = z.object({
  productName: z.string().min(1),
  spec: z.string().optional(),
  unit: z.string().min(1),
  quantity: z.number().positive(),
  /** Unit price in 元 — converted to 分 (BigInt) internally. */
  unitPrice: z.number().nonnegative(),
  /** Line total in 元 — converted to 分 (BigInt) internally. */
  amount: z.number().nonnegative(),
  kdMaterialId: z.string().optional(),
});

const OrderWebhookSchema = z.object({
  kdBillId: z.string().min(1),
  kdBillNo: z.string().min(1),
  customerName: z.string().min(1),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
  driverName: z.string().optional(),
  /** ISO date string for the expected delivery date. */
  deliveryDate: z.string().datetime({ offset: true }).or(z.string().date()),
  /** Total amount in 元 — converted to 分 (BigInt) internally. */
  totalAmount: z.number().nonnegative(),
  items: z.array(ItemSchema).min(1),
});

type OrderWebhookInput = z.infer<typeof OrderWebhookSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a 元 float to 分 as BigInt, rounding half-up. */
function yuanToFen(yuan: number): bigint {
  return BigInt(Math.round(yuan * 100));
}

/** Resolve or create a CustomerConfig by customer name. */
async function resolveCustomer(
  customerName: string,
  customerPhone: string | undefined,
): Promise<string> {
  // 使用 upsert 替代 findFirst + create，消除并发请求下的竞态条件。
  // kdCustomerId 使用稳定的 `laiyun-{customerName}` 格式（去掉 Date.now()），
  // 确保同一客户名始终映射到同一唯一键，避免重复创建占位记录。
  const record = await prisma.customerConfig.upsert({
    where: {
      kdCustomerId: `laiyun-${customerName}`,
    },
    update: {
      // 如果记录已存在，仅在 contactPhone 有新值时更新（不覆盖管理员手动设置的值）
      ...(customerPhone ? { contactPhone: customerPhone } : {}),
    },
    create: {
      // We don't have the real 金蝶 customer ID here; use a synthetic key so
      // the unique constraint is satisfied.  Prefix ensures no collision with
      // real IDs from Kingdee.
      kdCustomerId: `laiyun-${customerName}`,
      customerName,
      contactPhone: customerPhone,
      signMode: SignMode.DIGITAL,
      autoPrint: false,
      requirePhoto: false,
    },
    select: { id: true },
  });
  return record.id;
}

/** Resolve a driver by name (case-insensitive). Returns null if not found. */
async function resolveDriver(driverName: string): Promise<string | null> {
  const driver = await prisma.driver.findFirst({
    where: {
      name: { equals: driverName, mode: "insensitive" },
      isActive: true,
    },
    select: { id: true },
  });
  return driver?.id ?? null;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.LAIYUN_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook/order] LAIYUN_WEBHOOK_SECRET is not configured.");
    return serverError("Webhook secret not configured.");
  }

  // --- 1. Read raw body for HMAC verification ---
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

  // --- 2. Parse and validate body ---
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return badRequest("Request body is not valid JSON.");
  }

  const parseResult = OrderWebhookSchema.safeParse(parsed);
  if (!parseResult.success) {
    return badRequest(
      `Validation failed: ${parseResult.error.issues.map((i) => i.message).join("; ")}`,
    );
  }

  const input: OrderWebhookInput = parseResult.data;

  // --- 3. Build the order in a transaction ---
  try {
    const customerId = await resolveCustomer(
      input.customerName,
      input.customerPhone,
    );
    const driverId = input.driverName
      ? await resolveDriver(input.driverName)
      : null;

    const customerConfig = await prisma.customerConfig.findUnique({
      where: { id: customerId },
      select: { signMode: true, autoPrint: true },
    });

    const orderNo = await generateOrderNo();

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.deliveryOrder.create({
        data: {
          orderNo,
          kdBillId: input.kdBillId,
          kdBillNo: input.kdBillNo,
          customerId,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          customerAddress: input.customerAddress,
          driverId,
          totalAmount: yuanToFen(input.totalAmount),
          deliveryDate: new Date(input.deliveryDate),
          items: {
            create: input.items.map((item) => ({
              productName: item.productName,
              spec: item.spec,
              unit: item.unit,
              quantity: item.quantity,
              unitPrice: yuanToFen(item.unitPrice),
              amount: yuanToFen(item.amount),
              kdMaterialId: item.kdMaterialId,
            })),
          },
        },
        include: { items: true },
      });

      // Create a print job when the customer is configured for paper/both
      // with auto-print enabled.
      const needsPrint =
        customerConfig !== null &&
        customerConfig.autoPrint &&
        (customerConfig.signMode === SignMode.PAPER ||
          customerConfig.signMode === SignMode.BOTH);

      if (needsPrint) {
        const printerName = process.env.DEFAULT_PRINTER_NAME ?? "default";
        await tx.printJob.create({
          data: {
            orderId: created.id,
            printerName,
            copies: 1,
          },
        });
      }

      return created;
    });

    // --- 4. Fire-and-forget Lark notification ---
    void notifyNewOrder({
      orderNo: order.orderNo,
      customerName: order.customerName,
      totalAmount: order.totalAmount,
      itemCount: order.items.length,
      deliveryDate: order.deliveryDate,
    });

    return NextResponse.json(serializeBigInt(order), { status: 201 });
  } catch (err) {
    console.error("[webhook/order] Failed to create order:", err);
    return serverError("Failed to create delivery order.");
  }
}
