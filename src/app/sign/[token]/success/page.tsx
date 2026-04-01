// Static success fallback page — shown when the user navigates back after signing

export default function SuccessFallbackPage() {
  return (
    <div className="bg-white rounded-2xl p-10 shadow-sm text-center space-y-5 mt-4">
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
        <p className="text-2xl font-bold text-green-600">签收成功</p>
        <p className="mt-2 text-sm text-gray-500">您已完成签收</p>
      </div>

      <p className="text-xs text-gray-400">可关闭此页面</p>
    </div>
  );
}
