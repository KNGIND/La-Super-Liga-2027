import { esc } from '../../utils/dom.js';
import { ink } from '../../utils/color.js';
export function crest(t, size = 36) {
    if (!t)
        return `<span class="crest crest--empty" style="--s:${size}px">?</span>`;
    if (t.logo)
        return `<span class="crest" style="--s:${size}px"><img src="${esc(t.logo)}" alt="" loading="lazy" decoding="async" width="${size}" height="${size}"></span>`;
    const label = esc((t.short || t.name).slice(0, 3).toUpperCase());
    return `<span class="crest crest--text" style="--s:${size}px;--c1:${esc(t.color)};--c2:${esc(t.color2)};--ink:${ink(t.color)}" aria-hidden="true">${label}</span>`;
}
