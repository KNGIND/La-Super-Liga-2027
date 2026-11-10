/* Estados de pantalla: cargando, vacío y error. Usalos siempre en vez de pantallas en blanco. */
import { esc } from '../../utils/dom.js';
import { icon } from '../icons.js';
export const spinner = () => `<span class="spinner" role="status" aria-label="Cargando"></span>`;
export const skeletonList = (n = 3, h = 76) => Array.from({ length: n }, () => `<div class="sk sk--card" style="height:${h}px"></div>`).join('');
export function emptyState(title, text = '', ic = 'info', action = '') {
    return `<div class="empty"><span class="empty__ico">${icon(ic, 28)}</span><h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${action}</div>`;
}
export function errorState(text, retryAttr = 'data-retry') {
    return `<div class="empty empty--error"><span class="empty__ico">${icon('wifi-off', 28)}</span><h3>No se pudo cargar</h3><p>${esc(text)}</p><button class="btn btn--primary" ${retryAttr}>Reintentar</button></div>`;
}
/** Aviso fino arriba de una lista (datos desactualizados, solo lectura, etc.). */
export function notice(text, kind = 'info') {
    return `<div class="notice notice--${kind}">${esc(text)}</div>`;
}
