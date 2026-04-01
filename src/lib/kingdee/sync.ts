/**
 * Kingdee 云星辰 — sync logic.
 *
 * Bridges Kingdee API data into the local Prisma database.
 *
 *   syncSaleOutbound(billId)   — upsert a single bill (by Kingdee internal ID)
 *   syncSaleOutboundByNo(no)   — upsert a single bill (by bill number)
 *   syncRecentOutbounds(hours) — batch-sync bills from the last N hours
 */

import { DeliveryOrder } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  querySaleOutboundDetail,
  querySaleOutboundByNo,
  querySaleOutboundList,
  mapKingdeeToDeliveryOrder,
  buildItemsCreateData,
} from "./sales";

// ---------------------------------------------------------------------------
// Public: syncSaleOutbound (by ID)
// ---------------------------------------------------------------------------

export async function syncSaleOutbound(billId: string): Promise<DeliveryOrder> {
  const bill = await querySaleOutboundDetail(billId);
  return upsertBill(bill);
}

// ---------------------------------------------------------------------------
// Public: syncSaleOutboundByNo (by bill number like CKCK240001)
// ---------------------------------------------------------------------------

export async function syncSaleOutboundByNo(
  billNo: string,
): Promise<DeliveryOrder> {
  const bill = await querySaleOutboundByNo(billNo);
  return upsertBill(bill);
}

// ---------------------------------------------------------------------------
// Internal: upsert logic
// ---------------------------------------------------------------------------

async function upsertBill(
  bill: Awaited<ReturnType<typeof querySaleOutboundDetail>>,
): Promise<DeliveryOrder> {
  const payload = mapKingdeeToDeliveryOrder(bill);

  const existing = await prisma.deliveryOrder.findFirst({
    where: { kdBillId: bill.billId },
    select: { id: true },
  });

  if (existing) {
    return prisma.deliveryOrder.update({
      where: { id: existing.id },
      data: {
        kdBillNo: bill.billNo,
        customerName: bill.customerName,
        totalAmount: payload.totalAmount,
        deliveryDate: new Date(`${bill.date}T00:00:00+08:00`),
        items: {
          deleteMany: {},
          createMany: { data: buildItemsCreateData(bill) },
        },
      },
    });
  }

  return prisma.deliveryOrder.create({ data: payload });
}

// ---------------------------------------------------------------------------
// Sync result summary
// ---------------------------------------------------------------------------

export interface SyncSummary {
  readonly synced: number;
  readonly skipped: number;
  readonly errors: number;
  readonly errorDetails: readonly { billId: string; error: string }[];
}

// ---------------------------------------------------------------------------
// Public: syncRecentOutbounds
// ---------------------------------------------------------------------------

/**
 * 查询金蝶最近 N 小时内的出库单并同步。
 * 已作废单据跳过。
 */
export async function syncRecentOutbounds(hours = 24): Promise<SyncSummary> {
  const now = new Date();
  const from = new Date(now.getTime() - hours * 60 * 60 * 1000);

  const startBillDate = from.toISOString().slice(0, 10);
  const endBillDate = now.toISOString().slice(0, 10);

  const bills = await querySaleOutboundList({
    startBillDate,
    endBillDate,
    pageSize: 100,
  });

  let synced = 0;
  let skipped = 0;
  const errorDetails: { billId: string; error: string }[] = [];

  for (const bill of bills) {
    if (bill.status === "Voided") {
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
