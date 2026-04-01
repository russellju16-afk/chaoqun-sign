// Status card components: loading skeleton, error, already signed/rejected/cancelled

export function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="h-6 bg-gray-200 rounded w-3/5 mb-2" />
        <div className="h-4 bg-gray-100 rounded w-2/5" />
      </div>
      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="h-4 bg-gray-100 rounded w-4/5" />
        <div className="h-4 bg-gray-100 rounded w-3/5" />
      </div>
      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
        <div className="h-11 bg-gray-100 rounded-xl" />
        <div className="h-11 bg-gray-100 rounded-xl" />
      </div>
      <div className="h-12 bg-gray-200 rounded-xl" />
    </div>
  );
}

export function ErrorCard({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm text-center space-y-4">
      <div className="mx-auto w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
      </div>
      <div>
        <p className="text-lg font-semibold text-gray-800">链接无效或已过期</p>
        <p className="mt-1 text-sm text-gray-500">{message}</p>
      </div>
      <p className="text-xs text-gray-400">
        如有疑问，请联系配送司机重新发送签收链接
      </p>
    </div>
  );
}

export function AlreadySignedCard() {
  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm text-center space-y-4">
      <div className="mx-auto w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-green-500"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <div>
        <p className="text-lg font-semibold text-gray-800">该订单已签收</p>
        <p className="mt-1 text-sm text-gray-500">
          此送货单已完成签收，无需重复操作
        </p>
      </div>
    </div>
  );
}

export function AlreadyRejectedCard() {
  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm text-center space-y-4">
      <div className="mx-auto w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-orange-500"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <div>
        <p className="text-lg font-semibold text-gray-800">该订单已拒收</p>
        <p className="mt-1 text-sm text-gray-500">此送货单已被标记为拒收</p>
      </div>
    </div>
  );
}

export function CancelledCard() {
  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm text-center space-y-4">
      <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
          />
        </svg>
      </div>
      <div>
        <p className="text-lg font-semibold text-gray-800">该订单已取消</p>
        <p className="mt-1 text-sm text-gray-500">此送货单已被取消</p>
      </div>
    </div>
  );
}
