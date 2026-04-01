/**
 * Kingdee 云星辰 — sales outbound (销售出库单) operations.
 *
 * Covers:
 *   - Listing bills with optional date / status / pagination filters
 *   - Fetching a single bill with full line-item detail
 *   - Transforming a Kingdee bill into a Prisma DeliveryOrder create payload
 */

import { Prisma } from "@prisma/client";
import { kingdeeRequest } from "./client";
import {
  KingdeeBillStatus,
  KingdeeBillListData,
  KingdeeSaleOutbound,
  KingdeeSaleOutboundItem,
  RawKingdeeSaleOutbound,
  RawKingdeeItem,
  SaleOutboundQueryParams,
} from "./types";

// ---------------------------------------------------------------------------
// Internal: raw-to-domain mappers
// ---------------------------------------------------------------------------

function mapRawItem(raw: RawKingdeeItem): KingdeeSaleOutboundItem {
  return {
    materialId: raw.FMaterialId,
    materialName: raw.FMaterialName,
    spec: raw.FSpecification ?? "",
    unit: raw.FUnitName,
    qty: raw.FRealQty,
    price: raw.FTaxPrice,
    amount: raw.FAmount,
    remark: raw.FNote ?? "",
  };
}

function mapRawBill(raw: RawKingdeeSaleOutbound): KingdeeSaleOutbound {
  return {
    billId: raw.FBillId,
    billNo: raw.FBillNo,
    date: raw.FDate,
    customerName: raw.FCustName,
    customerId: raw.FCustId,
    items: (raw.FEntity ?? []).map(mapRawItem),
    totalAmount: raw.FAllAmount,
    // Fall back to Draft if the API returns an unexpected status code.
    status:
      (raw.FDocumentStatus as KingdeeBillStatus) ?? KingdeeBillStatus.Draft,
    remark: raw.FNote ?? "",
  };
}

// ---------------------------------------------------------------------------
// Public: querySaleOutboundList
// ---------------------------------------------------------------------------

/**
 * Query the sales outbound bill list with optional filters.
 *
 * @returns Array of domain-shaped bills (without full item detail).
 */
export async function querySaleOutboundList(
  params: SaleOutboundQueryParams = {},
): Promise<readonly KingdeeSaleOutbound[]> {
  const { dateFrom, dateTo, status, page = 1, pageSize = 50 } = params;

  const body: Record<string, unknown> = {
    page,
    pageSize,
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
    ...(status ? { status } : {}),
  };

  const data = await kingdeeRequest<KingdeeBillListData>(
    "POST",
    "/jdyconnector/app_management/api/scm/saleoutbound/list",
    body,
  );

  return data.rows.map(mapRawBill);
}

// ---------------------------------------------------------------------------
// Public: querySaleOutboundDetail
// ---------------------------------------------------------------------------

/**
 * Fetch a single sales outbound bill by its Kingdee bill ID, including
 * full line-item detail.
 */
export async function querySaleOutboundDetail(
  billId: string,
): Promise<KingdeeSaleOutbound> {
  const data = await kingdeeRequest<RawKingdeeSaleOutbound>(
    "POST",
    "/jdyconnector/app_management/api/scm/saleoutbound/detail",
    { billId },
  );

  return mapRawBill(data);
}

// ---------------------------------------------------------------------------
// Yuan → fen conversion
// ---------------------------------------------------------------------------

/**
 * Convert a yuan (元) float to integer fen (分).
 * Uses Math.round to avoid IEEE-754 floating-point drift.
 */
function yuanToFen(yuan: number): bigint {
  return BigInt(Math.round(yuan * 100));
}

// ---------------------------------------------------------------------------
// Public: mapKingdeeToDeliveryOrder
// ---------------------------------------------------------------------------

/**
 * Generate a CQ-YYYYMMDD-XXX order number from a Kingdee bill.
 *
 * The suffix is derived from the last 3 characters of the Kingdee bill
 * number to keep it deterministic and short. If the bill number is shorter,
 * we zero-pad on the left.
 */
function buildOrderNo(bill: KingdeeSaleOutbound): string {
  const datePart = bill.date.replace(/-/g, ""); // "YYYYMMDD"
  const suffix = bill.billNo.slice(-3).padStart(3, "0");
  return `CQ-${datePart}-${suffix}`;
}

/**
 * Build the `DeliveryItemCreateManyOrderInput[]` array for a bill's line
 * items. Exported so that the sync layer can reuse it in update operations
 * without having to unwrap the opaque nested-write type on the create payload.
 */
export function buildItemsCreateData(
  bill: KingdeeSaleOutbound,
): Prisma.DeliveryItemCreateManyOrderInput[] {
  return bill.items.map((item) => ({
    kdMaterialId: item.materialId,
    productName: item.materialName,
    spec: item.spec || null,
    unit: item.unit,
    quantity: new Prisma.Decimal(item.qty),
    unitPrice: yuanToFen(item.price),
    amount: yuanToFen(item.amount),
    remark: item.remark || null,
  }));
}

/**
 * Transform a Kingdee sales outbound bill into a Prisma DeliveryOrder
 * `create` input payload.
 *
 * Monetary amounts are converted from yuan (float) to fen (BigInt).
 * The returned shape matches `Prisma.DeliveryOrderCreateInput` so it can
 * be passed directly to `prisma.deliveryOrder.create({ data: ... })`.
 */
export function mapKingdeeToDeliveryOrder(
  bill: KingdeeSaleOutbound,
): Prisma.DeliveryOrderCreateInput {
  const deliveryDate = new Date(`${bill.date}T00:00:00+08:00`);

  return {
    orderNo: buildOrderNo(bill),
    kdBillId: bill.billId,
    kdBillNo: bill.billNo,
    customerName: bill.customerName,
    totalAmount: yuanToFen(bill.totalAmount),
    deliveryDate,
    status: "PENDING",
    items: {
      createMany: { data: buildItemsCreateData(bill) },
    },
  };
}
