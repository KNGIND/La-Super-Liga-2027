/* Modales, hojas inferiores, confirmaciones y avisos (toast).
   En celular se abren como hoja desde abajo; en pantallas grandes, centrados. */
import { closeLayer, openLayer } from '../../core/layers.js';
import { esc } from '../../utils/dom.js';
import { icon } from '../icons.js';
export function openModal(o) {
    const el = document.createElement('div');
    el.className = 'layer modal';
    el.innerHTML = `
    <div class="layer__backdrop" data-close></div>
    <section class="modal__panel ${o.wide ? 'modal__panel--wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(o.title)}">
      <header class="modal__head"><h2>${esc(o.title)}</h2><button class="icon-btn" data-close aria-label="Cerrar">${icon('x', 22)}</button></header>
      <div class="modal__body">${o.body}</div>
      ${o.actions?.length ? `<footer class="modal__foot">${o.actions.map((a, i) => `<button type="button" class="btn btn--${a.variant ?? 'secondary'}" data-act="${i}">${esc(a.label)}</button>`).join('')}</footer>` : ''}
    </section>`;
    let layer;
    const close = () => closeLayer(layer);
    el.addEventListener('click', async (e) => {
        const t = e.target;
        if (t.closest('[data-close]'))
            return close();
        const b = t.closest('[data-act]');
        if (!b)
            return;
        const action = o.actions[Number(b.dataset.act)];
        b.setAttribute('disabled', '');
        try {
            const r = await action.onClick?.(el);
            if (r !== false)
                close();
        }
        finally {
            b.removeAttribute('disabled');
        }
    });
    layer = openLayer(el);
    o.onMount?.(el, close);
    return { el, close };
}
export function confirmDialog(message, o = {}) {
    return new Promise((resolve) => {
        let answered = false;
        const done = (v) => { if (!answered) {
            answered = true;
            resolve(v);
        } };
        const { el } = openModal({
            title: o.title ?? 'Confirmar',
            body: `<p class="modal__text">${esc(message)}</p>`,
            actions: [
                { label: 'Cancelar', variant: 'ghost', onClick: () => void done(false) },
                { label: o.confirm ?? 'Aceptar', variant: o.danger ? 'danger' : 'primary', onClick: () => void done(true) },
            ],
        });
        new MutationObserver((_, obs) => { if (!el.isConnected) {
            done(false);
            obs.disconnect();
        } }).observe(document.getElementById('layers'), { childList: true });
    });
}
/* ---------- toast ---------- */
let toastTimer;
export function toast(message, kind = 'info', ms = 3200) {
    let el = document.getElementById('toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'toast';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        document.body.appendChild(el);
    }
    el.className = `toast toast--${kind} is-show`;
    el.textContent = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-show'), ms);
}
