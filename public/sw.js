// Self-unregistering service worker. An old version of the site registered a
// worker; this one replaces it, clears its caches, reloads open tabs and
// removes itself. waitUntil keeps the browser from stopping it halfway.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await self.clients.claim()
    const keys = await caches.keys()
    await Promise.all(keys.map(k => caches.delete(k)))
    await self.registration.unregister()
    const clients = await self.clients.matchAll({ type: 'window' })
    clients.forEach(c => c.navigate(c.url))
  })())
})
