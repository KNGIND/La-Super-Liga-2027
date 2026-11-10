/* Selectores CSS para el Editor en vivo: cómo "recordar" qué elemento tocaste.
   Se prefiere un id; si no, la ruta más corta de clases (+ posición entre hermanos) que lo identifique SOLO a él.
   Desarrolladores: poné class estables en tus componentes (los de estado como is-on / has-… se ignoran). */
const SKIP = /^(is-|has-|view--|ed-|peek|js-)/;
const okClass = (c) => /^[a-z_][\w-]*$/i.test(c) && !SKIP.test(c);
const ID = /^[A-Za-z][\w-]*$/;

function part(el) {
    if (el.id && ID.test(el.id) && !/^(view|pager)$/.test(el.id)) return '#' + el.id;
    const cls = [...el.classList].filter(okClass).slice(0, 3);
    return el.tagName.toLowerCase() + (cls.length ? '.' + cls.join('.') : '');
}
function nth(el) {
    const p = el.parentElement;
    if (!p) return '';
    const me = part(el);
    const same = [...p.children].filter((c) => part(c) === me);
    return same.length > 1 ? `:nth-child(${[...p.children].indexOf(el) + 1})` : '';
}
const unique = (sel, el) => { try { const l = document.querySelectorAll(sel); return l.length === 1 && l[0] === el; } catch { return false; } };

/** Selector que identifica SOLO a este elemento. */
export function selectorFor(el) {
    const chain = [];
    for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
        chain.unshift(part(n) + (n.id && ID.test(n.id) ? '' : nth(n)));
        const sel = chain.join(' > ');
        if (unique(sel, el)) return sel;
        if (n.id && ID.test(n.id)) break;
    }
    return chain.join(' > ');
}
/** Selector que agarra a TODOS los parecidos (misma tag y clases), o '' si no hay clases estables. */
export function groupSelectorFor(el) {
    const cls = [...el.classList].filter(okClass).slice(0, 3);
    if (!cls.length) return '';
    return el.tagName.toLowerCase() + '.' + cls.join('.');
}
export const countOf = (sel) => { try { return document.querySelectorAll(sel).length; } catch { return 0; } };

/** Nombre corto y entendible para mostrar en listas. */
export function describe(el) {
    const tag = el.tagName.toLowerCase();
    const cls = [...el.classList].filter(okClass).slice(0, 2).join('.');
    const txt = (el.getAttribute('aria-label') || (el.children.length ? '' : el.textContent) || el.getAttribute('alt') || '').trim().replace(/\s+/g, ' ').slice(0, 22);
    return `${cls ? '.' + cls : tag}${txt ? ` “${txt}”` : ''}`;
}
