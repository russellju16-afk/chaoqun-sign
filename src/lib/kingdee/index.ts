/**
 * Kingdee 云星辰 Open API — public barrel export.
 *
 * Import from "@/lib/kingdee" for all Kingdee-related functionality.
 */

// Auth (签名)
export { buildAppSignature, buildApiSignature } from "./auth";
export type { SignatureComponents } from "./auth";

// Base client
export { getAppToken, kingdeeRequest } from "./client";

// Types
export type {
  KingdeeBillStatus,
  KingdeeSaleOutbound,
  KingdeeSaleOutboundItem,
  SaleOutboundListData,
  SaleOutboundQueryParams,
} from "./types";

// Sales outbound operations
export {
  querySaleOutboundList,
  querySaleOutboundDetail,
  querySaleOutboundByNo,
  mapKingdeeToDeliveryOrder,
  buildItemsCreateData,
} from "./sales";

// Sync
export type { SyncSummary } from "./sync";
export {
  syncSaleOutbound,
  syncSaleOutboundByNo,
  syncRecentOutbounds,
} from "./sync";
