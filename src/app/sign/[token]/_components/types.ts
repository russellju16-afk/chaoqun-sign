// Shared types for the sign page

export interface OrderItem {
  id: string;
  productName: string;
  spec: string | null;
  unit: string;
  quantity: string; // decimal string
  unitPrice: string; // cents string
  amount: string; // cents string
  remark: string | null;
}

export interface OrderData {
  id: string;
  orderNo: string;
  customerName: string;
  customerAddress: string | null;
  deliveryDate: string; // ISO
  status: "PENDING" | "DELIVERED" | "SIGNED" | "REJECTED" | "CANCELLED";
  totalAmount: string; // cents string
  items: OrderItem[];
}

export interface SuccessData {
  signerName: string;
  signedAt: string; // ISO
  orderNo: string;
}

export type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "already_signed" }
  | { kind: "already_rejected" }
  | { kind: "cancelled" }
  | { kind: "form"; order: OrderData }
  | { kind: "submitting"; order: OrderData }
  | { kind: "success"; data: SuccessData };
