/* EJECUCIÓN DE PROYECTOS DEL CREADOR
   Cada proyecto tiene: JS, CSS y HTML opcionales + dónde se monta (global / dentro de una pantalla / sección nueva).
   Garantías para "no romper la página":
     · cada proyecto corre aislado en try/catch; si falla al iniciar, se limpia todo lo que haya puesto y queda en CUARENTENA
       en este dispositivo (no vuelve a ejecutarse hasta que se guarde una versión nueva o lo reactives).
     · si la app se congela durante el inicio de un proyecto, al reabrir ese proyecto queda en cuarentena.
     · MODO SEGURO (?safe=1) no ejecuta nada. Ver safe.js.
   Lo que un proyecto NO puede garantizar: un bucle infinito puede congelar la pestaña (la cuarentena lo corta en el siguiente arranque). */
import { NAV } from '../../core/config.js';
import { bus } from '../../core/events.js';
import { back, currentRoute, navigate, registerFeature, resolve, unregisterFeature } from '../../core/router.js';
import { confirmDialog, toast } from '../../components/modals/index.js';
import { icon } from '../../components/icons.js';
import { FILE_MODS } from '../../mods/registry.js';
import { getData, getStatus } from '../data/index.js';
import { ls } from '../storage/kv.js';
import { currentProfile, isAdmin } from '../supabase/auth.js';
import { esc } from '../../utils/dom.js';
import { modNav, refreshNav } from './overrides.js';
import { isQuarantined, putInQuarantine, releaseQuarantine, safeMode } from './safe.js';

const K_PENDING = 'lsl27:mods:pending';
const running = new Map(); // id → registro en ejecución
const statusMap = new Map(); // id → { state: 'ok'|'error'|'warn'|'off'|'safe'|'quarantine', message, ms }
const blobIds = new Map(); // blob: url → id (para atribuir errores)
export const projectStatus = (id) => statusMap.get(id) ?? { state: 'off', message: '' };
export const isRunning = (id) => running.has(id);
const setStatus = (id, state, message = '', ms = 0) => { statusMap.set(id, { state, message, ms }); bus.emit('mods-status', id); };

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const withTimeout = (p, ms, msg) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);

/* ---------- API que recibe el proyecto ---------- */
function makeApi(rec) {
    const p = rec.p;
    const guard = (fn) => (...a) => { try { return fn(...a); } catch (e) { runtimeError(p.id, e); } };
    const key = (k) => `lsl27:mod:${p.id}:${k}`;
    const api = {
        id: p.id, name: p.name, version: p.version, host: rec.host, root: rec.host, mount: p.mount, settings: p.settings ?? {},
        data: () => getData(), status: () => getStatus(), profile: () => currentProfile(), isAdmin: () => isAdmin(),
        route: () => currentRoute(), navigate, back, toast, confirm: confirmDialog, esc, icon,
        /** Escucha eventos de la app: 'route' | 'data' | 'session' | 'prefs' | 'connection'. Se desuscribe solo al apagar el proyecto. */
        on(event, fn) { const off = bus.on(event, guard(fn)); rec.cleanups.push(off); return off; },
        listen(target, type, fn, opts) { const f = guard(fn); target.addEventListener(type, f, opts); rec.cleanups.push(() => target.removeEventListener(type, f, opts)); },
        interval(fn, ms) { const t = setInterval(guard(fn), Math.max(50, ms)); rec.cleanups.push(() => clearInterval(t)); return t; },
        timeout(fn, ms) { const t = setTimeout(guard(fn), ms); rec.cleanups.push(() => clearTimeout(t)); return t; },
        cleanup(fn) { rec.cleanups.push(fn); },
        css(text) { const s = document.createElement('style'); s.dataset.mod = p.id; s.textContent = String(text); document.head.appendChild(s); rec.styles.push(s); return s; },
        storage: {
            get: (k, fb = null) => ls.get(key(k), fb),
            set: (k, v) => ls.set(key(k), v),
            del: (k) => ls.del(key(k)),
        },
        log: (...a) => { rec.logs.push(a.map(String).join(' ')); if (rec.logs.length > 50) rec.logs.shift(); console.log(`[mod ${p.id}]`, ...a); },
    };
    return Object.freeze(api);
}

