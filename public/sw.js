// Deliberately does no caching. This app shows live financial data, so an offline
// cache would risk serving stale balances/transactions -- the only job here is to
// satisfy PWA installability (which historically wants a registered service worker
// with a fetch handler). Every request just passes straight through to the network.
self.addEventListener("install", (event) => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
    event.respondWith(fetch(event.request));
});
