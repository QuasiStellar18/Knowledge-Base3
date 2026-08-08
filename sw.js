const CACHE_NAME = "knowledge-discord-v38";
const ASSETS = [
    "./",
    "./index.html",
    "./style.css?v=38",
    "./db.js?v=38",
    "./app.js?v=38",
    "./manifest.json"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cached) => cached || fetch(event.request))
    );
});
