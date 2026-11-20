// Dolapta Ne Var? — service worker
// Uygulama kabuğunu önbelleğe alır; böylece telefona "yüklenebilir" ve internet yokken de açılır.
// Kural: her zaman önce internetteki EN YENİ sürüm; internet yoksa son kaydedilen sürüm.
const CACHE = "dnv-v9";
const SHELL = ["/", "/index.html", "/manifest.json", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png", "/logo.png"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);
  // API, istatistik ve başka sitelere giden isteklere karışma
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/_vercel/")) return;
  const sayfa = req.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith(".html");
  e.respondWith(
    // Sayfanın kendisi tarayıcı önbelleğini de atlayarak her seferinde taze indirilir
    fetch(sayfa ? new Request(req, { cache: "no-store" }) : req).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(sayfa ? "/" : req, copy));
      }
      return res;
    }).catch(() => caches.match(sayfa ? "/" : req).then(r => r || caches.match("/")))
  );
});
