const CACHE_NAME = "myfinance-assets-v2";
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
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // 1. Only handle GET requests from the same origin
    if (request.method !== "GET" || url.origin !== location.origin) {
        return;
    }

    // 2. Never intercept API calls, Next.js RSC flight streams, or dev/HMR bundles
    if (
        url.pathname.startsWith("/api/") ||
        request.headers.get("RSC") === "1" ||
        request.headers.get("Next-Router-State-Tree") ||
        url.pathname.includes("_next/webpack") ||
        url.pathname.includes("_next/static/webpack") ||
        url.pathname.includes("__nextjs")
    ) {
        return;
    }

    // 3. Static assets (_next/static chunks, images, icons, fonts)
    if (
        url.pathname.startsWith("/_next/static/") ||
        url.pathname.startsWith("/_next/image") ||
        STATIC_ASSETS.includes(url.pathname)
    ) {
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
        return;
    }

    // 4. HTML document navigation (only in full offline fallback)
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request).catch(() => {
                return caches.match("/").then((cached) => cached || caches.match(request));
            })
        );
    }
});
