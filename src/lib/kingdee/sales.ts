/**
 * Kingdee 云星辰 — sales outbound (销售出库单) operations.
 *
 * API paths (JDY v2):
 *   - GET  /scm/sal_out_bound          — 查询出库单列表
 *   - GET  /scm/sal_out_bound_detail   — 查询单张出库单详情
 *
 * Field naming: 金蝶云星辰使用扁平 snake_case (NOT F-prefix 旗舰版风格).
 */

import { Prisma } from "@prisma/client";
import { kingdeeRequest } from "./client";
import type {
  KingdeeBillStatus,
  KingdeeSaleOutbound,
  KingdeeSaleOutboundItem,
  RawSaleOutboundRow,
  RawSaleOutboundDetail,
  RawSaleOutboundItem,
  SaleOutboundListData,
  SaleOutboundQueryParams,
} from "./types";

// ---------------------------------------------------------------------------
// Internal: raw → domain mappers
// ---------------------------------------------------------------------------

function mapBillStatus(raw: string): KingdeeBillStatus {
  if (raw === "Approved" || raw === "已审核") return "Approved";
  if (raw === "Voided" || raw === "已作废") return "Voided";
  return "Draft";
}

function mapRawItem(raw: RawSaleOutboundItem): KingdeeSaleOutboundItem {
  return {
    materialId: raw.material_id,
    materialName: raw.material_name ?? raw.material_number ?? "",
    unit: raw.unit_name ?? raw.unit_number ?? "",
    qty: raw.qty,
    price: raw.price,
    taxPrice: raw.tax_price ?? raw.price,
    amount: raw.all_amount ?? raw.amount ?? raw.price * raw.qty,
    remark: raw.comment ?? "",
  };
}

function mapDetailToDomain(raw: RawSaleOutboundDetail): KingdeeSaleOutbound {
  return {
    billId: raw.id,
    billNo: raw.bill_no,
    date: raw.bill_date,
    customerName: raw.customer_name ?? "",
    customerId: raw.customer_id,
    items: (raw.material_entity ?? []).map(mapRawItem),
    totalAmount: raw.all_amount ?? raw.total_amount ?? 0,
    status: mapBillStatus(raw.bill_status),
    remark: raw.remark ?? "",
  };
}

function mapRowToDomain(row: RawSaleOutboundRow): KingdeeSaleOutbound {
  return {
    billId: row.id,
    billNo: row.bill_no,
    date: row.bill_date,
    customerName: row.customer_name ?? "",
    customerId: row.customer_id,
    items: [], // 列表查询不含明细行
    totalAmount: row.all_amount ?? row.total_amount ?? 0,
    status: mapBillStatus(row.bill_status),
    remark: row.remark ?? "",
  };
}

// ---------------------------------------------------------------------------
// Public: querySaleOutboundList
// ---------------------------------------------------------------------------

/**
 * 查询销售出库单列表 (GET /scm/sal_out_bound)。
 *
 * 参数通过 query string 传递（金蝶云星辰 GET 接口规范）。
 */
export async function querySaleOutboundList(
  params: SaleOutboundQueryParams = {},
): Promise<readonly KingdeeSaleOutbound[]> {
  const { startBillDate, endBillDate, page = 1, pageSize = 50 } = params;

  const queryParams: Record<string, string> = {
    page: String(page),
    page_size: String(Math.min(pageSize, 100)),
  };
  if (startBillDate) queryParams.start_bill_date = startBillDate;
  if (endBillDate) queryParams.end_bill_date = endBillDate;

  const data = await kingdeeRequest<SaleOutboundListData>(
    "GET",
    "/scm/sal_out_bound",
    { params: queryParams },
  );

  return data.rows.map(mapRowToDomain);
}

// ---------------------------------------------------------------------------
// Public: querySaleOutboundDetail
// ---------------------------------------------------------------------------

/**
 * 查询单张销售出库单详情 (GET /scm/sal_out_bound_detail)。
 *
 * @param billId 金蝶内部单据 ID
 */
export async function querySaleOutboundDetail(
  billId: string,
): Promise<KingdeeSaleOutbound> {
  const data = await kingdeeRequest<RawSaleOutboundDetail>(
    "GET",
    "/scm/sal_out_bound_detail",
    { params: { id: billId } },
  );

  return mapDetailToDomain(data);
}

/**
 * 按单据编号查询出库单详情。
 *
 * @param billNo 金蝶单据编号（如 CKCK240001）
 */
export async function querySaleOutboundByNo(
  billNo: string,
): Promise<KingdeeSaleOutbound> {
  const data = await kingdeeRequest<RawSaleOutboundDetail>(
    "GET",
    "/scm/sal_out_bound_detail",
    { params: { number: billNo } },
  );

  return mapDetailToDomain(data);
}

// ---------------------------------------------------------------------------
// Yuan → fen conversion
// ---------------------------------------------------------------------------

function yuanToFen(yuan: number): bigint {
  return BigInt(Math.round(yuan * 100));
}

// ---------------------------------------------------------------------------
// Public: mapKingdeeToDeliveryOrder
// ---------------------------------------------------------------------------

/**
 * 从金蝶单号生成 CQ-YYYYMMDD-XXX 内部订单号。
 */
function buildOrderNo(bill: KingdeeSaleOutbound): string {
  const datePart = bill.date.replace(/-/g, "");
  const suffix = bill.billNo.slice(-3).padStart(3, "0");
  return `CQ-${datePart}-${suffix}`;
}

/**
 * 构建 DeliveryItem createMany 数据。
 */
export function buildItemsCreateData(
  bill: KingdeeSaleOutbound,
): Prisma.DeliveryItemCreateManyOrderInput[] {
  return bill.items.map((item) => ({
    kdMaterialId: item.materialId,
    productName: item.materialName,
    spec: null,
    unit: item.unit,
    quantity: new Prisma.Decimal(item.qty),
    unitPrice: yuanToFen(item.taxPrice),
    amount: yuanToFen(item.amount),
    remark: item.remark || null,
  }));
}

/**
 * 将金蝶出库单映射为 Prisma DeliveryOrder create payload。
 * 金额从元转分。
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
