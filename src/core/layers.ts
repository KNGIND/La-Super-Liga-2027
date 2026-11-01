/* CAPAS: menú lateral, modales, hojas inferiores, búsqueda rápida…
   Cada capa se apila y el botón "atrás" (Android, navegador) cierra la de arriba
   en vez de salir de la pantalla. */

export interface Layer {
  id: number;
  el: HTMLElement;
  onClose?: () => void;
}

let seq = 0;
const stack: Layer[] = [];
let skipPop = 0;

const root = (): HTMLElement => document.getElementById('layers') as HTMLElement;

export function openLayer(el: HTMLElement, opts: { onClose?: () => void; backdrop?: boolean } = {}): Layer {
  const layer: Layer = { id: ++seq, el, onClose: opts.onClose };
  stack.push(layer);
  root().appendChild(el);
  history.pushState({ layer: layer.id }, '');
  document.documentElement.classList.add('has-layer');
  requestAnimationFrame(() => el.classList.add('is-open'));
  return layer;
}

function remove(layer: Layer): void {
  const i = stack.indexOf(layer);
  if (i < 0) return;
  stack.splice(i, 1);
  layer.el.classList.remove('is-open');
  layer.el.classList.add('is-closing');
  const done = () => layer.el.remove();
  layer.el.addEventListener('transitionend', done, { once: true });
  setTimeout(done, 320); // por si no hay transición (movimiento reducido)
  if (!stack.length) document.documentElement.classList.remove('has-layer');
  layer.onClose?.();
}

/** Cierra una capa. Si es la de arriba, usa "atrás" del historial para no dejar basura. */
export function closeLayer(layer: Layer): void {
  if (stack[stack.length - 1] === layer) history.back();
  else remove(layer);
}

/** Cierra todas las capas (se usa antes de navegar a otra pantalla). */
export function closeAllLayers(): Promise<void> {
  const n = stack.length;
  if (!n) return Promise.resolve();
  return new Promise((resolve) => {
    skipPop = 1; // history.go(-n) dispara un solo popstate
    [...stack].reverse().forEach(remove);
    const fin = () => { skipPop = 0; resolve(); };
    addEventListener('popstate', fin, { once: true });
    setTimeout(fin, 250);
    history.go(-n);
  });
}

export const hasLayers = (): boolean => stack.length > 0;

addEventListener('popstate', () => {
  if (skipPop > 0) return void skipPop--;
  const top = stack[stack.length - 1];
  if (top) remove(top);
});

addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stack.length) closeLayer(stack[stack.length - 1]);
});
