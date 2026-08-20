const CACHE_NAME = "myfinance-assets-v1";
const STATIC_ASSETS = [
    "/",
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
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    // 1. Never cache API calls in Service Worker (API offline handling is managed by IndexedDB)
    if (url.pathname.startsWith("/api/")) {
        return;
    }

    // 2. Navigation requests (HTML document): Network-first with Cache fallback
    if (event.request.mode === "navigate") {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    return networkResponse;
                })
                .catch(() => {
                    return caches.match(event.request).then((cached) => {
                        return cached || caches.match("/");
                    });
                })
        );
        return;
    }

    // 3. Static assets (_next/static, images, fonts): Stale-while-revalidate / Cache-first
    if (
        url.pathname.startsWith("/_next/static/") ||
        url.pathname.startsWith("/_next/image") ||
        STATIC_ASSETS.includes(url.pathname)
    ) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                const fetchPromise = fetch(event.request)
                    .then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            const clone = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                        }
                        return networkResponse;
                    })
                    .catch(() => cachedResponse);

                return cachedResponse || fetchPromise;
            })
        );
    }
});
