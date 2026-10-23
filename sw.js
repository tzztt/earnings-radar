// Service Worker: hält die App offline verfügbar. Daten (Gist) werden NICHT hier gecacht,
// sondern von der App selbst im Browser-Speicher abgelegt.
const CACHE = "earnings-radar-v1";
const SHELL = ["./", "index.html", "app.css", "app.js", "screens.js", "manifest.webmanifest", "icon.svg",
  "icon-192.png", "icon-512.png", "apple-touch-icon.png", "demo.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Eigene Dateien: erst Netzwerk (damit Updates sofort ankommen), sonst Cache.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("index.html")))
  );
});
