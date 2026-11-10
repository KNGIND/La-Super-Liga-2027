/* EDITOR EN VIVO (solo admins)
   Cómo se usa: Admin → Editor en vivo → "Abrir editor". Después navegás normal; para EDITAR algo,
   mantené apretado ese elemento (~0,5 s). Queda elegido: mové/rotá/agrandá con el recuadro o con el panel de abajo.
   Todo es un BORRADOR hasta que tocás "Publicar" (ahí se guarda en la nube o en este dispositivo, según el almacén).
   El panel se dibuja en sheet.js; los cambios se aplican con services/mods/overrides.js. */
import { toast, openModal } from '../../components/modals/index.js';
import { bus } from '../../core/events.js';
import { currentRoute, resolve } from '../../core/router.js';
import { applyOverrides, navOriginal, setEditing } from '../../services/mods/overrides.js';
import { safeMode } from '../../services/mods/safe.js';
import { canSaveMods, emptyOverrides, getMods, saveOverrides, storageLabel } from '../../services/mods/store.js';
import { kvDel, kvGet, kvSet } from '../../services/storage/kv.js';
import { downloadText, pickFile, uid } from '../../utils/dom.js';
import { FEATURES } from '../registry.js';
import { countOf, describe, groupSelectorFor, selectorFor } from './selector.js';
import { MODES, VARS, barText, sheetHtml } from './sheet.js';

const K_DRAFT = 'mods:draft';
const LONG_MS = 480;
let on = false, rootEl, boxEl, model, savedJson = '', undo = [], redo = [], lastKey = '', lastT = 0;
const S = { mode: 'element', tab: 'pos', collapsed: false, sel: null, item: null, def: {}, themeScope: 'dark', varDef: {}, canSave: true };
const offs = [];

export const isEditing = () => on;
const snap = () => JSON.stringify(model);
const dirty = () => snap() !== savedJson;
const routeId = () => resolve(currentRoute() || '/')?.feature.id ?? '';
const routeTitle = () => resolve(currentRoute() || '/')?.feature.title ?? 'esta pantalla';

/* ---------- color ---------- */
function hex(c, fb = '#000000') {
    const m = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+))?/.exec(c || '');
    if (!m || (m[4] != null && +m[4] === 0)) return fb;
    return '#' + [m[1], m[2], m[3]].map((x) => (+x).toString(16).padStart(2, '0')).join('');
}
function readDefaults(el) {
    const cs = getComputedStyle(el);
    return {
        x: 0, y: 0, rot: 0, scale: 1, w: Math.round(el.offsetWidth || el.getBoundingClientRect().width), h: Math.round(el.offsetHeight || el.getBoundingClientRect().height),
        color: hex(cs.color), bg: hex(cs.backgroundColor, '#000000'), bc: hex(cs.borderTopColor), bw: parseFloat(cs.borderTopWidth) || 0, br: Math.round(parseFloat(cs.borderTopLeftRadius) || 0),
        op: +cs.opacity, fs: Math.round(parseFloat(cs.fontSize)), fw: String(Math.round(+cs.fontWeight / 100) * 100), blur: 0, shadow: cs.boxShadow === 'none' ? 'none' : 'soft',
    };
}
function readVarDefaults() {
    const cs = getComputedStyle(document.documentElement);
    const out = {};
    for (const [n] of VARS.VAR_COLORS) out[n] = hex(cs.getPropertyValue(n).trim(), '#000000');
    for (const [n] of VARS.VAR_SIZES) out[n] = parseFloat(cs.getPropertyValue(n)) || 0;
    return out;
}

