/* CAMBIOS DEL EDITOR EN VIVO → cómo se aplican a la página.
   Un "cambio" (item) guarda un selector CSS + qué propiedades modificar. Se traduce a UNA hoja de estilos
   (<style id="lsl-overrides">), así sobrevive cuando las pantallas se vuelven a dibujar.
   Lo que no es CSS (texto, "al tocar…") se aplica con un observador que lo reaplica si la pantalla se redibuja.
   Formato del modelo (lo que se guarda):
   { items: [{ id, sel, label, route, enabled, s:{x,y,rot,scale,w,h,color,bg,bc,bw,br,shadow,op,fs,fw,blur,hide,off,custom}, text, action:{type,value} }],
     vars:{ all:{'--accent':'#…'}, dark:{…}, light:{…} }, fontScale:1, nav:{tabs,drawer,disabled}|null } */
import { NAV } from '../../core/config.js';
import { bus } from '../../core/events.js';
import { currentRoute, navigate, resolve } from '../../core/router.js';
import { featureById } from '../../features/registry.js';

const SHADOWS = { none: 'none', soft: '0 4px 14px rgba(0,0,0,.25)', strong: '0 14px 38px rgba(0,0,0,.5)' };
const num = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
const colorOk = (v) => typeof v === 'string' && v.length < 80 && !/[;{}<>]/.test(v) && (window.CSS?.supports?.('color', v) ?? true);
const safeSel = (s) => typeof s === 'string' && s.length < 400 && !/[{};@]/.test(s) && (() => { try { document.querySelector(s); return true; } catch { return false; } })();

/** Declaraciones CSS de un cambio. Todo se valida: lo que no es válido, se ignora (nunca rompe la hoja). */
export function declarations(s = {}, ed = false) {
    const d = [];
    const x = num(s.x), y = num(s.y), rot = num(s.rot), sc = num(s.scale), w = num(s.w), h = num(s.h);
    if (x != null || y != null) d.push(`translate:${x ?? 0}px ${y ?? 0}px`);
    if (rot != null) d.push(`rotate:${rot}deg`);
    if (sc != null && sc > 0) d.push(`scale:${sc}`);
    if (w != null && w >= 0) d.push(`width:${w}px`, 'max-width:none', 'min-width:0');
    if (h != null && h >= 0) d.push(`height:${h}px`, 'min-height:0');
    if (s.inl && [x, y, rot, sc, w, h].some((v) => v != null)) d.push('display:inline-block');
    if (colorOk(s.color)) d.push(`color:${s.color}`);
    if (colorOk(s.bg)) d.push(`background:${s.bg}`);
    const bw = num(s.bw);
    if (colorOk(s.bc) || bw != null) d.push(`border:${bw ?? 1}px solid ${colorOk(s.bc) ? s.bc : 'currentColor'}`);
    const br = num(s.br);
    if (br != null && br >= 0) d.push(`border-radius:${br}px`);
    if (SHADOWS[s.shadow]) d.push(`box-shadow:${SHADOWS[s.shadow]}`);
    const op = num(s.op);
    if (op != null) d.push(`opacity:${Math.min(1, Math.max(0, op))}`);
    const fs = num(s.fs);
    if (fs != null && fs > 0) d.push(`font-size:${fs}px`);
    const fw = num(s.fw);
    if (fw != null) d.push(`font-weight:${fw}`);
    const bl = num(s.blur);
    if (bl != null && bl > 0) d.push(`backdrop-filter:blur(${bl}px)`, `-webkit-backdrop-filter:blur(${bl}px)`);
    // En modo edición lo oculto/desactivado se sigue viendo "fantasma" para poder volver a elegirlo.
    if (s.hide) d.push(...(ed ? ['opacity:.3', 'outline:1px dashed #4f7cff'] : ['display:none']));
    if (s.off) d.push(...(ed ? ['opacity:.5'] : ['pointer-events:none', 'opacity:.5']));
    if (s.custom) {
        // CSS libre: se interpreta con el propio navegador y se vuelve a escribir solo con lo válido
        const t = document.createElement('div');
        t.style.cssText = String(s.custom).replace(/[{}<>]/g, '');
        for (let i = 0; i < t.style.length; i++) d.push(`${t.style[i]}:${t.style.getPropertyValue(t.style[i])}`);
    }
    return d;
}

const FONT_VARS = { '--fs-xs': 0.75, '--fs-sm': 0.8125, '--fs-md': 0.9375, '--fs-lg': 1.0625, '--fs-xl': 1.375, '--fs-2xl': 1.75, '--fs-score': 1.5 };
const varBlock = (sel, vars) => {
    const body = Object.entries(vars ?? {}).filter(([k, v]) => /^--[a-z0-9-]+$/i.test(k) && v !== '' && v != null && !/[;{}<>]/.test(String(v))).map(([k, v]) => `${k}:${v} !important`).join(';');
    return body ? `${sel}{${body}}` : '';
};

