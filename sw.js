/* Service Worker – شركة فوزي عبده
   تطوير: بلال محمد سليمان | واتساب: 01128079357 | https://wa.me/201128079357
   غيّر VERSION مع كل تحديث للملفات ليصل التحديث للمستخدمين.
   الوضع دون اتصال = واجهة التطبيق فقط (البيانات والحفظ يحتاجان إنترنت). */
const VERSION = "v15";
const CACHE = "fawzy-" + VERSION;
const SHELL = [
  "./", "index.html", "app.js?v=15", "qr.js?v=15", "ext.js?v=15", "manifest.json",
  "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "452624.jpg",
  "mixer.png", "pump.png", "loader.png", "dump.png", "roller.png", "truck.png",   // صور المعدات
  "login-bg.jpg", "login-bg-m.jpg"                                                  // خلفيات تسجيل الدخول
];
const CDN_HOSTS = ["cdn.tailwindcss.com", "cdnjs.cloudflare.com", "cdn.jsdelivr.net", "www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => {
  // لا skipWaiting تلقائي: الصفحة تعرض زر "تحديث الآن" ثم ترسل SKIP_WAITING
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("fawzy-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", e => { if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting(); });

const staleWhileRevalidate = async req => {
  const cache = await caches.open(CACHE), hit = await cache.match(req);
  const net = fetch(req).then(res => { if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || Response.error();
};
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (req.mode === "navigate") {                                   // الصفحة: الشبكة أولاً ثم النسخة المخزنة
    e.respondWith(fetch(req).then(res => { const c = res.clone(); caches.open(CACHE).then(x => x.put("index.html", c)); return res; })
      .catch(async () => (await caches.match("index.html")) || (await caches.match("./")) || Response.error()));
    return;
  }
  if (url.origin === self.location.origin || CDN_HOSTS.includes(url.hostname)) e.respondWith(staleWhileRevalidate(req));
  // أي شيء آخر (Firebase / Firestore / ImgBB) يمر مباشرة للشبكة دون تخزين
});
