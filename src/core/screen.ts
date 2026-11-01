/* Contrato de una pantalla (ScreenFn) y el contexto que recibe (ScreenCtx).

   Una pantalla es una función así:

     export default function mi(ctx: ScreenCtx) {
       ctx.view(() => `<h1>Hola</h1>`);                 // dibuja (y se redibuja cuando cambian los datos)
       ctx.on('click', '[data-go]', (el) => ctx.navigate('/matches'));   // eventos delegados
     }

   Todo lo que registres con ctx.on / ctx.listen se limpia solo al salir de la pantalla. */
import { bus, type AppEvents } from './events';
import { delegate } from '@/utils/dom';

export interface ViewOptions {
  /** Qué eventos vuelven a dibujar la pantalla. Por defecto solo cambios de datos. */
  on?: Array<keyof AppEvents>;
  /** Se llama después de cada dibujo (para enganchar cosas al DOM nuevo). */
  after?: (el: HTMLElement) => void;
}

export interface ScreenCtx {
  el: HTMLElement;
  params: Record<string, string>;
  query: URLSearchParams;
  /** Dibuja HTML dentro de la pantalla y lo repite cuando cambian los datos. */
  view(render: () => string, opts?: ViewOptions): void;
  /** Redibuja ahora. */
  refresh(): void;
  /** Evento delegado (un solo listener para toda la pantalla). */
  on<K extends keyof HTMLElementEventMap>(type: K, selector: string, fn: (target: HTMLElement, ev: HTMLElementEventMap[K]) => void): void;
  /** Registra algo para limpiar al salir (un setInterval, un listener…). */
  listen(cleanup: () => void): void;
  navigate(path: string, opts?: { replace?: boolean }): void;
  back(): void;
}

export type ScreenFn = (ctx: ScreenCtx) => void | Promise<void>;

export interface ScreenHandle {
  ctx: ScreenCtx;
  destroy(): void;
}

export function createScreen(
  el: HTMLElement,
  params: Record<string, string>,
  query: URLSearchParams,
  nav: { navigate: ScreenCtx['navigate']; back: () => void },
): ScreenHandle {
  const cleanups: Array<() => void> = [];
  let renderFn: (() => string) | null = null;
  let opts: ViewOptions = {};
  let raf = 0;
  let alive = true;

  const paint = () => {
    if (!alive || !renderFn) return;
    const active = document.activeElement as HTMLElement | null;
    const keepFocus = active && el.contains(active) && active.id ? active.id : '';
    el.innerHTML = renderFn();
    if (keepFocus) document.getElementById(keepFocus)?.focus({ preventScroll: true });
    opts.after?.(el);
  };
  const schedule = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(paint);
  };

  const ctx: ScreenCtx = {
    el, params, query,
    view(render, o = {}) {
      renderFn = render;
      opts = o;
      paint();
      for (const ev of o.on ?? ['data']) cleanups.push(bus.on(ev, schedule as never));
    },
    refresh: paint,
    on(type, selector, fn) {
      cleanups.push(delegate(el, type, selector, fn));
    },
    listen(fn) {
      cleanups.push(fn);
    },
    navigate: nav.navigate,
    back: nav.back,
  };

  return {
    ctx,
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      cleanups.splice(0).forEach((f) => f());
    },
  };
}