/* ---------- modelo ---------- */
const findItem = () => (S.sel ? model.items.find((i) => i.id === S.sel.itemId) ?? model.items.find((i) => i.sel === S.sel.single && (!i.route || i.route === routeId())) ?? (S.sel.group ? model.items.find((i) => i.sel === S.sel.group && (!i.route || i.route === routeId())) : null) ?? null : null);
function pushUndo(key) {
    if (key && key === lastKey && Date.now() - lastT < 900) { lastT = Date.now(); return; }
    undo.push(snap()); if (undo.length > 60) undo.shift(); redo = []; lastKey = key || ''; lastT = Date.now();
}
function ensureItem() {
    let it = findItem();
    if (it) { S.sel.itemId = it.id; return it; }
    it = { id: uid('c'), sel: S.sel[S.sel.mode] || S.sel.single, label: S.label, route: '', enabled: true, s: {} };
    model.items.push(it);
    S.sel.itemId = it.id;
    return it;
}
function prune(it) {
    const keys = Object.keys(it.s ?? {}).filter((k) => k !== 'inl');
    if (!keys.length && it.text == null && !it.action) { model.items = model.items.filter((x) => x !== it); if (S.sel) S.sel.itemId = null; }
}
let draftT;
function commit({ redraw = false } = {}) {
    applyOverrides(model);
    S.item = findItem();
    clearTimeout(draftT);
    draftT = setTimeout(() => void (dirty() ? kvSet(K_DRAFT, model) : kvDel(K_DRAFT)), 500);
    if (redraw) renderSheet(); else { updateBar(); syncInputs(); }
    placeBox();
}
export function setProp(k, val) {
    const it = ensureItem();
    pushUndo('p:' + k);
    if (val === '' || val == null || val === false || Number.isNaN(val)) delete it.s[k]; else it.s[k] = val;
    if (['x', 'y', 'rot', 'scale', 'w', 'h'].includes(k) && getComputedStyle(S.sel.el).display === 'inline') it.s.inl = true;
    prune(it);
    commit({ redraw: ['hide', 'off', 'custom'].includes(k) ? false : false });
    if (val === '' || val == null || val === false) renderSheet(); // actualiza los botones "volver al original"
}

/* ---------- panel ---------- */
function refreshState() {
    S.model = model; S.canUndo = undo.length > 0; S.canRedo = redo.length > 0; S.dirty = dirty(); S.canSave = canSaveMods();
    S.item = findItem(); S.routeTitle = routeTitle(); S.scopeRoute = '';
    if (S.sel) {
        S.label = S.label ?? describe(S.sel.el);
        S.groupCount = S.sel.group ? countOf(S.sel.group) : 1;
        const el = S.sel.el;
        S.canText = !el.matches('input,textarea,select,img,svg') && (!el.children.length || [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim()));
        S.textNow = el.children.length ? ([...el.childNodes].find((n) => n.nodeType === 3 && n.nodeValue.trim())?.nodeValue ?? '') : el.textContent;
    }
}
function renderSheet() {
    refreshState();
    const sh = rootEl.querySelector('.ed-sheet');
    const keepScroll = sh.querySelector('.ed-body')?.scrollTop ?? 0;
    sh.innerHTML = sheetHtml(S);
    sh.classList.toggle('is-collapsed', S.collapsed);
    const b = sh.querySelector('.ed-body'); if (b) b.scrollTop = keepScroll;
    placeSheet();
}
function updateBar() {
    refreshState();
    const bar = rootEl.querySelector('.ed-bar');
    if (!bar) return;
    bar.querySelector('.ed-bar__sp').innerHTML = barText(S);
    bar.querySelector('[data-ed="publish"]').disabled = !S.dirty;
    bar.querySelector('[data-ed="undo"]').disabled = !S.canUndo;
    bar.querySelector('[data-ed="redo"]').disabled = !S.canRedo;
}
/** Pone en los controles los valores actuales sin volver a dibujar (así no se corta el arrastre de un deslizador). */
function syncInputs() {
    if (S.mode !== 'element' || !S.sel) return;
    const sh = rootEl.querySelector('.ed-sheet');
    sh.querySelectorAll('[data-k]').forEach((i) => {
        if (i === document.activeElement || i.type === 'checkbox' || i.tagName === 'TEXTAREA') return;
        const val = S.item?.s?.[i.dataset.k] ?? S.def[i.dataset.k];
        if (val != null) i.value = val;
        i.closest('.ed-row')?.classList.toggle('is-set', S.item?.s?.[i.dataset.k] != null);
        const x = i.closest('.ed-row')?.querySelector('[data-clear]'); if (x) x.disabled = S.item?.s?.[i.dataset.k] == null;
    });
}
/** El panel va arriba si lo elegido está en la mitad de abajo, para no taparlo. */
function placeSheet() {
    const sh = rootEl.querySelector('.ed-sheet');
    let top = false;
    if (S.sel?.el.isConnected && !S.collapsed) { const r = S.sel.el.getBoundingClientRect(); top = r.top + r.height / 2 > innerHeight * 0.5; }
    sh.classList.toggle('is-top', top);
}

