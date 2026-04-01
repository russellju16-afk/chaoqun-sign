/**
 * Kingdee 云星辰 — sync logic.
 *
 * Bridges Kingdee API data into the local Prisma database.
 *
 *   syncSaleOutbound(billId)   — upsert a single bill
 *   syncRecentOutbounds(hours) — batch-sync bills from the last N hours
 */

import { DeliveryOrder } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  querySaleOutboundDetail,
  querySaleOutboundList,
  mapKingdeeToDeliveryOrder,
  buildItemsCreateData,
} from "./sales";
import { KingdeeBillStatus } from "./types";

// ---------------------------------------------------------------------------
// Public: syncSaleOutbound
// ---------------------------------------------------------------------------

/**
 * Sync a single Kingdee sales outbound bill into the database.
 *
 * - If a DeliveryOrder with the same `kdBillId` already exists, it is
 *   updated (fields + items replaced).
 * - If it does not exist yet, it is created.
 *
 * @returns The resulting DeliveryOrder record.
 */
export async function syncSaleOutbound(billId: string): Promise<DeliveryOrder> {
  const bill = await querySaleOutboundDetail(billId);
  const payload = mapKingdeeToDeliveryOrder(bill);

  const existing = await prisma.deliveryOrder.findFirst({
    where: { kdBillId: billId },
    select: { id: true },
  });

  if (existing) {
    // Update header fields; replace all items atomically.
    return prisma.deliveryOrder.update({
      where: { id: existing.id },
      data: {
        kdBillNo: bill.billNo,
        customerName: bill.customerName,
        totalAmount: payload.totalAmount,
        deliveryDate: new Date(`${bill.date}T00:00:00+08:00`),
        items: {
          // Delete existing items then re-create from Kingdee data.
          deleteMany: {},
          createMany: { data: buildItemsCreateData(bill) },
        },
      },
    });
  }

  // Create new record.
  return prisma.deliveryOrder.create({ data: payload });
}

// ---------------------------------------------------------------------------
// Sync result summary
// ---------------------------------------------------------------------------

export interface SyncSummary {
  /** Number of bills successfully created or updated. */
  readonly synced: number;
  /** Number of bills skipped (e.g. voided bills we intentionally ignore). */
  readonly skipped: number;
  /** Number of bills that failed to sync; details in `errorDetails`. */
  readonly errors: number;
  readonly errorDetails: readonly { billId: string; error: string }[];
}

// ---------------------------------------------------------------------------
// Public: syncRecentOutbounds
// ---------------------------------------------------------------------------

/**
 * Query Kingdee for bills created or updated within the last `hours` hours
 * and sync each one into the local database.
 *
 * Voided bills (status=X) are skipped — we never auto-import cancelled data.
 *
 * @param hours  Look-back window in hours (default 24).
 * @returns      Summary of what was synced, skipped, and errored.
 */
export async function syncRecentOutbounds(hours = 24): Promise<SyncSummary> {
  const now = new Date();
  const from = new Date(now.getTime() - hours * 60 * 60 * 1000);

  const dateFrom = from.toISOString().slice(0, 10); // "YYYY-MM-DD"
  const dateTo = now.toISOString().slice(0, 10);

  const bills = await querySaleOutboundList({
    dateFrom,
    dateTo,
    pageSize: 200,
  });

  let synced = 0;
  let skipped = 0;
  const errorDetails: { billId: string; error: string }[] = [];

  for (const bill of bills) {
    // Skip voided bills — they should not appear in our delivery workflow.
    if (bill.status === KingdeeBillStatus.Voided) {
      skipped++;
      continue;
    }

    try {
      await syncSaleOutbound(bill.billId);
      synced++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[kingdee/sync] Failed to sync bill ${bill.billId}:`, err);
      errorDetails.push({ billId: bill.billId, error: message });
    }
  }

  return {
    synced,
    skipped,
    errors: errorDetails.length,
    errorDetails,
  };
}
