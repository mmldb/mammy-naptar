const CACHE = "mammy-calendar-v15";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=15",
  "./app.js?v=15",
  "./config.js",
  "./manifest.webmanifest?v=2",
  "./icons/icon-v2.svg",
  "./icons/heart-192-v2.png",
  "./icons/heart-512-v2.png",
  "./icons/heart-maskable-512-v2.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener("activate", event => event.waitUntil(
  Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))),
    self.clients.claim()
  ])
));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("./index.html")));
    return;
  }
  if (requestUrl.origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(cached => {
    const network = fetch(event.request).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
      return response;
    });
    return cached || network;
  }));
});