/* ---------- recuadro de selección ---------- */
function placeBox() {
    if (!boxEl) return;
    const el = S.sel?.el;
    if (!el || !el.isConnected) { boxEl.hidden = true; return; }
    const r = el.getBoundingClientRect();
    const sc = S.item?.s?.scale ?? 1, rot = S.item?.s?.rot ?? 0;
    const w = (el.offsetWidth || r.width / sc) * sc, h = (el.offsetHeight || r.height / sc) * sc;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    boxEl.hidden = false;
    boxEl.style.cssText = `left:${cx - w / 2}px;top:${cy - h / 2}px;width:${w}px;height:${h}px;transform:rotate(${rot}deg)`;
    boxEl.classList.toggle('is-group', S.sel.mode === 'group');
}
function select(el, keepTab) {
    if (S.sel?.el === el) return;
    const single = selectorFor(el), group = groupSelectorFor(el);
    S.sel = { el, single, group, mode: 'single', itemId: null };
    const ex = model.items.find((i) => i.sel === single) ?? (group ? model.items.find((i) => i.sel === group) : null);
    if (ex) { S.sel.itemId = ex.id; S.sel.mode = ex.sel === group && ex.sel !== single ? 'group' : 'single'; }
    S.label = describe(el);
    S.def = readDefaults(el);
    S.mode = 'element'; if (!keepTab) S.tab = 'pos'; S.collapsed = false;
    navigator.vibrate?.(14);
    renderSheet(); placeBox();
}
function deselect() { S.sel = null; S.item = null; S.label = undefined; renderSheet(); placeBox(); }

/* ---------- gestos: elegir con pulsación larga; mover / rotar / agrandar ---------- */
let lp = null, lastLong = 0;
const inUi = (t) => !!t.closest?.('[data-editor-ui]');
function pick(t) {
    let el = t;
    while (el && !(el instanceof HTMLElement)) el = el.parentElement;
    if (!el || el === document.body || el === document.documentElement || el.id === 'app' || el.id === 'layers' || inUi(el)) return;
    lastLong = performance.now();
    select(el);
}
function onDown(e) {
    if (!on || (e.pointerType === 'mouse' && e.button !== 0) || inUi(e.target)) return;
    lp = { x: e.clientX, y: e.clientY, t: e.target, id: setTimeout(() => { if (lp) { pick(lp.t); lp = null; } }, LONG_MS) };
}
function onMove(e) { if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 10) { clearTimeout(lp.id); lp = null; } }
function onUp() { if (lp) { clearTimeout(lp.id); lp = null; } }
const onClickCapture = (e) => { if (on && performance.now() - lastLong < 700 && !inUi(e.target)) { e.preventDefault(); e.stopPropagation(); } };
const onCtx = (e) => { if (on && !inUi(e.target)) { e.preventDefault(); pick(e.target); } };

let drag = null;
function dragStart(kind, e) {
    if (!S.sel) return;
    e.preventDefault(); e.stopPropagation();
    const it = ensureItem();
    pushUndo(null);
    const r = S.sel.el.getBoundingClientRect();
    drag = { kind, px: e.clientX, py: e.clientY, x: it.s.x ?? 0, y: it.s.y ?? 0, rot: it.s.rot ?? 0, sc: it.s.scale ?? 1, w: it.s.w ?? S.sel.el.offsetWidth, h: it.s.h ?? S.sel.el.offsetHeight, cx: r.left + r.width / 2, cy: r.top + r.height / 2, a0: Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) };
    e.target.setPointerCapture?.(e.pointerId);
}
let dragRaf = 0;
function dragMove(e) {
    if (!drag) return;
    const it = findItem(); if (!it) return;
    const dx = e.clientX - drag.px, dy = e.clientY - drag.py;
    if (drag.kind === 'move') { it.s.x = Math.round(drag.x + dx); it.s.y = Math.round(drag.y + dy); }
    else if (drag.kind === 'rot') {
        let r = drag.rot + (Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx) - drag.a0) * 180 / Math.PI;
        r = ((r + 540) % 360) - 180;
        const snap45 = Math.round(r / 45) * 45; if (Math.abs(r - snap45) < 3) r = snap45;
        it.s.rot = Math.round(r);
    }
    else {
        const a = (drag.rot * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
        const lx = (dx * cos + dy * sin) / drag.sc, ly = (-dx * sin + dy * cos) / drag.sc;
        it.s.w = Math.max(8, Math.round(drag.w + lx)); it.s.h = Math.max(8, Math.round(drag.h + ly));
        if (getComputedStyle(S.sel.el).display === 'inline') it.s.inl = true;
    }
    if (it.s.x != null || it.s.y != null) { it.s.x ??= 0; it.s.y ??= 0; }
    cancelAnimationFrame(dragRaf);
    dragRaf = requestAnimationFrame(() => commit());
}
function dragEnd() { if (!drag) return; drag = null; renderSheet(); }

