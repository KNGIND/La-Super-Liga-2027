/* ROUTER por hash (#/ruta). Funciona igual en navegador, PWA, Capacitor y hosting estático.
   Carga cada pantalla bajo demanda y se encarga de transiciones y de recordar el scroll. */
import { NAV } from './config';
import { bus } from './events';
import { closeAllLayers, hasLayers } from './layers';
import { createScreen, type ScreenHandle } from './screen';
import { FEATURES, type Feature } from '@/features/registry';
import { isAdmin } from '@/services/supabase/auth';
import { getStatus } from '@/services/data';
import { BACKEND } from './config';

interface Compiled { feature: Feature; re: RegExp; keys: string[] }

const routes: Compiled[] = FEATURES.map((feature) => {
  const keys: string[] = [];
  const src = feature.path.replace(/:([a-z]+)/gi, (_, k: string) => (keys.push(k), '([^/]+)'));
  return { feature, keys, re: new RegExp(`^${src}$`) };
});

let current: ScreenHandle | null = null;
let currentPath = '';
let token = 0;
const scrollMemo = new Map<string, number>();
const visits: string[] = [];

export const currentRoute = (): string => currentPath;

export const pathOf = (hash = location.hash): string => {
  const raw = hash.replace(/^#/, '') || '/';
  return raw.startsWith('/') ? raw : '/' + raw;
};

export function resolve(path: string): { feature: Feature; params: Record<string, string>; query: URLSearchParams } | null {
  const [p, q = ''] = path.split('?');
  for (const r of routes) {
    const m = r.re.exec(p);
    if (!m) continue;
    const params: Record<string, string> = {};
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
    return { feature: r.feature, params, query: new URLSearchParams(q) };
  }
  return null;
}

export function navigate(path: string, opts: { replace?: boolean } = {}): void {
  const go = () => {
    if (opts.replace) location.replace('#' + path);
    else location.hash = path;
  };
  if (hasLayers()) void closeAllLayers().then(go);
  else go();
}

export const back = (): void => {
  if (visits.length > 1) history.back();
  else navigate('/');
};

export function isDisabled(f: Feature): boolean {
  return NAV.disabled.includes(f.id);
}

export function canOpen(f: Feature): boolean {
  if (isDisabled(f)) return false;
  if (!f.adminOnly) return true;
  // Modo local: el panel se abre con contraseña local (la pide la propia pantalla).
  return !BACKEND.enabled || getStatus().mode === 'local' || isAdmin();
}

async function render(): Promise<void> {
  const path = pathOf();
  const view = document.getElementById('view') as HTMLElement;
  const my = ++token;

  // recordar scroll de la pantalla que dejamos
  if (currentPath) scrollMemo.set(currentPath, scrollY);
  const isBack = visits.length > 1 && visits[visits.length - 2] === path;
  if (isBack) visits.pop();
  else if (visits[visits.length - 1] !== path) visits.push(path);

  const hit = resolve(path);
  current?.destroy();
  current = null;
  currentPath = path;

  document.documentElement.dataset.route = hit?.feature.id ?? 'notfound';
  document.documentElement.dataset.immersive = hit?.feature.immersive ? '1' : '0';

  if (!hit || !canOpen(hit.feature)) {
    view.innerHTML = `<div class="empty"><h2>No encontramos esa pantalla</h2><p>La sección no existe o está desactivada.</p><a class="btn btn--primary" href="#/">Ir al inicio</a></div>`;
    bus.emit('route', path);
    return;
  }

  view.classList.remove('view--in');
  view.innerHTML = `<div class="skeleton-screen" aria-busy="true"><div class="sk sk--title"></div><div class="sk sk--card"></div><div class="sk sk--card"></div><div class="sk sk--card"></div></div>`;
  document.title = `${hit.feature.title} · La Súper Liga`;

  try {
    const mod = await hit.feature.load();
    if (my !== token) return; // el usuario ya se fue a otra pantalla
    view.innerHTML = '';
    const handle = createScreen(view, hit.params, hit.query, { navigate, back });
    current = handle;
    await mod.default(handle.ctx);
    if (my !== token) return;
    void view.offsetWidth;
    view.classList.add('view--in');
    scrollTo(0, isBack ? scrollMemo.get(path) ?? 0 : 0);
  } catch (e) {
    console.error('[router]', e);
    if (my !== token) return;
    view.innerHTML = `<div class="empty"><h2>No se pudo abrir la pantalla</h2><p>Revisá tu conexión e intentá de nuevo.</p><button class="btn btn--primary" onclick="location.reload()">Reintentar</button></div>`;
  }
  bus.emit('route', path);
}

export function startRouter(): void {
  addEventListener('hashchange', () => void render());
  if (!location.hash) history.replaceState(null, '', '#/');
  void render();
}
