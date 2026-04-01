// Service Worker — 超群签收司机端
// 策略：network-first，离线时降级到离线提示页

const CACHE_NAME = "chaoqun-sign-v1";
const OFFLINE_URL = "/offline.html";

// 安装阶段：预缓存离线页面
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  );
  // 立即激活，无需等待旧 SW 卸载
  self.skipWaiting();
});

// 激活阶段：清理旧版本缓存
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
  );
  // 立即接管所有已打开的页面
  self.clients.claim();
});

// 拦截导航请求：network-first，网络失败时返回离线页
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
  }
});
