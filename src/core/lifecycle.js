/* CICLO DE VIDA: service worker (offline + actualizaciones), instalación como app,
   estado de conexión y navegación con teclado/control remoto para TV. */
import { EXPERIMENTAL } from './config.js';
import { bus } from './events.js';
/* ---------- service worker ---------- */
let waiting = null;
export const updateAvailable = () => !!waiting;
export function registerServiceWorker() {
    if (!('serviceWorker' in navigator))
        return;
    navigator.serviceWorker.register('sw.js').then((reg) => {
        const check = (w) => {
            if (!w)
                return;
            w.addEventListener('statechange', () => {
                if (w.state === 'installed' && navigator.serviceWorker.controller) {
                    waiting = w;
                    bus.emit('connection', undefined);
                }
            });
        };
        if (reg.waiting && navigator.serviceWorker.controller)
            waiting = reg.waiting;
        check(reg.installing);
        reg.addEventListener('updatefound', () => check(reg.installing));
        // buscar versión nueva al volver a la app
        document.addEventListener('visibilitychange', () => !document.hidden && void reg.update().catch(() => { }));
    }).catch(() => { });
    // Solo recargamos cuando el usuario aceptó una ACTUALIZACIÓN (ya había un service worker).
    // En la primera visita el service worker toma el control y NO hay que recargar.
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded || !hadController)
            return;
        reloaded = true;
        location.reload();
    });
}
export function applyUpdate() {
    waiting?.postMessage('SKIP_WAITING');
}
let installEvent = null;
addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    bus.emit('connection', undefined);
});
addEventListener('appinstalled', () => { installEvent = null; bus.emit('connection', undefined); });
export const canInstall = () => !!installEvent;
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export async function promptInstall() {
    if (!installEvent)
        return false;
    await installEvent.prompt();
    const r = await installEvent.userChoice;
    installEvent = null;
    bus.emit('connection', undefined);
    return r.outcome === 'accepted';
}
/* ---------- conexión ---------- */
addEventListener('online', () => bus.emit('connection', undefined));
addEventListener('offline', () => bus.emit('connection', undefined));
/* ---------- TV / control remoto: flechas mueven el foco entre elementos ---------- */
export function installTvNavigation() {
    if (!EXPERIMENTAL.tvNavigation)
        return;
    const isTv = () => innerWidth >= 1600 || document.documentElement.dataset.tv === '1';
    const sel = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
    addEventListener('keydown', (e) => {
        if (!isTv() || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key))
            return;
        const a = document.activeElement;
        if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && e.key !== 'ArrowUp' && e.key !== 'ArrowDown')
            return;
        const root = document.querySelector('.layer.is-open:last-of-type') ?? document.body;
        const els = Array.from(root.querySelectorAll(sel)).filter((el) => el.offsetParent !== null);
        if (!els.length)
            return;
        if (!a || !els.includes(a)) {
            els[0].focus();
            e.preventDefault();
            return;
        }
        const r = a.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        let best = null, bestScore = Infinity;
        for (const el of els) {
            if (el === a)
                continue;
            const q = el.getBoundingClientRect();
            const dx = q.left + q.width / 2 - cx, dy = q.top + q.height / 2 - cy;
            const ok = e.key === 'ArrowRight' ? dx > 4 : e.key === 'ArrowLeft' ? dx < -4 : e.key === 'ArrowDown' ? dy > 4 : dy < -4;
            if (!ok)
                continue;
            const main = e.key === 'ArrowLeft' || e.key === 'ArrowRight' ? Math.abs(dx) : Math.abs(dy);
            const cross = e.key === 'ArrowLeft' || e.key === 'ArrowRight' ? Math.abs(dy) : Math.abs(dx);
            const score = main + cross * 2.5;
            if (score < bestScore) {
                bestScore = score;
                best = el;
            }
        }
        if (best) {
            best.focus();
            best.scrollIntoView({ block: 'center', behavior: 'smooth' });
            e.preventDefault();
        }
    });
}
