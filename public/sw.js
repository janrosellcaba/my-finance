const CACHE_NAME = "myfinance-assets-v3";
const STATIC_ASSETS = [
    "/manifest.json",
    "/favicon.ico",
    "/logo.png",
    "/icon-192.png",
    "/icon-512.png",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch(() => {});
        })
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    const url = new URL(request.url);

    if (request.method !== "GET" || url.origin !== location.origin) {
        return;
    }

    // Never intercept app code, APIs, or HTML. Caching Next chunks is what
    // kept the old Simple/Advanced analytics UI around after deploys.
    if (
        url.pathname.startsWith("/api/") ||
        url.pathname.startsWith("/_next/") ||
        request.mode === "navigate" ||
        request.headers.get("RSC") === "1" ||
        request.headers.get("Next-Router-State-Tree")
    ) {
        return;
    }

    if (!STATIC_ASSETS.includes(url.pathname)) {
        return;
    }

    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return fetch(request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                }
                return networkResponse;
            });
        })
    );
});
