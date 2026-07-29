self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', async () => {
  await self.clients.claim()
  const keys = await caches.keys()
  await Promise.all(keys.map(k => caches.delete(k)))
  const clients = await self.clients.matchAll({ type: 'window' })
  clients.forEach(c => c.navigate(c.url))
  await self.registration.unregister()
})
