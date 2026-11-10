/* Utilidades de DOM chiquitas. Nada de librerías. */
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Escapa texto para meterlo en HTML. Usalo SIEMPRE con datos que vienen de usuarios o de la base. */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
/** Delegación de eventos: escucha en `root` y llama a `fn` si el click cayó dentro de `sel`. */
export function delegate(root, type, sel, fn) {
    const h = (ev) => {
        const t = ev.target?.closest(sel);
        if (t && root.contains(t))
            fn(t, ev);
    };
    root.addEventListener(type, h);
    return () => root.removeEventListener(type, h);
}
export function debounce(fn, ms) {
    let t;
    return (...a) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...a), ms);
    };
}
export const uid = (prefix = 'id') => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
/** Normaliza texto para buscar: sin tildes, minúsculas. */
export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/** Descarga un archivo de texto desde el navegador. */
export function downloadText(filename, text, mime = 'application/json') {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export function pickFile(accept) {
    return new Promise((resolve) => {
        const i = document.createElement('input');
        i.type = 'file';
        i.accept = accept;
        i.onchange = () => {
            const f = i.files?.[0];
            if (!f)
                return resolve(null);
            const r = new FileReader();
            r.onload = () => resolve(String(r.result));
            r.onerror = () => resolve(null);
            r.readAsText(f);
        };
        i.click();
    });
}
