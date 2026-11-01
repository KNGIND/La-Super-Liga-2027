/* Service Worker de La Súper Liga 2027.
   Lo genera el build (vite.config.ts) reemplazando __VERSION__ y __PRECACHE__.
   - Archivos de la app: se guardan al instalar (precache) → la app abre sin conexión.
   - Navegación: siempre devuelve index.html guardado (app de una sola página).
   - Archivos propios: "caché primero" (están versionados por nombre).
   - Supabase y otros orígenes: SIEMPRE a la red (los datos los cachea la app en IndexedDB,
     así puede distinguir datos confirmados de datos guardados).
   - Para forzar actualización, el build cambia __VERSION__ solo. */
const VERSION = 'lsl27-__VERSION__';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)));
  // NO hacemos skipWaiting solo: la app avisa "Hay una versión nueva" y el usuario decide.
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('lsl27-') && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('index.html').then((r) => r || fetch(req)).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const link = (e.notification.data && e.notification.data.link) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((cs) => {
      const c = cs[0];
      if (c) { c.focus(); c.navigate(self.registration.scope + '#' + link); }
      else self.clients.openWindow(self.registration.scope + '#' + link);
    }),
  );
});
