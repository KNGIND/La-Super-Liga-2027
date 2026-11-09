/* SERVICE WORKER · La Súper Liga 2027  (hace que la app abra sin conexión)
   - Archivos propios: "red primero": si hay internet siempre ves la versión más nueva; si no hay, usa la guardada.
   - Supabase y otros orígenes: SIEMPRE a la red (los datos los guarda la app en IndexedDB,
     así puede distinguir datos confirmados de datos guardados).
   - Al instalarse guarda los archivos de PRECACHE. Los que agregues después se guardan solos la primera vez que se usan.
   - Cuando cambies código y quieras que los usuarios vean el aviso "Hay una versión nueva", cambiá VERSION. */
const VERSION = 'lsl27-2027.4.1';
const PRECACHE = ["index.html","manifest.webmanifest","src/animations/rive/index.js","src/animations/transitions/index.js","src/components/buttons/index.js","src/components/cards/crest.js","src/components/cards/match-card.js","src/components/cards/news-card.js","src/components/cards/player-card.js","src/components/cards/team-card.js","src/components/header/index.js","src/components/icons.js","src/components/inputs/index.js","src/components/loaders/index.js","src/components/modals/index.js","src/components/navigation/index.js","src/components/sidebar/index.js","src/components/welcome/index.js","src/core/app.js","src/core/config.js","src/core/events.js","src/core/layers.js","src/core/lifecycle.js","src/core/navigation.js","src/core/prefs.js","src/core/router.js","src/core/screen.js","src/core/status.js","src/data/seed.js","src/features/about/index.js","src/features/admin/creator.js","src/features/admin/csv.js","src/features/admin/index.js","src/features/admin/schemas.js","src/features/admin/templates.js","src/features/editor/index.js","src/features/editor/selector.js","src/features/editor/sheet.js","src/features/home/index.js","src/features/matches/detail.js","src/features/matches/index.js","src/features/news/detail.js","src/features/news/index.js","src/features/notifications/index.js","src/features/players/index.js","src/features/predictions/index.js","src/features/predictions/scoring.js","src/features/profile/index.js","src/features/registry.js","src/features/search/index.js","src/features/squads/index.js","src/features/standings/index.js","src/features/teams/detail.js","src/features/teams/index.js","src/features/tournaments/index.js","src/main.js","src/mods/registry.js","src/services/data/index.js","src/services/data/legacy-adapter.js","src/services/data/predictions.js","src/services/data/schema.js","src/services/data/selectors.js","src/services/mods/index.js","src/services/mods/overrides.js","src/services/mods/runtime.js","src/services/mods/safe.js","src/services/mods/store.js","src/services/notifications/index.js","src/services/storage/kv.js","src/services/supabase/auth.js","src/services/supabase/client.js","src/services/supabase/realtime.js","src/services/user.js","src/styles/animations.css","src/styles/components.css","src/styles/design-tokens.css","src/styles/editor.css","src/styles/global.css","src/styles/layout.css","src/styles/liquid-glass.css","src/styles/responsive.css","src/styles/screens.css","src/styles/themes.css","src/styles/utilities.css","src/utils/color.js","src/utils/dom.js","src/utils/format.js","src/utils/image.js","src/utils/lineup.js","src/utils/zip.js","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","icons/icon.svg"];

self.addEventListener('install', (e) => {
  // Cada archivo por separado: si uno falla, los demás igual se guardan.
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(PRECACHE.map((f) => c.add(f).catch(() => {})))));
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
    e.respondWith(fetch(req).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })),
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
