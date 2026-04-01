import type { DeliveryItem } from "@prisma/client";

// ── Queue payload ──────────────────────────────────────────────────────────────

export interface PrintJobData {
  readonly printJobId: string;
  readonly orderId: string;
  readonly printerName: string;
  readonly copies: number;
  readonly format: PrintFormat;
}

// ── Template types ─────────────────────────────────────────────────────────────

export type PrintFormat = "a4" | "receipt" | "dot-matrix";

/**
 * The subset of DeliveryOrder + its items that the template needs.
 * BigInt fields are kept as bigint here; the template converts to 元 for display.
 */
export interface OrderWithItems {
  readonly id: string;
  readonly orderNo: string;
  readonly kdBillNo: string | null;
  readonly customerName: string;
  readonly customerPhone: string | null;
  readonly customerAddress: string | null;
  readonly totalAmount: bigint;
  readonly deliveryDate: Date;
  readonly items: ReadonlyArray<OrderItem>;
}

export interface OrderItem
  extends Pick<
    DeliveryItem,
    | "id"
    | "productName"
    | "spec"
    | "unit"
    | "unitPrice"
    | "amount"
  > {
  readonly quantity: string; // Decimal serialised to string
}
