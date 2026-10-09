/* 声刻 SonicMint PWA Service Worker：离线缓存静态资源 */
const CACHE = "sonicmint-v87";
const ASSETS = [
  "./",
  "./index.html",
  "./publish.html",
  "./rules.html",
  "./style.css",
  "./app.js",
  "./lang.js",
  "./ethers.min.js",
  "./manifest.json",
  "./icon.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // 导航请求交给浏览器：clean URL（如 /rules）会被 Pages 308 到 /rules.html，
  // 而 SW 不允许把「跟随过重定向」后的响应交给导航请求，否则报 ERR_FAILED
  if (e.request.mode === "navigate") return;
  // 网络优先：HTML 不走 SW，若子资源用 cache-first，新旧版本会混用
  //（新 HTML + 旧 JS）导致改动不生效；网络不可用时回落缓存，离线仍可用
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || Response.error()))
  );
});
