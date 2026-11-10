/* Navegación: arma la lista de pestañas y del menú desde config.ts + registry.ts,
   y agrega los gestos horizontales para cambiar de pestaña. */
import { NAV } from './config.js';
import { getPrefs } from './prefs.js';
import { bus } from './events.js';
import { createScreen } from './screen.js';
import { adopt, back, navigate, pathOf, resolve, setTabResolver } from './router.js';
import { featureById } from '../features/registry.js';
const visible = (id) => {
    const f = featureById(id);
    return f && !NAV.disabled.includes(id) ? f : undefined;
};
export const tabFeatures = () => NAV.tabs.map(visible).filter((f) => !!f);
export const drawerFeatures = () => NAV.drawer.map(visible).filter((f) => !!f);
/** ¿La ruta actual pertenece a esta pestaña? (el detalle de un partido cuenta como "Partidos") */
export function isActive(f, path = pathOf()) {
    const base = f.path === '/' ? '/' : f.path;
    if (base === '/')
        return path === '/';
    if (path === base || path.startsWith(base + '/'))
        return true;
    const alias = { matches: ['/match/'], news: ['/news/'], teams: ['/team/'] };
    return (alias[f.id] ?? []).some((p) => path.startsWith(p));
}
/* ---------- gestos horizontales (pager) ----------
   Mientras el dedo se mueve en horizontal, la pantalla actual y la vecina se arrastran juntas
   (como en Instagram o WhatsApp). Al soltar: si pasó el umbral o fue un "flick" rápido, se completa con
   una animación suave y recién ahí se navega; si no, vuelve a su lugar.
   Solo cuenta si el gesto NO empezó dentro de algo que ya scrollea/usa gestos (carruseles, formularios, tablas). */
