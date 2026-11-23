// Unity's service worker. It lets the app install to a home screen, opens the last copy of the
// app when there's no signal at a festival, and shows push alerts. It never caches /api.
const SHELL = 'unity-shell-v2'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return
  // The page: try the network, fall back to the last copy we saw.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(SHELL).then((c) => c.put('/', copy))
          return res
        })
        .catch(() => caches.match('/').then((r) => r ?? Response.error())),
    )
    return
  }
  // Built files have unique names, so a cached copy is always the right one.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icon')) {
    event.respondWith(
      caches.match(req).then((hit) => hit ?? fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(SHELL).then((c) => c.put(req, copy))
        }
        return res
      })),
    )
  }
})

// Push alerts: a new message, or a festival coming up.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Unity', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag,
      data: { url: data.url || '#/' },
    }),
  )
})

// Tapping an alert opens Unity at the right place, reusing an open window if there is one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL('/' + (event.notification.data?.url || '#/'), self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => new URL(c.url).origin === self.location.origin)
      if (open) return open.navigate(target).then((c) => (c ?? open).focus())
      return self.clients.openWindow(target)
    }),
  )
})
