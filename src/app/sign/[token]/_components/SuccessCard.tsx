import type { SuccessData } from "./types";
import { formatDateTime } from "./utils";

export function SuccessCard({ data }: { data: SuccessData }) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-8 shadow-sm text-center space-y-5">
        {/* Checkmark icon */}
        <div className="mx-auto w-20 h-20 rounded-full bg-green-50 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
        </div>

        <div>
          <p className="text-2xl font-bold text-green-600">签收成功！</p>
          <p className="mt-1 text-sm text-gray-500">感谢您的配合</p>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-left">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">送货单号</span>
            <span className="font-medium text-gray-800">{data.orderNo}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">签收人</span>
            <span className="font-medium text-gray-800">{data.signerName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">签收时间</span>
            <span className="font-medium text-gray-800">
              {formatDateTime(data.signedAt)}
            </span>
          </div>
        </div>

        <p className="text-xs text-gray-400">可关闭此页面</p>
      </div>
    </div>
  );
}