setTabResolver((path) => tabFeatures().findIndex((f) => isActive(f, path)));
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
export function installSwipe(host) {
    const root = document.documentElement;
    let tracking = false, mode = '', busy = false;
    let x0 = 0, y0 = 0, dx = 0, vx = 0, lastX = 0, lastT = 0;
    let dir = 0, next = null, pane = null, paneView = null, paneHandle = null, ready = false, W = 0, rect = null, token = 0;
    const blocked = (el) => {
        for (let n = el; n && n !== host; n = n.parentElement) {
            if (n.matches('input, textarea, select, button[role="slider"], [data-no-swipe], .table-scroll, .carousel'))
                return true;
            const cs = getComputedStyle(n);
            if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && n.scrollWidth > n.clientWidth + 4)
                return true;
        }
        return false;
    };
    const quick = () => matchMedia('(prefers-reduced-motion: reduce)').matches || root.dataset.perf === 'eco';
    const dropPane = () => { paneHandle?.destroy(); pane?.remove(); pane = paneView = paneHandle = null; ready = false; };
    /** Prepara la pantalla vecina (junto con su propio aviso) a un costado, para que se vea mientras se arrastra.
        Cada sección es independiente: su aviso, su contenido y su fondo se mueven juntos. */
    async function buildPane(feature) {
        const my = ++token;
        dropPane();
        const el = document.createElement('div');
        el.className = 'peek';
        el.setAttribute('aria-hidden', 'true');
        el.inert = true;
        const bn = document.getElementById('banner');
        if (bn && !bn.hidden)
            el.appendChild(bn.cloneNode(true)).removeAttribute('id');
        const v = document.createElement('main');
        v.className = 'view';
        el.appendChild(v);
        const top = document.getElementById('appbar').getBoundingClientRect().bottom;
        el.style.cssText = `top:${top}px;left:${rect.left + dir * W}px;width:${rect.width}px;transform:translate3d(${dx}px,0,0)`;
        document.body.appendChild(el);
        pane = el;
        paneView = v;
        try {
            const hit = resolve(feature.path);
            const mod = await feature.load();
            if (my !== token)
                return;
            const handle = createScreen(v, hit?.params ?? {}, hit?.query ?? new URLSearchParams(), { navigate, back });
            paneHandle = handle;
            await mod.default(handle.ctx);
            if (my === token)
                ready = true;
        }
        catch { /* si falla, queda el fondo liso: el cambio de pestaña igual funciona */ }
    }
    function setDir(d) {
        const tabs = tabFeatures();
        const i = tabs.findIndex((f) => isActive(f));
        dir = d;
        next = i >= 0 ? tabs[i + d] ?? null : null;
        if (next)
            void buildPane(next);
        else {
            token++;
            dropPane();
        }
    }
    const place = (x) => {
        host.style.transform = `translate3d(${x}px,0,0)`;
        if (pane)
            pane.style.transform = `translate3d(${x}px,0,0)`;
    };
    const reset = () => {
        host.style.transition = 'none';
        host.style.transform = '';
        host.style.pointerEvents = '';
        root.classList.remove('is-swiping');
        requestAnimationFrame(() => { host.style.transition = ''; });
        busy = false;
    };
    const cleanup = () => { token++; dropPane(); reset(); };
    function animateTo(x, ms, done) {
        const tr = `transform ${ms}ms ${EASE}`;
        host.style.transition = tr;
        if (pane)
            pane.style.transition = tr;
        place(x);
        setTimeout(done, ms + 30);
    }
    host.addEventListener('touchstart', (e) => {
        tracking = !busy && e.touches.length === 1 && getPrefs().swipeNavigation && root.dataset.immersive !== '1' && !root.classList.contains('is-editing') && !root.classList.contains('has-layer') && !root.classList.contains('has-welcome') && !blocked(e.target);
        mode = '';
        const t = e.touches[0];
        x0 = lastX = t.clientX;
        y0 = t.clientY;
        lastT = performance.now();
        dx = vx = 0;
    }, { passive: true });
    host.addEventListener('touchmove', (e) => {
        if (!tracking)
            return;
        const t = e.touches[0];
        dx = t.clientX - x0;
        const dy = t.clientY - y0;
        if (!mode) {
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8)
                return;
            mode = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'h' : 'v';
            if (mode === 'v')
                return void (tracking = false);
            rect = host.getBoundingClientRect();
            W = rect.width;
            root.classList.add('is-swiping');
            host.style.pointerEvents = 'none';
            setDir(dx < 0 ? 1 : -1);
        }
        const now = performance.now();
        if (now - lastT > 0)
            vx = 0.8 * vx + 0.2 * ((t.clientX - lastX) / (now - lastT));
        lastX = t.clientX;
        lastT = now;
        if (Math.sign(dx) === dir)
            setDir(-dir); // cambió de sentido: la vecina ahora es la otra
        if (!next)
            return place(dx * 0.28); // sin vecina (primera/última pestaña): resistencia elástica
        place(Math.max(-W, Math.min(W, dx)));
    }, { passive: true });
    const finish = () => {
        if (!tracking || mode !== 'h') {
            tracking = false;
            return;
        }
        tracking = false;
        busy = true;
        const go = next && Math.sign(dx) === -dir && (Math.abs(dx) > W * 0.33 || (Math.abs(vx) > 0.45 && Math.abs(dx) > 30));
        const ms = quick() ? 140 : 320;
        if (!go)
            return animateTo(0, ms, cleanup);
        const target = next;
        animateTo(-dir * W, ms, () => {
            // La vecina ya está dibujada y ocupa toda la pantalla: la ADOPTAMOS tal cual (sin volver a dibujarla)
            // y en el mismo cuadro se saca la copia. Así no hay parpadeo ni salto.
            if (ready && paneView && paneHandle) {
                const v = paneView, h = paneHandle;
                pane.querySelector('.banner')?.remove();
                paneHandle = null; // para que dropPane no destruya la pantalla adoptada
                host.style.transition = 'none';
                host.style.transform = '';
                if (adopt(target.path, h, v)) {
                    token++;
                    dropPane();
                    reset();
                    return;
                }
                h.destroy();
            }
            // Plan B: la vecina no llegó a dibujarse; navegación normal
            cleanup();
            navigate(target.path);
        });
    };
    host.addEventListener('touchend', finish, { passive: true });
    host.addEventListener('touchcancel', finish, { passive: true });
    // Dejar listas las pantallas vecinas para que aparezcan al instante al arrastrar
    bus.on('route', () => (window.requestIdleCallback ?? setTimeout)(() => {
        const tabs = tabFeatures();
        const i = tabs.findIndex((f) => isActive(f));
        [tabs[i - 1], tabs[i + 1]].forEach((f) => f?.load().catch(() => { }));
    }));
}