/* ---------- montaje ---------- */
const view = () => document.getElementById('view');
function mount(rec) {
    const p = rec.p;
    const host = document.createElement('div');
    host.dataset.mod = p.id;
    host.className = 'mod-host mod-host--' + (p.mount ?? 'global');
    if (p.html) host.innerHTML = p.html;
    rec.host = host;
    if (p.mount === 'screen') {
        host.classList.add('mod-slot');
        placeScreenHosts();
    }
    else if (p.mount === 'section') {
        const fid = 'mod-' + p.id;
        const sec = p.section ?? {};
        registerFeature({ id: fid, path: '/x/' + p.id, title: sec.title || p.name, icon: sec.icon || 'zap', load: async () => ({ default: (ctx) => {
            ctx.view(() => `<div class="mod-section-slot"></div>`, { on: [], after: (el) => el.querySelector('.mod-section-slot')?.appendChild(host) });
        } }) });
        rec.featureId = fid;
        if (sec.nav === 'tab' || sec.nav === 'drawer') { modNav.set(fid, sec.nav); refreshNav(); }
        bus.emit('prefs', undefined);
        if (location.hash.startsWith('#/x/' + p.id)) setTimeout(() => dispatchEvent(new HashChangeEvent('hashchange')), 0); // enlace directo a la sección
    }
    else document.body.appendChild(host);
    if (p.css) {
        if (p.kind === 'file') { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('../../mods/' + p.css, import.meta.url).href; l.dataset.mod = p.id; document.head.appendChild(l); rec.styles.push(l); }
        else { const s = document.createElement('style'); s.dataset.mod = p.id; s.textContent = p.css; document.head.appendChild(s); rec.styles.push(s); }
    }
}
/** Pantallas: el contenedor del proyecto se vuelve a poner dentro de la pantalla cada vez que ésta se redibuja. */
function placeScreenHosts() {
    const v = view();
    if (!v) return;
    const id = resolve(currentRoute() || '/')?.feature.id;
    for (const rec of running.values()) {
        if (rec.p.mount !== 'screen' || !rec.host) continue;
        const want = rec.p.screen === '*' || rec.p.screen === id;
        if (!want) { if (rec.host.isConnected) rec.host.remove(); continue; }
        if (rec.host.parentElement !== v) rec.p.position === 'start' ? v.prepend(rec.host) : v.append(rec.host);
    }
}
let obs, raf = 0;
const schedulePlace = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(placeScreenHosts); };