/* ---------- acciones del panel ---------- */
function afterModelSwap() { S.item = findItem(); commit({ redraw: true }); }
function doUndo() { if (!undo.length) return; redo.push(snap()); model = JSON.parse(undo.pop()); afterModelSwap(); }
function doRedo() { if (!redo.length) return; undo.push(snap()); model = JSON.parse(redo.pop()); afterModelSwap(); }

async function publish() {
    try {
        await saveOverrides(JSON.parse(snap()));
        savedJson = snap(); undo = []; redo = []; await kvDel(K_DRAFT);
        toast(getMods().source === 'cloud' ? 'Publicado para todos' : 'Guardado en este dispositivo', 'success');
        renderSheet();
        return true;
    }
    catch (e) { toast(e.message || 'No se pudo publicar', 'error', 5000); return false; }
}
async function exit() {
    if (!dirty()) return void stopEditor();
    openModal({
        title: 'Hay cambios sin publicar', body: '<p class="modal__text">Si salís sin publicar, el borrador queda guardado en este dispositivo y la app sigue como estaba para el resto.</p>',
        actions: [
            { label: 'Seguir editando', variant: 'ghost' },
            { label: 'Descartar', variant: 'danger', onClick: async () => { await kvDel(K_DRAFT); stopEditor(); } },
            { label: 'Salir (guardar borrador)', variant: 'secondary', onClick: () => { void kvSet(K_DRAFT, model); stopEditor(); } },
            { label: 'Publicar y salir', variant: 'primary', onClick: async () => { if (!(await publish())) return false; stopEditor(); } },
        ],
    });
}
const ACT = {
    exit, undo: doUndo, redo: doRedo, publish: () => void publish(),
    collapse: () => { S.collapsed = !S.collapsed; renderSheet(); },
    parent: () => { const p = S.sel?.el.parentElement; if (p && p !== document.body && p.id !== 'app' && !inUi(p)) { S.sel = null; select(p, true); S.tab = 'adv'; renderSheet(); } else toast('Ya no hay un contenedor más grande', 'info'); },
    'reset-el': () => { const it = findItem(); if (!it) return; pushUndo(null); model.items = model.items.filter((x) => x !== it); S.sel.itemId = null; afterModelSwap(); toast('Cambios del elemento quitados', 'success'); },
    'reset-all': () => { if (!model.items.length && !model.nav && !Object.values(model.vars ?? {}).some((o) => Object.keys(o).length)) return; pushUndo(null); model = emptyOverrides(); afterModelSwap(); toast('Todo restablecido (todavía sin publicar)', 'success'); },
    'nav-reset': () => { pushUndo(null); model.nav = null; afterModelSwap(); },
    export: () => downloadText('editor-en-vivo.json', JSON.stringify(model, null, 2)),
    import: async () => { const t = await pickFile('application/json,.json'); if (!t) return; try { const o = JSON.parse(t); if (!Array.isArray(o.items)) throw new Error(); pushUndo(null); model = { ...emptyOverrides(), ...o }; afterModelSwap(); toast('Importado (sin publicar todavía)', 'success'); } catch { toast('El archivo no es un respaldo del editor', 'error'); } },
};
const parseVal = (i) => (i.type === 'checkbox' ? i.checked : i.type === 'number' || i.type === 'range' ? (i.value === '' ? null : Number(i.value)) : i.value);
function navModel() { return model.nav ??= JSON.parse(JSON.stringify(navOriginal())); }
const varBag = (scope) => (model.vars[scope] ??= {});

