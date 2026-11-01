/* ARRANQUE DE LA APP
   Orden: preferencias → armar estructura → datos (instantáneo desde caché/seed) → router → servicios en segundo plano. */
import { renderDock, renderRail, syncActive } from '@/components/navigation';
import { renderHeader } from '@/components/header';
import { openDrawer } from '@/components/sidebar';
import { toast } from '@/components/modals';
import { APP, EXPERIMENTAL } from './config';
import { bus } from './events';
import { applyUpdate, installTvNavigation, registerServiceWorker, updateAvailable } from './lifecycle';
import { installSwipe } from './navigation';
import { applyPrefs } from './prefs';
import { back, currentRoute, navigate, resolve, startRouter } from './router';
import { getData, getStatus, initData, refresh } from '@/services/data';
import { loadPredictions } from '@/services/data/predictions';
import { initNotifications, unreadCount } from '@/services/notifications';
import { loadProfile } from '@/services/supabase/auth';
import { initialOf, initUser } from '@/services/user';
import { getSession } from '@/services/supabase/client';
import { relativeTime } from './status';
import { esc } from '@/utils/dom';
import { icon } from '@/components/icons';

function shellHtml(): string {
  return `
    <div class="skip"><a href="#view" data-skip>Saltar al contenido</a></div>
    <header class="appbar" id="appbar"></header>
    <aside class="rail" id="rail" aria-label="Navegación principal"></aside>
    <div id="banner" class="banner" hidden></div>
    <main id="view" class="view" tabindex="-1"></main>
    <nav class="dock" id="dock" aria-label="Navegación principal"></nav>`;
}

function renderChrome(): void {
  const d = getData();
  const hit = resolve(currentRoute() || '/');
  const immersive = !!hit?.feature.immersive;
  const appbar = document.getElementById('appbar')!;
  appbar.innerHTML = renderHeader({ unread: unreadCount(), initial: initialOf(), logo: d.league.logo, name: d.league.name }, immersive, hit?.feature.title ?? '');
  document.getElementById('dock')!.innerHTML = renderDock();
  document.getElementById('rail')!.innerHTML = renderRail();
}

/** Franja de aviso: sin conexión, datos guardados, solo lectura, actualización disponible. */
function renderBanner(): void {
  const b = document.getElementById('banner')!;
  const st = getStatus();
  let html = '';
  if (updateAvailable()) {
    html = `<span>${icon('refresh', 16)} Hay una versión nueva de la app.</span><button class="btn btn--sm btn--primary" data-update>Actualizar</button>`;
  } else if (!navigator.onLine) {
    html = `<span>${icon('wifi-off', 16)} Sin conexión. Mostrando datos guardados${st.syncedAt ? ` (${esc(relativeTime(st.syncedAt))})` : ''}.</span>`;
  } else if (st.mode === 'legacy') {
    html = `<span>${icon('database', 16)} Leyendo los datos de la app anterior (solo lectura). Ejecutá las migraciones para editar desde acá.</span>`;
  } else if (st.error && st.origin !== 'server') {
    html = `<span>${icon('wifi-off', 16)} ${esc(st.error)} Mostrando datos guardados${st.syncedAt ? ` (${esc(relativeTime(st.syncedAt))})` : ''}.</span><button class="btn btn--sm" data-retry>Reintentar</button>`;
  }
  b.hidden = !html;
  b.innerHTML = html;
}

export async function boot(): Promise<void> {
  applyPrefs();
  const root = document.getElementById('app')!;
  root.innerHTML = shellHtml();

  // 1) Datos instantáneos (caché o ejemplo), 2) pantalla, 3) el resto en segundo plano
  await initData();
  await initUser();
  renderChrome();
  renderBanner();
  startRouter();
  document.getElementById('splash')?.remove();
  if (EXPERIMENTAL.tvNavigation) installTvNavigation();
  installSwipe(document.getElementById('view')!);
  registerServiceWorker();

  bus.on('data', () => { renderChrome(); renderBanner(); });
  bus.on('connection', renderBanner);
  bus.on('session', renderChrome);
  bus.on('prefs', renderChrome);
  bus.on('route', () => { renderChrome(); syncActive(); const v = document.getElementById('view'); if (v && !document.documentElement.classList.contains('has-layer')) v.focus({ preventScroll: true }); });
  addEventListener('online', () => void refresh());

  // Un enlace tocado con una capa abierta (menú, modal) primero cierra la capa y después navega:
  // así el historial queda limpio y el botón "atrás" se comporta bien.
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || !document.documentElement.classList.contains('has-layer')) return;
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#/"]');
    if (!a || a.target === '_blank') return;
    e.preventDefault();
    navigate(a.getAttribute('href')!.slice(1));
  });

  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-act="menu"]')) return openDrawer();
    if (t.closest('[data-act="back"]')) return back();
    if (t.closest('[data-update]')) return applyUpdate();
    if (t.closest('[data-retry]')) return void refresh().then((ok) => toast(ok ? 'Actualizado' : 'Todavía sin conexión', ok ? 'success' : 'error'));
    if (t.closest('[data-skip]')) { e.preventDefault(); document.getElementById('view')?.focus(); }
    if (t.closest('[data-act="brand"]') && EXPERIMENTAL.secretAdminTap) secretTap();
  });

  // Servicios que no bloquean el primer dibujo
  void initNotifications();
  if (getSession()) void loadProfile().then(() => loadPredictions());
  else void loadPredictions();

  document.title = `${APP.name} ${APP.edition}`;
  if (location.hash === '#/admin') navigate('/admin', { replace: true });
}

let taps = 0, tapT: ReturnType<typeof setTimeout>;
function secretTap(): void {
  taps++;
  clearTimeout(tapT);
  tapT = setTimeout(() => (taps = 0), 1500);
  if (taps >= 7) { taps = 0; navigate('/admin'); }
}
