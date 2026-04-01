/**
 * Kingdee 云星辰 Open API — public barrel export.
 *
 * Import from "@/lib/kingdee" for all Kingdee-related functionality.
 */

// Base client
export { getAccessToken, kingdeeRequest } from "./client";

// Types
export type {
  KingdeeApiResponse,
  KingdeeTokenData,
  KingdeeSaleOutbound,
  KingdeeSaleOutboundItem,
  KingdeeBillListData,
  SaleOutboundQueryParams,
} from "./types";
export { KingdeeBillStatus } from "./types";

// Sales outbound operations
export {
  querySaleOutboundList,
  querySaleOutboundDetail,
  mapKingdeeToDeliveryOrder,
  buildItemsCreateData,
} from "./sales";

// Sync
export type { SyncSummary } from "./sync";
export { syncSaleOutbound, syncRecentOutbounds } from "./sync";
