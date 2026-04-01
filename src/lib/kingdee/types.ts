/**
 * Kingdee 云星辰 Open API — shared type definitions.
 *
 * 金蝶云星辰（JDY）使用扁平 snake_case 字段名，NOT F-prefix 旗舰版风格。
 * 所有类型基于实际 API 响应结构定义。
 */

// ---------------------------------------------------------------------------
// Bill status
// ---------------------------------------------------------------------------

/**
 * 销售出库单审核状态。
 * 金蝶云星辰实际返回的 bill_status 值。
 */
export type KingdeeBillStatus =
  | "Draft"       // 草稿（未审核）
  | "Approved"    // 已审核
  | "Voided";     // 已作废

// ---------------------------------------------------------------------------
// Raw API response shapes (from GET /scm/sal_out_bound)
// ---------------------------------------------------------------------------

/** 出库单列表查询 — 单行记录。 */
export interface RawSaleOutboundRow {
  readonly id: string;
  readonly bill_no: string;
  readonly bill_date: string; // "YYYY-MM-DD"
  readonly customer_id: string;
  readonly customer_name: string;
  readonly customer_number: string;
  readonly bill_status: string;
  readonly total_amount?: number;
  readonly all_amount?: number;
  readonly remark?: string;
}

/** 出库单列表查询 — 响应 data 结构。 */
export interface SaleOutboundListData {
  readonly total: number;
  readonly page: number;
  readonly page_size: number;
  readonly rows: readonly RawSaleOutboundRow[];
}

/** 出库单明细行（from GET /scm/sal_out_bound_detail）。 */
export interface RawSaleOutboundItem {
  readonly material_id: string;
  readonly material_name?: string;
  readonly material_number?: string;
  readonly unit_id: string;
  readonly unit_name?: string;
  readonly unit_number?: string;
  readonly stock_id: string;
  readonly stock_name?: string;
  readonly stock_number?: string;
  readonly qty: number;
  readonly price: number;
  readonly tax_price?: number;
  readonly amount?: number;
  readonly all_amount?: number;
  readonly comment?: string;
  readonly batch_no?: string;
}

/** 出库单详情 — 响应 data 结构。 */
export interface RawSaleOutboundDetail {
  readonly id: string;
  readonly bill_no: string;
  readonly bill_date: string;
  readonly bill_status: string;
  readonly customer_id: string;
  readonly customer_name: string;
  readonly customer_number?: string;
  readonly remark?: string;
  readonly total_amount?: number;
  readonly all_amount?: number;
  readonly material_entity: readonly RawSaleOutboundItem[];
}

// ---------------------------------------------------------------------------
// Domain types (application-side, English camelCase)
// ---------------------------------------------------------------------------

export interface KingdeeSaleOutboundItem {
  readonly materialId: string;
  readonly materialName: string;
  readonly unit: string;
  readonly qty: number;
  /** 不含税单价（元） */
  readonly price: number;
  /** 含税单价（元） */
  readonly taxPrice: number;
  /** 行金额（元） */
  readonly amount: number;
  readonly remark: string;
}

export interface KingdeeSaleOutbound {
  readonly billId: string;
  readonly billNo: string;
  readonly date: string; // "YYYY-MM-DD"
  readonly customerName: string;
  readonly customerId: string;
  readonly items: readonly KingdeeSaleOutboundItem[];
  /** 合计金额（元） */
  readonly totalAmount: number;
  readonly status: KingdeeBillStatus;
  readonly remark: string;
}

// ---------------------------------------------------------------------------
// List query params
// ---------------------------------------------------------------------------

export interface SaleOutboundQueryParams {
  readonly startBillDate?: string; // "YYYY-MM-DD"
  readonly endBillDate?: string;   // "YYYY-MM-DD"
  readonly page?: number;
  readonly pageSize?: number;
}
