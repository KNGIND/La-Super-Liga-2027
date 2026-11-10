/* ARRANQUE DE LA APP
   Orden: preferencias → armar estructura → datos (instantáneo desde caché/seed) → router → servicios en segundo plano. */
import { renderDock, renderRail, syncActive } from '../components/navigation/index.js';
import { renderHeader } from '../components/header/index.js';
import { openDrawer } from '../components/sidebar/index.js';
import { toast } from '../components/modals/index.js';
import { APP, EXPERIMENTAL } from './config.js';
import { bus } from './events.js';
import { applyUpdate, installTvNavigation, registerServiceWorker, updateAvailable } from './lifecycle.js';
import { installSwipe } from './navigation.js';
import { initMods, safeMode, safeReason, startMods } from '../services/mods/index.js';
import { applyPrefs } from './prefs.js';
import { back, currentRoute, navigate, resolve, startRouter } from './router.js';
import { getData, getStatus, initData, refresh } from '../services/data/index.js';
import { loadPredictions } from '../services/data/predictions.js';
import { initNotifications, unreadCount } from '../services/notifications/index.js';
import { loadProfile } from '../services/supabase/auth.js';
import { avatarUrl, initialOf, initUser, needsWelcome } from '../services/user.js';
import { showWelcome } from '../components/welcome/index.js';
import { getSession } from '../services/supabase/client.js';
import { relativeTime } from './status.js';
import { esc } from '../utils/dom.js';
import { icon } from '../components/icons.js';
function shellHtml() {
    return `
    <div class="skip"><a href="#view" data-skip>Saltar al contenido</a></div>
    <header class="appbar" id="appbar"></header>
    <aside class="rail" id="rail" aria-label="Navegación principal"></aside>
    <div id="pager" class="pager">
      <div id="banner" class="banner" hidden></div>
      <main id="view" class="view" tabindex="-1"></main>
    </div>
    <nav class="dock" id="dock" aria-label="Navegación principal"></nav>`;
}
function renderChrome() {
    const d = getData();
    const hit = resolve(currentRoute() || '/');
    const immersive = !!hit?.feature.immersive;
    // Solo se vuelve a escribir lo que cambió de verdad: reemplazar el HTML en cada cambio de pantalla
    // hacía que la barra y el encabezado parpadearan (se recreaban sus efectos de vidrio e imágenes).
    setHtml('appbar', renderHeader({ unread: unreadCount(), initial: initialOf(), avatar: avatarUrl(), logo: d.league.logo, name: d.league.name }, immersive, hit?.feature.title ?? ''));
    setHtml('dock', renderDock());
    setHtml('rail', renderRail());
}
const lastHtml = new Map();
function setHtml(id, html) {
    if (lastHtml.get(id) === html)
        return;
    lastHtml.set(id, html);
    document.getElementById(id).innerHTML = html;
    if (id !== 'appbar')
        syncActive();
}
async function shareCurrent() {
    const data = { title: document.title, url: location.href };
    try {
        if (navigator.share)
            return void (await navigator.share(data));
        await navigator.clipboard.writeText(data.url);
        toast('Enlace copiado', 'success');
    }
    catch { /* el usuario canceló */ }
}
/** Franja de aviso: sin conexión, datos guardados, solo lectura, actualización disponible. */
function renderBanner() {
    const b = document.getElementById('banner');
    const st = getStatus();
    let html = '';
    if (safeMode()) {
        html = `<span>${icon('shield', 16)} Modo seguro${safeReason() === 'auto' ? ' automático (la app se reinició varias veces seguidas)' : ''}: las personalizaciones están apagadas.</span><button class="btn btn--sm" data-safe-exit>Salir</button>`;
    }
    else if (updateAvailable()) {
        html = `<span>${icon('refresh', 16)} Hay una versión nueva de la app.</span><button class="btn btn--sm btn--primary" data-update>Actualizar</button>`;
    }
    else if (!navigator.onLine) {
        html = `<span>${icon('wifi-off', 16)} Sin conexión. Mostrando datos guardados${st.syncedAt ? ` (${esc(relativeTime(st.syncedAt))})` : ''}.</span>`;
    }
    else if (st.mode === 'legacy') {
        html = `<span>${icon('database', 16)} Leyendo los datos de la app anterior (solo lectura). Ejecutá las migraciones para editar desde acá.</span>`;
    }
    else if (st.error && st.origin !== 'server') {
        html = `<span>${icon('wifi-off', 16)} ${esc(st.error)} Mostrando datos guardados${st.syncedAt ? ` (${esc(relativeTime(st.syncedAt))})` : ''}.</span><button class="btn btn--sm" data-retry>Reintentar</button>`;
    }
    b.hidden = !html;
    b.innerHTML = html;
}
export async function boot() {
    applyPrefs();
    const root = document.getElementById('app');
    root.innerHTML = shellHtml();
    // 1) Datos instantáneos (caché o ejemplo), 2) pantalla, 3) el resto en segundo plano
    await initData();
    await initUser();
    await initMods();
    renderChrome();
    renderBanner();
    startRouter();
    document.getElementById('splash')?.remove();
    if (needsWelcome())
        void showWelcome();
    if (EXPERIMENTAL.tvNavigation)
        installTvNavigation();
    installSwipe(document.getElementById('pager'));
    registerServiceWorker();
    startMods();
    bus.on('data', () => { renderChrome(); renderBanner(); });
    bus.on('connection', renderBanner);
    bus.on('session', renderChrome);
    bus.on('prefs', renderChrome);
    bus.on('route', () => { renderChrome(); syncActive(); const v = document.getElementById('view'); if (v && !document.documentElement.classList.contains('has-layer'))
        v.focus({ preventScroll: true }); });
    addEventListener('online', () => void refresh());
    // Un enlace tocado con una capa abierta (menú, modal) primero cierra la capa y después navega:
    // así el historial queda limpio y el botón "atrás" se comporta bien.
    document.addEventListener('click', (e) => {
        if (e.defaultPrevented || !document.documentElement.classList.contains('has-layer'))
            return;
        const a = e.target.closest('a[href^="#/"]');
        if (!a || a.target === '_blank')
            return;
        e.preventDefault();
        navigate(a.getAttribute('href').slice(1));
    });
    root.addEventListener('click', (e) => {
        const t = e.target;
        if (t.closest('[data-act="menu"]'))
            return openDrawer();
        if (t.closest('[data-act="back"]'))
            return back();
        if (t.closest('[data-act="share"]'))
            return void shareCurrent();
        if (t.closest('[data-safe-exit]')) {
            location.href = location.pathname + '?safe=0' + location.hash;
            return;
        }
        if (t.closest('[data-update]'))
            return applyUpdate();
        if (t.closest('[data-retry]'))
            return void refresh().then((ok) => toast(ok ? 'Actualizado' : 'Todavía sin conexión', ok ? 'success' : 'error'));
        if (t.closest('[data-skip]')) {
            e.preventDefault();
            document.getElementById('view')?.focus();
        }
        // 7 toques seguidos al nombre abren el admin. En el 7.º se cancela el enlace "ir al inicio"
        // (si no, el enlace pisaba la navegación y volvía a Inicio).
        if (t.closest('[data-act="brand"]') && EXPERIMENTAL.secretAdminTap && secretTap())
            e.preventDefault();
    });
    // Servicios que no bloquean el primer dibujo
    void initNotifications();
    if (getSession())
        void loadProfile().then(() => loadPredictions());
    else
        void loadPredictions();
    document.title = `${APP.name} ${APP.edition}`;
    if (location.hash === '#/admin')
        navigate('/admin', { replace: true });
}
let taps = 0, tapT;
function secretTap() {
    taps++;
    clearTimeout(tapT);
    tapT = setTimeout(() => (taps = 0), 1500);
    if (taps >= 7) {
        taps = 0;
        navigate('/admin');
        return true;
    }
    return false;
}
