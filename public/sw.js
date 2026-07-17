// Minimaler Service Worker für die PWA (installierbar + Basis-Offline).
// Cache-Version bei relevanten Änderungen erhöhen -> alte Caches werden
// beim Aktivieren automatisch gelöscht.
const CACHE = "markt-dashboard-v3";
const APP_SHELL = ["/", "/manifest.json", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)),
  );
  // Neuen Service Worker sofort übernehmen lassen.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Erlaubt der Seite, ein wartendes Update sofort zu aktivieren.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api")) return;

  // Seitenaufrufe (HTML) immer frisch aus dem Netz holen, damit neue
  // Versionen sofort erscheinen; Cache nur als Offline-Fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        // Offline-Fallback: erst die konkrete Seite, dann die App-Shell.
        // Wichtig: Niemals `undefined` zurückgeben (sonst wirft respondWith
        // "Failed to convert value to 'Response'").
        const cached = (await caches.match(request)) || (await caches.match("/"));
        return (
          cached ||
          new Response("Offline", {
            status: 503,
            statusText: "Offline",
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          })
        );
      }),
    );
    return;
  }

  // Übrige GET-Assets: Netz zuerst, Cache aktuell halten, offline aus Cache.
  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches
          .open(CACHE)
          .then((cache) => cache.put(request, copy))
          .catch(() => {});
        return res;
      })
      .catch(() => caches.match(request)),
  );
});
