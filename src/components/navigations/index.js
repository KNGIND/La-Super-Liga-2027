/* Barra inferior flotante (celular) y barra lateral (tablet/PC/TV). Misma lista, dos formas. */
import { drawerFeatures, isActive, tabFeatures } from '../../core/navigation.js';
import { esc } from '../../utils/dom.js';
import { icon } from '../icons.js';
function items(cls) {
    return tabFeatures()
        .map((f) => `<a class="${cls}" href="#${f.path}" data-nav="${f.id}">
      <span class="${cls}__ico">${icon(f.icon, 22)}</span><span class="${cls}__label">${esc(f.title)}</span></a>`)
        .join('');
}
export const renderDock = () => `<div class="dock__inner">${items('dock__item')}</div>`;
export function renderRail() {
    const more = drawerFeatures()
        .map((f) => `<a class="rail__item rail__item--minor" href="#${f.path}" data-nav="${f.id}"><span class="rail__item__ico">${icon(f.icon, 22)}</span><span class="rail__item__label">${esc(f.title)}</span></a>`)
        .join('');
    return `${items('rail__item')}<div class="rail__sep"></div>${more}`;
}
/** Actualiza el estado activo sin redibujar todo. */
export function syncActive() {
    const set = new Set(tabFeatures().concat(drawerFeatures()).filter((f) => isActive(f)).map((f) => f.id));
    document.querySelectorAll('[data-nav]').forEach((a) => {
        const on = set.has(a.dataset.nav);
        a.classList.toggle('is-active', on);
        on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
    });
}
