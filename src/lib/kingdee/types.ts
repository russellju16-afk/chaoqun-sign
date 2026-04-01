/**
 * Kingdee 云星辰 Open API — shared type definitions.
 *
 * Field naming convention:
 *   - All types here use English camelCase property names.
 *   - Raw API shapes (prefixed with `Raw`) use the Chinese / snake_case
 *     field names that the Kingdee wire format actually sends.
 */

// ---------------------------------------------------------------------------
// Generic API envelope
// ---------------------------------------------------------------------------

export interface KingdeeApiResponse<T> {
  readonly code: number;
  /** Human-readable status message. Non-empty when code !== 0. */
  readonly message: string;
  readonly data: T;
}

// ---------------------------------------------------------------------------
// Token response
// ---------------------------------------------------------------------------

export interface KingdeeTokenData {
  readonly access_token: string;
  /** Lifetime in seconds. */
  readonly expires_in: number;
  readonly token_type: string;
}

// ---------------------------------------------------------------------------
// Bill status
// ---------------------------------------------------------------------------

/**
 * 销售出库单 status codes as returned by Kingdee.
 *
 * A  = 草稿 (draft)
 * B  = 已审核 (approved)
 * C  = 部分出库 (partially shipped)
 * D  = 完全出库 (fully shipped)
 * X  = 已作废 (voided)
 */
export enum KingdeeBillStatus {
  Draft = "A",
  Approved = "B",
  PartiallyShipped = "C",
  FullyShipped = "D",
  Voided = "X",
}

// ---------------------------------------------------------------------------
// Raw wire shapes (field names from the Kingdee API)
// ---------------------------------------------------------------------------

export interface RawKingdeeItem {
  readonly FMaterialId: string;
  readonly FMaterialName: string;
  readonly FSpecification: string;
  readonly FUnitName: string;
  readonly FRealQty: number;
  readonly FTaxPrice: number;
  readonly FAmount: number;
  readonly FNote?: string;
}

export interface RawKingdeeSaleOutbound {
  readonly FBillId: string;
  readonly FBillNo: string;
  readonly FDate: string; // "YYYY-MM-DD"
  readonly FCustName: string;
  readonly FCustId: string;
  readonly FEntity: RawKingdeeItem[];
  readonly FAllAmount: number;
  readonly FDocumentStatus: string; // maps to KingdeeBillStatus
  readonly FNote?: string;
}

// ---------------------------------------------------------------------------
// Domain types (English field names, used inside our application)
// ---------------------------------------------------------------------------

export interface KingdeeSaleOutboundItem {
  readonly materialId: string;
  readonly materialName: string;
  readonly spec: string;
  readonly unit: string;
  readonly qty: number;
  /** Unit price in yuan (float). */
  readonly price: number;
  /** Line amount in yuan (float). */
  readonly amount: number;
  readonly remark: string;
}

export interface KingdeeSaleOutbound {
  readonly billId: string;
  readonly billNo: string;
  /** ISO date string, e.g. "2024-01-15". */
  readonly date: string;
  readonly customerName: string;
  readonly customerId: string;
  readonly items: readonly KingdeeSaleOutboundItem[];
  /** Total amount in yuan (float). */
  readonly totalAmount: number;
  readonly status: KingdeeBillStatus;
  readonly remark: string;
}

// ---------------------------------------------------------------------------
// List query params and response
// ---------------------------------------------------------------------------

export interface SaleOutboundQueryParams {
  readonly dateFrom?: string; // "YYYY-MM-DD"
  readonly dateTo?: string;   // "YYYY-MM-DD"
  readonly status?: KingdeeBillStatus;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface KingdeeBillListData {
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly rows: readonly RawKingdeeSaleOutbound[];
}
