import type { OrderData } from "./types";
import { formatCents, formatDate, parseDecimal } from "./utils";

interface OrderCardProps {
  order: OrderData;
}

export function OrderHeaderCard() {
  return (
    <div className="bg-white rounded-2xl px-5 py-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">超群粮油</h1>
          <p className="text-xs text-gray-500">送货签收确认</p>
        </div>
      </div>
    </div>
  );
}

export function OrderInfoCard({ order }: OrderCardProps) {
  return (
    <div className="bg-white rounded-2xl px-5 py-5 shadow-sm space-y-3">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
        订单信息
      </h2>
      <div className="space-y-2">
        <div className="flex justify-between items-start gap-2">
          <span className="text-sm text-gray-500 shrink-0">送货单号</span>
          <span className="text-sm font-medium text-gray-800 text-right break-all">
            {order.orderNo}
          </span>
        </div>
        <div className="flex justify-between items-start gap-2">
          <span className="text-sm text-gray-500 shrink-0">送货日期</span>
          <span className="text-sm font-medium text-gray-800">
            {formatDate(order.deliveryDate)}
          </span>
        </div>
        <div className="flex justify-between items-start gap-2">
          <span className="text-sm text-gray-500 shrink-0">收货客户</span>
          <span className="text-sm font-medium text-gray-800 text-right">
            {order.customerName}
          </span>
        </div>
        {order.customerAddress && (
          <div className="flex justify-between items-start gap-2">
            <span className="text-sm text-gray-500 shrink-0">送货地址</span>
            <span className="text-sm text-gray-600 text-right">
              {order.customerAddress}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function OrderItemsCard({ order }: OrderCardProps) {
  return (
    <div className="bg-white rounded-2xl px-5 py-5 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        货品明细
      </h2>
      <div className="divide-y divide-gray-50">
        {order.items.map((item) => (
          <div key={item.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {item.productName}
                </p>
                {item.spec && (
                  <p className="text-xs text-gray-400 mt-0.5">{item.spec}</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">
                  {parseDecimal(item.quantity)} {item.unit} ×{" "}
                  {formatCents(item.unitPrice)}
                </p>
              </div>
              <span className="text-sm font-semibold text-gray-800 shrink-0">
                {formatCents(item.amount)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
        <span className="text-sm font-semibold text-gray-700">合计金额</span>
        <span className="text-xl font-bold text-blue-600">
          {formatCents(order.totalAmount)}
        </span>
      </div>
    </div>
  );
}
