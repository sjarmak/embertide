// Self-destroying service worker.
//
// The game is served from a local-household dev server (no hosted deploy —
// see scripts/check-deploy.mjs). An old `vite preview` build once registered
// a caching service worker at this exact URL (`/sw.js`); it then kept
// serving stale assets (e.g. the pre-fix white-background boss art) because
// the dev server only returns the SPA HTML fallback here, so its update
// check never received valid worker code and the stale worker never died.
//
// Browsers re-fetch a registered worker's own script URL on navigation /
// ~24h to check for updates. Serving THIS file at `/sw.js` gives the stuck
// worker a valid byte-different update: on activate it unregisters itself,
// deletes every Cache Storage entry, and reloads open tabs so they fetch
// fresh from the network. After it runs once, no service worker remains.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) client.navigate(client.url);
    })(),
  );
});
