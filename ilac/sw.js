// İlaç Saatim — service worker
// Uygulamanın telefona yüklenebilmesi, internet yokken açılması ve bildirim düğmelerinin çalışması için.
const CACHE = "ilac-v3";
const SHELL = ["/ilac/", "/ilac/manifest.json", "/ilac/icon-192.png", "/ilac/icon-512.png", "/ilac/apple-touch-icon.png", "/ilac/logo.png"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("ilac-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Önce internetteki en yeni sürüm; internet yoksa kaydedilen sürüm
self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || !url.pathname.startsWith("/ilac/")) return;
  const sayfa = req.mode === "navigate" || url.pathname === "/ilac/" || url.pathname.endsWith(".html");
  e.respondWith(
    fetch(sayfa ? new Request(req.url.split("?")[0], { cache: "no-store" }) : req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(sayfa ? "/ilac/" : req, copy)); }
      return res;
    }).catch(() => caches.match(sayfa ? "/ilac/" : req).then(r => r || caches.match("/ilac/")))
  );
});

// Bildirime veya düğmelerine ("Aldım", "10 dk ertele") dokununca
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const veri = e.notification.data || {};
  const islem = e.action === "aldim" || e.action === "ertele" ? e.action : "";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      const acik = list.find(c => new URL(c.url).pathname.startsWith("/ilac/"));
      if (acik) {
        acik.postMessage(islem ? { tip: islem, dozlar: veri.dozlar, gun: veri.gun } : { tip: "kontrol" });
        return acik.focus();
      }
      let adres = "/ilac/";
      if (islem && veri.dozlar) adres += `?islem=${islem}&gun=${encodeURIComponent(veri.gun)}&d=${encodeURIComponent(JSON.stringify(veri.dozlar))}`;
      return self.clients.openWindow(adres);
    })
  );
});