/* ---------- arranque / parada ---------- */
async function runCode(rec) {
    const p = rec.p;
    const api = makeApi(rec);
    let ret;
    if (p.kind === 'file') {
        const m = await p.load();
        ret = await (m.default ?? m.init)?.(api);
    }
    else {
        const src = String(p.js ?? '');
        if (!src.trim()) return;
        const tag = `\n//# sourceURL=lsl-mod-${p.id}.js`;
        if (/(^|\n)\s*(export\s+(default|const|let|var|function|async|class|\{)|import\s)/.test(src)) {
            rec.url = URL.createObjectURL(new Blob([src + tag], { type: 'text/javascript' }));
            blobIds.set(rec.url, p.id);
            const m = await import(/* @vite-ignore */ rec.url);
            ret = await (m.default ?? m.init ?? m.setup)?.(api);
        }
        else ret = await new AsyncFunction('api', src + tag)(api);
    }
    if (typeof ret === 'function') rec.cleanups.push(ret);
}

export async function startProject(p, { preview = false } = {}) {
    if (running.has(p.id)) await stopProject(p.id);
    const rec = { p, cleanups: [], styles: [], host: null, url: '', logs: [], errors: 0, preview };
    running.set(p.id, rec);
    const t0 = performance.now();
    ls.set(K_PENDING, { id: p.id, v: p.version, preview });
    try {
        mount(rec);
        await withTimeout(runCode(rec), 8000, 'El proyecto tardó más de 8 segundos en iniciar.');
        setStatus(p.id, 'ok', '', Math.round(performance.now() - t0));
        return true;
    }
    catch (e) {
        const msg = e?.message ?? String(e);
        await stopProject(p.id);
        setStatus(p.id, 'error', msg);
        if (!preview) putInQuarantine(p, msg);
        console.error(`[mod ${p.id}]`, e);
        return false;
    }
    finally { ls.del(K_PENDING); }
}

export async function stopProject(id) {
    const rec = running.get(id);
    if (!rec) return;
    running.delete(id);
    for (const fn of rec.cleanups.splice(0).reverse()) { try { fn(); } catch { /* seguimos limpiando */ } }
    rec.styles.forEach((s) => s.remove());
    rec.host?.remove();
    if (rec.featureId) { unregisterFeature(rec.featureId); modNav.delete(rec.featureId); refreshNav(); NAV.tabs.includes(rec.featureId) || NAV.drawer.includes(rec.featureId) || bus.emit('prefs', undefined); }
    if (rec.url) { blobIds.delete(rec.url); URL.revokeObjectURL(rec.url); }
}

/** Errores que ocurren DESPUÉS de iniciar (clics, temporizadores…). Se anotan; si son muchos, el proyecto se apaga. */
function runtimeError(id, e) {
    const rec = running.get(id);
    if (!rec) return;
    rec.errors++;
    const msg = e?.message ?? String(e);
    console.error(`[mod ${id}]`, e);
    setStatus(id, 'warn', msg);
    if (rec.errors >= 5) { putInQuarantine(rec.p, 'Demasiados errores: ' + msg); void stopProject(id); setStatus(id, 'quarantine', 'Se apagó solo por errores repetidos: ' + msg); toast(`El proyecto «${rec.p.name}» se apagó por errores`, 'error', 5000); }
}
const idFrom = (text) => /lsl-mod-([a-z0-9-]+)\.js/.exec(text)?.[1] ?? [...blobIds].find(([u]) => text.includes(u))?.[1];
addEventListener('error', (ev) => { const id = idFrom(`${ev.filename} ${ev.error?.stack ?? ''}`); if (id) runtimeError(id, ev.error ?? new Error(ev.message)); });
addEventListener('unhandledrejection', (ev) => { const id = idFrom(String(ev.reason?.stack ?? '')); if (id) runtimeError(id, ev.reason); });

/* ---------- sincronizar con lo guardado ---------- */
const all = (projects) => [...FILE_MODS.map((f) => ({ ...f, kind: 'file', enabled: true, version: 1 })), ...Object.values(projects ?? {})];
let queue = Promise.resolve();
/** Deja corriendo exactamente los proyectos activos. Seguro de llamar muchas veces (hace cola). */
export function syncProjects(projects) {
    queue = queue.then(async () => {
        const list = all(projects);
        const want = new Map();
        for (const p of list) {
            if (!p.enabled) { setStatus(p.id, 'off'); continue; }
            if (safeMode()) { setStatus(p.id, 'safe', 'Modo seguro'); continue; }
            if (isQuarantined(p)) { setStatus(p.id, 'quarantine', 'En cuarentena en este dispositivo (falló al iniciar)'); continue; }
            want.set(p.id, p);
        }
        for (const [id, rec] of running) {
            const n = want.get(id);
            if (!n || n.version !== rec.p.version || n.updatedAt !== rec.p.updatedAt || rec.preview) await stopProject(id);
        }
        for (const [id, p] of want) if (!running.has(id)) await startProject(p);
    }).catch((e) => console.error('[mods]', e));
    return queue;
}

/** Reactiva un proyecto que quedó en cuarentena en este dispositivo. */
export function releaseProject(id) { releaseQuarantine(id); }

/** Al arrancar: si la app se cerró/congeló en medio del inicio de un proyecto, ese proyecto va a cuarentena. */
export function recoverFromCrash(projects) {
    const pend = ls.get(K_PENDING, null);
    if (!pend) return;
    ls.del(K_PENDING);
    if (pend.preview) return void toast('La última prueba de un proyecto no terminó (¿se colgó?). El borrador sigue guardado en el Creador.', 'info', 6000);
    const p = projects?.[pend.id];
    if (p && p.version === pend.v) { putInQuarantine(p, 'La app se cerró o se colgó mientras iniciaba este proyecto.'); setStatus(p.id, 'quarantine', 'La app se colgó al iniciarlo'); }
}

export function installRuntime() {
    bus.on('route', schedulePlace);
    obs = new MutationObserver(schedulePlace);
    const pager = document.getElementById('pager');
    if (pager) obs.observe(pager, { childList: true, subtree: true });
}
export const runtimeLogs = (id) => running.get(id)?.logs ?? [];
