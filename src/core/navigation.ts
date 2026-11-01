/* Navegación: arma la lista de pestañas y del menú desde config.ts + registry.ts,
   y agrega los gestos horizontales para cambiar de pestaña. */
import { NAV } from './config';
import { getPrefs } from './prefs';
import { navigate, pathOf } from './router';
import { featureById, type Feature } from '@/features/registry';

const visible = (id: string): Feature | undefined => {
  const f = featureById(id);
  return f && !NAV.disabled.includes(id) ? f : undefined;
};

export const tabFeatures = (): Feature[] => NAV.tabs.map(visible).filter((f): f is Feature => !!f);
export const drawerFeatures = (): Feature[] => NAV.drawer.map(visible).filter((f): f is Feature => !!f);

/** ¿La ruta actual pertenece a esta pestaña? (el detalle de un partido cuenta como "Partidos") */
export function isActive(f: Feature, path = pathOf()): boolean {
  const base = f.path === '/' ? '/' : f.path;
  if (base === '/') return path === '/';
  if (path === base || path.startsWith(base + '/')) return true;
  const alias: Record<string, string[]> = { matches: ['/match/'], news: ['/news/'], teams: ['/team/'] };
  return (alias[f.id] ?? []).some((p) => path.startsWith(p));
}

/* ---------- gestos horizontales ----------
   Solo cuenta si: el dedo se mueve sobre todo en horizontal, lo bastante lejos,
   y NO empezó dentro de algo que ya scrollea/usa gestos (carruseles, formularios, tablas, mapas). */
export function installSwipe(host: HTMLElement): void {
  let x0 = 0, y0 = 0, t0 = 0, active = false;

  const blocked = (el: Element | null): boolean => {
    for (let n = el; n && n !== host; n = n.parentElement) {
      if (n.matches('input, textarea, select, button[role="slider"], [data-no-swipe], .table-scroll, .carousel')) return true;
      const cs = getComputedStyle(n);
      if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && n.scrollWidth > n.clientWidth + 4) return true;
    }
    return false;
  };

  host.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    active = e.touches.length === 1 && !document.documentElement.classList.contains('has-layer') && !blocked(e.target as Element);
    x0 = t.clientX; y0 = t.clientY; t0 = Date.now();
  }, { passive: true });

  host.addEventListener('touchend', (e) => {
    if (!active || !getPrefs().swipeNavigation) return;
    active = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - x0, dy = t.clientY - y0;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2 || Date.now() - t0 > 600) return;
    const tabs = tabFeatures();
    const i = tabs.findIndex((f) => isActive(f));
    if (i < 0) return;
    const next = tabs[i + (dx < 0 ? 1 : -1)];
    if (next) navigate(next.path);
  }, { passive: true });
}
