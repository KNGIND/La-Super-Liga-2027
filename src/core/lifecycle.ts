/* CICLO DE VIDA: service worker (offline + actualizaciones), instalación como app,
   estado de conexión y navegación con teclado/control remoto para TV. */
import { EXPERIMENTAL } from './config';
import { bus } from './events';

/* ---------- service worker ---------- */
let waiting: ServiceWorker | null = null;
export const updateAvailable = (): boolean => !!waiting;

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const check = (w: ServiceWorker | null) => {
      if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) {
          waiting = w;
          bus.emit('connection', undefined);
        }
      });
    };
    if (reg.waiting && navigator.serviceWorker.controller) waiting = reg.waiting;
    check(reg.installing);
    reg.addEventListener('updatefound', () => check(reg.installing));
    // buscar versión nueva al volver a la app
    document.addEventListener('visibilitychange', () => !document.hidden && void reg.update().catch(() => {}));
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  });
}

export function applyUpdate(): void {
  waiting?.postMessage('SKIP_WAITING');
}

/* ---------- instalación como app (PWA) ---------- */
interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }
let installEvent: InstallEvent | null = null;

addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e as InstallEvent;
  bus.emit('connection', undefined);
});
addEventListener('appinstalled', () => { installEvent = null; bus.emit('connection', undefined); });

export const canInstall = (): boolean => !!installEvent;
export const isStandalone = (): boolean => matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export async function promptInstall(): Promise<boolean> {
  if (!installEvent) return false;
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
export function installTvNavigation(): void {
  if (!EXPERIMENTAL.tvNavigation) return;
  const isTv = () => innerWidth >= 1600 || document.documentElement.dataset.tv === '1';
  const sel = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

  addEventListener('keydown', (e) => {
    if (!isTv() || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const a = document.activeElement as HTMLElement | null;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    const root = document.querySelector<HTMLElement>('.layer.is-open:last-of-type') ?? document.body;
    const els = Array.from(root.querySelectorAll<HTMLElement>(sel)).filter((el) => el.offsetParent !== null);
    if (!els.length) return;
    if (!a || !els.includes(a)) { els[0].focus(); e.preventDefault(); return; }
    const r = a.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let best: HTMLElement | null = null, bestScore = Infinity;
    for (const el of els) {
      if (el === a) continue;
      const q = el.getBoundingClientRect();
      const dx = q.left + q.width / 2 - cx, dy = q.top + q.height / 2 - cy;
      const ok = e.key === 'ArrowRight' ? dx > 4 : e.key === 'ArrowLeft' ? dx < -4 : e.key === 'ArrowDown' ? dy > 4 : dy < -4;
      if (!ok) continue;
      const main = e.key === 'ArrowLeft' || e.key === 'ArrowRight' ? Math.abs(dx) : Math.abs(dy);
      const cross = e.key === 'ArrowLeft' || e.key === 'ArrowRight' ? Math.abs(dy) : Math.abs(dx);
      const score = main + cross * 2.5;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best) { best.focus(); best.scrollIntoView({ block: 'center', behavior: 'smooth' }); e.preventDefault(); }
  });
}
