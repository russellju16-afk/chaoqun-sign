export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold text-gray-900">超群签收</h1>
      <p className="mt-4 text-gray-600">粮油批发送货签收数字化系统</p>
      <div className="mt-8 flex gap-4">
        <a
          href="/admin"
          className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
        >
          管理后台
        </a>
        <a
          href="/driver"
          className="rounded-lg bg-green-600 px-6 py-3 text-white hover:bg-green-700"
        >
          司机端
        </a>
      </div>
    </main>
  );
}
