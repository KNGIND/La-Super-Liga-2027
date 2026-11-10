/* Botones. Todos los botones de la app salen de acá (clase .btn en styles/components.css). */
import { esc } from '../../utils/dom.js';
import { icon } from '../icons.js';
export function button(label, o = {}) {
    const cls = `btn btn--${o.variant ?? 'secondary'}${o.small ? ' btn--sm' : ''}${o.block ? ' btn--block' : ''}`;
    const inner = `${o.icon ? icon(o.icon, o.small ? 16 : 18) : ''}<span>${esc(label)}</span>`;
    return o.href
        ? `<a class="${cls}" href="${esc(o.href)}" ${o.attrs ?? ''}>${inner}</a>`
        : `<button type="button" class="${cls}" ${o.attrs ?? ''}>${inner}</button>`;
}
export const iconButton = (name, label, attrs = '', badge = '') => `<button type="button" class="icon-btn" aria-label="${esc(label)}" ${attrs}>${icon(name, 22)}${badge}</button>`;
/** Pestañas tipo segmentado: items = [valor, texto]. */
/** Selector de temporada (solo aparece si hay más de una). Escuchá el evento con data-season. */
export function seasonPicker(d, sid) {
    if (d.seasons.length < 2)
        return '';
    const cur = sid || (d.seasons.find((s) => s.current) ?? d.seasons[d.seasons.length - 1]).id;
    return `<label class="field season-pick"><span class="field__label">Temporada</span><select class="input" data-season>${d.seasons.map((s) => `<option value="${esc(s.id)}" ${s.id === cur ? 'selected' : ''}>${esc(s.name)}${s.current ? ' (actual)' : ''}</option>`).join('')}</select></label>`;
}
export function segmented(items, active, attr = 'data-seg', variant = 'tabs') {
    return `<div class="seg ${variant === 'chips' ? 'seg--chips' : ''}" role="tablist">${items
        .map(([v, t]) => `<button type="button" role="tab" class="seg__btn ${v === active ? 'is-on' : ''}" aria-selected="${v === active}" ${attr}="${esc(v)}">${esc(t)}</button>`)
        .join('')}</div>`;
}