/** Hoja de estilos completa a partir del modelo. */
export function compile(model) {
    if (!model) return '';
    const out = [];
    const fs = num(model.fontScale);
    const fontVars = fs && Math.abs(fs - 1) > 0.001 ? Object.fromEntries(Object.entries(FONT_VARS).map(([k, v]) => [k, `${(v * fs).toFixed(4)}rem`])) : {};
    out.push(varBlock(':root', { ...fontVars, ...model.vars?.all }));
    out.push(varBlock('html[data-theme="dark"]', model.vars?.dark));
    out.push(varBlock('html[data-theme="light"]', model.vars?.light));
    for (const it of model.items ?? []) {
        if (it.enabled === false || !safeSel(it.sel)) continue;
        const d = declarations(it.s, editing);
        if (!d.length) continue;
        const scope = it.route && /^[\w-]+$/.test(it.route) ? `html[data-route="${it.route}"] ` : '';
        out.push(`${scope}${it.sel}{${d.map((x) => x + ' !important').join(';')}}`);
    }
    return out.filter(Boolean).join('\n');
}

/* ---------- aplicar ---------- */
let model = null;
let editing = false;
const style = () => {
    let el = document.getElementById('lsl-overrides');
    if (!el) { el = document.createElement('style'); el.id = 'lsl-overrides'; document.head.appendChild(el); }
    return el;
};
export const setEditing = (v) => { editing = v; style().textContent = compile(model); };
export const isEditingNow = () => editing;

export function applyOverrides(m) {
    model = m;
    style().textContent = compile(m);
    applyNav(m?.nav ?? null);
    scheduleDom();
}

/* texto: solo se cambia si hace falta, y se recuerda el original para poder restaurarlo */
const original = new Map();
let raf = 0;
const scheduleDom = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(applyDom); };
const routeOk = (it) => !it.route || it.route === (resolve(currentRoute() || '/')?.feature.id ?? '');
const setText = (el, text) => {
    if (!el.children.length) { if (el.textContent !== text) el.textContent = text; return; }
    const node = [...el.childNodes].find((n) => n.nodeType === 3 && n.nodeValue.trim());
    if (node && node.nodeValue !== text) node.nodeValue = text;
};
function applyDom() {
    const want = new Map();
    for (const it of model?.items ?? []) {
        if (it.enabled === false || typeof it.text !== 'string' || !routeOk(it) || !safeSel(it.sel)) continue;
        document.querySelectorAll(it.sel).forEach((el) => want.set(el, it.text));
    }
    for (const [el, txt] of original) {
        if (!want.has(el) || !el.isConnected) { if (el.isConnected) setText(el, txt); original.delete(el); }
    }
    for (const [el, text] of want) {
        if (!original.has(el)) original.set(el, el.children.length ? ([...el.childNodes].find((n) => n.nodeType === 3 && n.nodeValue.trim())?.nodeValue ?? '') : el.textContent);
        setText(el, text);
    }
}
let observer;
export function installOverrides() {
    observer = new MutationObserver(scheduleDom);
    for (const id of ['app', 'layers']) { const n = document.getElementById(id); if (n) observer.observe(n, { childList: true, subtree: true, characterData: true }); }
    bus.on('route', scheduleDom);
    // "Al tocar…": se atrapa el toque antes que nadie (captura). En modo edición no actúa, para poder navegar y editar.
    document.addEventListener('click', (e) => {
        if (editing || !model) return;
        for (const it of model.items ?? []) {
            if (it.enabled === false || !it.action || it.action.type === 'default' || !routeOk(it) || !safeSel(it.sel)) continue;
            let hit = null;
            try { hit = e.target.closest?.(it.sel); } catch { /* selector inválido */ }
            if (!hit) continue;
            e.preventDefault();
            e.stopPropagation();
            const v = String(it.action.value ?? '');
            if (it.action.type === 'go' && v.startsWith('/')) navigate(v);
            else if (it.action.type === 'url' && /^https?:\/\//i.test(v)) window.open(v, '_blank', 'noopener');
            return;
        }
    }, true);
}

/* ---------- secciones (barra inferior / menú) ---------- */
/** Secciones creadas por proyectos del Creador: id → 'tab' | 'drawer'. Se mantienen aunque cambies el orden en el editor. */
export const modNav = new Map();
export const refreshNav = () => applyNav(model?.nav ?? null);
let nav0 = null;
export function navOriginal() { return nav0 ?? (nav0 = { tabs: [...NAV.tabs], drawer: [...NAV.drawer], disabled: [...NAV.disabled] }); }
function applyNav(n) {
    const o = navOriginal();
    const next = n ?? o;
    const ok = (id) => !!featureById(id);
    const set = (arr, v) => arr.splice(0, arr.length, ...v);
    const disabled = (next.disabled ?? []).filter((id) => ok(id) && id !== 'admin' && id !== 'home');
    const a = JSON.stringify([NAV.tabs, NAV.drawer, NAV.disabled]);
    const tabs = (next.tabs ?? []).filter(ok), drawer = (next.drawer ?? []).filter(ok);
    for (const [id, where] of modNav) {
        if (ok(id) && !tabs.includes(id) && !drawer.includes(id) && !disabled.includes(id))
            (where === 'tab' ? tabs : drawer).push(id);
    }
    set(NAV.tabs, tabs);
    set(NAV.drawer, drawer);
    set(NAV.disabled, disabled);
    if (a !== JSON.stringify([NAV.tabs, NAV.drawer, NAV.disabled])) bus.emit('prefs', undefined); // vuelve a dibujar barras y menú
}