function onInput(e) {
    const i = e.target;
    const d = i.dataset;
    if (d.k) {
        if (i.type === 'range' || i.type === 'number') i.closest('.ed-row')?.querySelectorAll(`[data-k="${d.k}"]`).forEach((o) => o !== i && (o.value = i.value));
        if (i.type === 'color') i.closest('.ed-row').querySelector('.ed-hex').textContent = i.value;
        if (d.k === 'shadow' || d.k === 'fw') return setProp(d.k, i.value);
        return setProp(d.k, parseVal(i));
    }
    if (d.t !== undefined) { const it = ensureItem(); pushUndo('t'); if (i.value === '' ) delete it.text; else it.text = i.value; prune(it); commit(); return; }
    if (d.a) {
        const it = ensureItem(); pushUndo('a'); const a = (it.action ??= { type: 'default', value: '' });
        a[d.a] = i.value;
        if (d.a === 'type') { a.value = i.value === 'go' ? '/matches' : ''; if (i.value === 'default') delete it.action; commit({ redraw: true }); return; }
        commit(); return;
    }
    if ('target' in d) { const it = findItem(); S.sel.mode = i.value; if (it) { pushUndo(null); it.sel = S.sel[i.value]; } commit({ redraw: true }); return; }
    if ('scope' in d) { const it = ensureItem(); pushUndo(null); it.route = i.value === 'route' ? routeId() : ''; commit({ redraw: true }); return; }
    if ('themeScope' in d) { S.themeScope = i.value; renderSheet(); return; }
    if (d.v) { pushUndo('v:' + d.v); varBag(S.themeScope)[d.v] = i.value; i.closest('.ed-row').querySelector('.ed-hex').textContent = i.value; commit(); i.closest('.ed-row').classList.add('is-set'); const x = i.closest('.ed-row').querySelector('[data-vclear]'); if (x) x.disabled = false; return; }
    if (d.vs) { pushUndo('vs:' + d.vs); model.vars.all[d.vs] = i.value + 'px'; i.closest('.ed-row').querySelectorAll(`[data-vs="${d.vs}"]`).forEach((o) => o !== i && (o.value = i.value)); commit(); return; }
    if ('fscale' in d) { pushUndo('fs'); model.fontScale = Math.max(0.5, Math.min(2, Number(i.value) / 100)); i.closest('.ed-row').querySelectorAll('[data-fscale]').forEach((o) => o !== i && (o.value = i.value)); commit(); return; }
    if (d.itemOn) { const it = model.items.find((x) => x.id === d.itemOn); if (it) { pushUndo(null); it.enabled = i.checked; commit({ redraw: true }); } return; }
    if (d.navOn) { const n = navModel(); pushUndo(null); n.disabled = n.disabled.filter((x) => x !== d.navOn); if (!i.checked) n.disabled.push(d.navOn); commit({ redraw: true }); }
}
function onClick(e) {
    const b = e.target.closest('button,[data-mode]');
    if (!b) return;
    const d = b.dataset;
    if (d.ed) return void ACT[d.ed]?.();
    if (d.mode) { S.mode = d.mode; if (d.mode === 'global') S.varDef = readVarDefaults(); renderSheet(); return; }
    if (d.tab) { S.tab = d.tab; renderSheet(); return; }
    if (d.clear) { const it = findItem(); if (it) { pushUndo(null); delete it.s[d.clear]; prune(it); commit({ redraw: true }); } return; }
    if (d.vclear) { pushUndo(null); if ('all' in d) delete model.vars.all[d.vclear]; else delete varBag(S.themeScope)[d.vclear]; commit({ redraw: true }); return; }
    if ('fscaleClear' in d) { pushUndo(null); model.fontScale = 1; commit({ redraw: true }); return; }
    if (d.itemDel) { pushUndo(null); model.items = model.items.filter((x) => x.id !== d.itemDel); commit({ redraw: true }); return; }
    if (d.itemGo) { const it = model.items.find((x) => x.id === d.itemGo); const el = it && document.querySelector(it.sel); if (el) { S.sel = null; select(el); S.sel.itemId = it.id; S.sel.mode = it.sel === S.sel.group && it.sel !== S.sel.single ? 'group' : 'single'; renderSheet(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } else toast('Ese elemento no está en esta pantalla', 'info'); return; }
    const n = ['navUp', 'navDown', 'navMove'].find((k) => k in d);
    if (n) {
        const id = d[n], nav = navModel(); pushUndo(null);
        const list = nav.tabs.includes(id) ? nav.tabs : nav.drawer;
        const i = list.indexOf(id);
        if (n === 'navUp' && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
        if (n === 'navDown' && i < list.length - 1) [list[i + 1], list[i]] = [list[i], list[i + 1]];
        if (n === 'navMove') { list.splice(i, 1); (list === nav.tabs ? nav.drawer : nav.tabs).push(id); }
        commit({ redraw: true });
    }
}

/* ---------- ciclo de vida ---------- */
export async function startEditor() {
    if (on) return true;
    if (safeMode()) { toast('Modo seguro activo: salí del modo seguro para editar', 'error', 5000); return false; }
    if (!canSaveMods()) { toast('Solo un admin puede usar el editor', 'error'); return false; }
    const draft = await kvGet(K_DRAFT, null);
    model = JSON.parse(JSON.stringify({ ...emptyOverrides(), ...getMods().overrides }));
    savedJson = snap();
    if (draft?.items) { model = { ...emptyOverrides(), ...draft }; toast('Retomé tu borrador sin publicar', 'info', 4000); }
    undo = []; redo = [];
    on = true;
    Object.assign(S, { mode: 'element', tab: 'pos', collapsed: true, sel: null, item: null, themeScope: document.documentElement.dataset.theme === 'light' ? 'light' : 'dark', varDef: {} });
    document.documentElement.classList.add('is-editing');
    setEditing(true);
    applyOverrides(model);
    rootEl = document.createElement('div');
    rootEl.id = 'ed-root'; rootEl.dataset.editorUi = '';
    rootEl.innerHTML = '<div class="ed-box" hidden data-editor-ui><i class="ed-chip"></i><button class="ed-h ed-h--rot" aria-label="Rotar"></button><button class="ed-h ed-h--size" aria-label="Cambiar tamaño"></button></div><section class="ed-sheet" data-editor-ui aria-label="Editor en vivo"></section>';
    document.body.appendChild(rootEl);
    boxEl = rootEl.querySelector('.ed-box');
    const sh = rootEl.querySelector('.ed-sheet');
    sh.addEventListener('input', onInput); sh.addEventListener('change', onInput); sh.addEventListener('click', onClick);
    boxEl.addEventListener('pointerdown', (e) => dragStart(e.target.closest('.ed-h--rot') ? 'rot' : e.target.closest('.ed-h--size') ? 'size' : 'move', e));
    rootEl.addEventListener('pointermove', dragMove); rootEl.addEventListener('pointerup', dragEnd); rootEl.addEventListener('pointercancel', dragEnd);
    const L = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)); };
    L(document, 'pointerdown', onDown, true); L(document, 'pointermove', onMove, true); L(document, 'pointerup', onUp, true); L(document, 'pointercancel', onUp, true);
    L(document, 'click', onClickCapture, true); L(document, 'contextmenu', onCtx, true);
    L(window, 'scroll', placeBox, true); L(window, 'resize', () => { placeBox(); placeSheet(); });
    offs.push(bus.on('route', () => { if (S.sel && !S.sel.el.isConnected) deselect(); }));
    const poll = setInterval(() => {
        if (!S.sel) return;
        if (!S.sel.el.isConnected) { const again = document.querySelector(S.sel[S.sel.mode] || S.sel.single); if (again) S.sel.el = again; else return deselect(); }
        placeBox();
    }, 300);
    offs.push(() => clearInterval(poll));
    renderSheet();
    return true;
}

export function stopEditor() {
    if (!on) return;
    on = false;
    offs.splice(0).forEach((f) => f());
    rootEl?.remove(); rootEl = boxEl = null;
    document.documentElement.classList.remove('is-editing');
    setEditing(false);
    applyOverrides(getMods().overrides); // vuelve a lo publicado
    S.sel = null;
}
export const editorInfo = () => ({ storage: storageLabel(), modes: MODES.length, features: FEATURES.length });
