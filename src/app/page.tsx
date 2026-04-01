// 品牌展示首页 —— 不暴露任何内部入口链接
export default function HomePage() {
  return (
    // 全屏蓝灰渐变背景
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-800 via-blue-900 to-slate-900 p-6">
      {/* 居中卡片 */}
      <div className="w-full max-w-sm rounded-2xl bg-white/10 px-10 py-12 text-center shadow-2xl backdrop-blur-sm">
        {/* Logo：蓝底白"超"字圆角方块 */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-600 shadow-lg">
          <span className="text-4xl font-bold text-white">超</span>
        </div>

        {/* 主标题 */}
        <h1 className="text-3xl font-bold tracking-wide text-white">
          超群签收
        </h1>

        {/* 副标题 */}
        <p className="mt-2 text-base text-blue-200">粮油批发送货签收数字化系统</p>

        {/* 分割线 */}
        <div className="my-8 h-px w-full bg-white/20" />

        {/* 公司名称 */}
        <p className="text-sm font-medium text-white/80">
          西安超群粮油贸易有限公司
        </p>

        {/* 提示文字 */}
        <p className="mt-6 text-xs text-white/40">如需登录，请联系管理员获取入口</p>
      </div>
    </main>
  );
}
