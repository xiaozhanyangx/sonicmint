/* 声刻 SonicMint PWA Service Worker：离线缓存静态资源 */
const CACHE = "sonicmint-v68";
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
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      if (new URL(e.request.url).origin === location.origin) {
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }))
  );
});
