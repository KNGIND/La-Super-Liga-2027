/* CREADOR DE PROYECTOS (panel → Creador)
   Un "proyecto" es una pieza que sumás a la app pegando código: una isla dinámica, un cartel, una sección nueva…
   Se identifica por su NOMBRE: si el nombre es nuevo, se CREA; si ya existe, se REEMPLAZA (la versión anterior queda
   en el historial). La consola lo monta sola donde corresponde (global / dentro de una pantalla / sección nueva),
   sin que tengas que tocar otros archivos, y lo prueba antes de guardar para no romper la página.
   Para hacerlo permanente como archivos del código: "Descargar archivos" (ver src/mods/registry.js). */
import { openModal, confirmDialog, toast } from '../../components/modals/index.js';
import { openLayer, closeLayer } from '../../core/layers.js';
import { icon } from '../../components/icons.js';
import { notice } from '../../components/loaders/index.js';
import { FILE_MODS } from '../../mods/registry.js';
import { deleteProject, getMods, hasLocalOnly, pushLocalToCloud, saveProject, storageLabel, canSaveMods } from '../../services/mods/store.js';
import { isRunning, projectStatus, releaseProject, startProject, stopProject, syncProjects } from '../../services/mods/runtime.js';
import { safeMode } from '../../services/mods/safe.js';
import { kvDel, kvGet, kvSet } from '../../services/storage/kv.js';
import { downloadText, esc, pickFile } from '../../utils/dom.js';
import { downloadBlob, makeZip } from '../../utils/zip.js';
import { FEATURES } from '../registry.js';
import { TEMPLATES } from './templates.js';

const MOUNTS = { global: 'Flotante (toda la app)', screen: 'Dentro de una pantalla', section: 'Sección nueva' };
const STATE = { ok: 'Funcionando', error: 'Con error', warn: 'Con avisos', off: 'Apagado', safe: 'Modo seguro', quarantine: 'En cuarentena' };
export const slug = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const lines = (t) => (t ? String(t).split('\n').length : 0);
const MAX_BYTES = 350 * 1024;
let localPending = false;
void hasLocalOnly().then((v) => { localPending = v; });

/* ---------- diseñador de navegación (Administración → Diseño de la app en general) ---------- */
const NAV_PROJECT_ID = 'diseno-navegacion-global';
const NAV_DEFAULTS = {
    style: 'island', width: 92, height: 64, radius: 28, gap: 5, blur: 22, opacity: 82,
    font: 11, icon: 22, speed: 260, bg: '#17191f', text: '#e9edf5', accent: '#3987ff', border: '#ffffff',
    labels: true, icons: true, shadow: true, active: true, glow: false,
};
function navColor(hex, alpha = 100) {
    const h = String(hex || '#ffffff').replace('#', '');
    const n = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
    const r = parseInt(n.slice(0, 2), 16) || 0, g = parseInt(n.slice(2, 4), 16) || 0, b = parseInt(n.slice(4, 6), 16) || 0;
    return `rgba(${r},${g},${b},${Math.max(0, Math.min(100, alpha)) / 100})`;
}
function navigationCss(c) {
    const bg = navColor(c.bg, c.opacity);
    const border = navColor(c.border, 35);
    const shadow = c.shadow ? '0 12px 36px rgba(0,0,0,.25)' : 'none';
    const radius = `${c.radius}px`, gap = `${c.gap}px`, blur = `blur(${c.blur}px)`;
    let layout = '';
    if (c.style === 'island') layout = `.dock{left:50%!important;right:auto!important;bottom:calc(env(safe-area-inset-bottom) + 10px)!important;transform:translateX(-50%)!important;width:min(${c.width}%,560px)!important;background:transparent!important;border:0!important;padding:0!important}.dock__inner{width:100%!important;max-width:none!important;height:${c.height}px!important;border-radius:${radius}!important;gap:${gap}!important;padding:5px!important;background:${bg}!important;backdrop-filter:${blur}!important;-webkit-backdrop-filter:${blur}!important;border:1px solid ${border}!important;box-shadow:${shadow}!important}`;
    if (c.style === 'dock') layout = `.dock__inner{height:${c.height}px!important;border-radius:${radius}!important;gap:${gap}!important;background:${bg}!important;backdrop-filter:${blur}!important;-webkit-backdrop-filter:${blur}!important;border:1px solid ${border}!important;box-shadow:${shadow}!important}`;
    if (c.style === 'bar') layout = `.dock{background:${bg}!important;border-top:1px solid ${border}!important;backdrop-filter:${blur}!important;-webkit-backdrop-filter:${blur}!important}.dock__inner{width:100%!important;max-width:none!important;height:${c.height}px!important;border-radius:0!important;gap:${gap}!important}`;
    if (c.style === 'rail') layout = `.dock{display:none!important}#rail.rail{display:flex!important;position:fixed!important;z-index:60!important;left:10px!important;top:50%!important;bottom:auto!important;transform:translateY(-50%)!important;width:76px!important;height:auto!important;max-height:75vh!important;overflow:auto!important;flex-direction:column!important;align-items:stretch!important;padding:8px!important;gap:${gap}!important;border:1px solid ${border}!important;border-radius:${radius}!important;background:${bg}!important;backdrop-filter:${blur}!important;-webkit-backdrop-filter:${blur}!important;box-shadow:${shadow}!important}.rail__item{flex-direction:column!important;justify-content:center!important;text-align:center!important}`;
    if (c.style === 'sidebar') layout = `.dock{display:none!important}#rail.rail{display:flex!important;position:fixed!important;z-index:60!important;left:10px!important;top:80px!important;bottom:12px!important;width:190px!important;height:auto!important;overflow:auto!important;flex-direction:column!important;align-items:stretch!important;padding:10px!important;gap:${gap}!important;border:1px solid ${border}!important;border-radius:${radius}!important;background:${bg}!important;backdrop-filter:${blur}!important;-webkit-backdrop-filter:${blur}!important;box-shadow:${shadow}!important}.rail__item{flex-direction:row!important;justify-content:flex-start!important;text-align:left!important}`;
    if (c.style === 'top') layout = `.dock{top:calc(env(safe-area-inset-top) + 66px)!important;bottom:auto!important;left:12px!important;right:12px!important;background:transparent!important;border:0!important;padding:0!important}.dock__inner{width:100%!important;max-width:none!important;height:${c.height}px!important;border-radius:${radius}!important;background:${bg}!important;backdrop-filter:${blur}!important;-webkit-backdrop-filter:${blur}!important;box-shadow:${shadow}!important;gap:${gap}!important}`;
    if (c.style === 'drawer') layout = `.dock{display:none!important}#rail.rail{display:none!important}`;
    return `${layout}.dock__item,.rail__item{color:${c.text}!important;font-size:${c.font}px!important;gap:${gap}!important;transition:all ${c.speed}ms ease!important}.dock__item__ico svg,.rail__item__ico svg{width:${c.icon}px!important;height:${c.icon}px!important}.dock__item__label,.rail__item__label{${c.labels ? '' : 'display:none!important;'}font-size:${c.font}px!important}.dock__item__ico,.rail__item__ico{${c.icons ? '' : 'display:none!important;'}}.dock__item.is-active,.rail__item.is-active{color:${c.accent}!important;${c.active ? `background:${navColor(c.accent, 20)}!important;` : 'background:transparent!important;'}${c.glow ? `filter:drop-shadow(0 0 7px ${c.accent})!important;` : ''}}.dock__item:active,.rail__item:active{transform:scale(.96)!important}@media(prefers-reduced-motion:reduce){.dock__item,.rail__item{transition:none!important}}`;
}
export function navigationDesignerHtml() {
    const saved = getMods().projects[NAV_PROJECT_ID]?.settings?.navigationConfig ?? {};
    const c = { ...NAV_DEFAULTS, ...saved };
    const range = (key, label, min, max, unit) => `<label class="field nav-design__field"><span class="field__label">${label} <b data-nav-value="${key}">${c[key]}${unit}</b></span><input class="input" type="range" data-nav-field="${key}" min="${min}" max="${max}" value="${c[key]}"></label>`;
    const color = (key, label) => `<label class="field nav-design__field"><span class="field__label">${label}</span><input class="input" type="color" data-nav-field="${key}" value="${esc(c[key])}"></label>`;
    const check = (key, label) => `<label class="check"><input type="checkbox" data-nav-field="${key}" ${c[key] ? 'checked' : ''}><span class="check__box"></span><span>${label}</span></label>`;
    return `<section class="stack nav-design-page">
      <div class="card card--pad stack"><h3>Diseño de la app en general</h3><p class="muted">Personalizá la apariencia global de La Súper Liga. Este espacio permitirá sumar más herramientas generales de diseño.</p></div>
      <div class="card card--pad stack">
      <div class="nav-design__intro"><span class="adm-mod__ico">${icon('palette', 20)}</span><div class="grow"><b>Diseñador de navegación</b><small class="muted">Configurá la navegación principal y publicá el diseño para todos los usuarios.</small></div></div>
      <label class="field"><span class="field__label">Tipo de navegación</span><select class="input" data-nav-field="style">${[['island','Isla flotante'],['dock','Dock inferior'],['bar','Barra inferior completa'],['rail','Rail lateral compacto'],['sidebar','Sidebar lateral expandida'],['top','Pestañas superiores'],['drawer','Solo menú hamburguesa']].map(([v,t]) => `<option value="${v}" ${c.style === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <div class="form-grid">${range('width','Ancho',55,100,'%')}${range('height','Alto',42,100,' px')}${range('radius','Redondez',0,44,' px')}${range('gap','Separación',0,18,' px')}${range('blur','Blur',0,40,' px')}${range('opacity','Opacidad',20,100,'%')}${range('font','Tamaño del texto',8,16,' px')}${range('icon','Tamaño de íconos',14,32,' px')}${range('speed','Velocidad de animación',0,700,' ms')}</div>
      <h4>Colores</h4><div class="form-grid">${color('bg','Fondo')}${color('text','Texto')}${color('accent','Elemento activo')}${color('border','Borde')}</div>
      <h4>Elementos y efectos</h4><div class="stack stack--sm">${check('labels','Mostrar nombres')}${check('icons','Mostrar íconos')}${check('shadow','Sombra')}${check('active','Fondo de sección activa')}${check('glow','Brillo de acento')}</div>
      <div class="row row--wrap"><button class="btn" type="button" data-nav-preview>${icon('eye',16)} Previsualizar acá</button><button class="btn" type="button" data-nav-clear>Quitar vista previa</button><button class="btn btn--primary" type="button" data-nav-save ${canSaveMods() ? '' : 'disabled'}>${icon('save',16)} Publicar para todos</button></div>
      <small class="muted">${esc(storageLabel())}. La publicación global requiere que Supabase tenga activa la migración 004_site_mods.sql.</small>
      </div></section>`;
}
function readNavigationConfig(root) {
    const c = { ...NAV_DEFAULTS };
    root.querySelectorAll('[data-nav-field]').forEach((el) => {
        const key = el.dataset.navField;
        c[key] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value;
    });
    return c;
}
function updateNavigationValues(root) {
    root.querySelectorAll('[data-nav-value]').forEach((el) => {
        const input = root.querySelector(`[data-nav-field="${el.dataset.navValue}"]`);
        if (input) el.textContent = input.value + (input.dataset.navField === 'width' || input.dataset.navField === 'opacity' ? '%' : input.dataset.navField === 'speed' ? ' ms' : ' px');
    });
}

/* ---------- lista ---------- */
export function creatorHtml() {
    const m = getMods();
    const list = Object.values(m.projects).sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')));
    const card = (p, file) => {
        const st = file ? projectStatus(p.id) : projectStatus(p.id);
        const state = !p.enabled ? 'off' : st.state;
        return `<div class="card card--pad mod-card" data-mod-card="${esc(p.id)}">
      <div class="mod-card__top"><span class="adm-mod__ico">${icon(p.mount === 'section' ? 'puzzle' : p.mount === 'screen' ? 'layers' : 'zap', 20)}</span>
        <div class="grow"><b>${esc(p.name)}</b><br><small class="muted">${esc(MOUNTS[p.mount] ?? p.mount)}${p.mount === 'screen' ? ` · ${esc(FEATURES.find((f) => f.id === p.screen)?.title ?? p.screen)}` : ''} · ${file ? 'archivo' : 'v' + p.version}</small></div>
        <span class="mod-state mod-state--${state}">${STATE[state] ?? state}</span>
        ${file ? '' : `<input type="checkbox" class="switch" data-mod-on="${esc(p.id)}" ${p.enabled ? 'checked' : ''} aria-label="Activar o desactivar ${esc(p.name)}">`}</div>
      ${st.message && p.enabled ? `<small class="form-error" style="display:block">${esc(st.message)}</small>` : ''}
      <div class="mod-card__acts">${file ? '<small class="muted">Viene de src/mods/registry.js (se edita en el código).</small>' : `
        <button class="btn btn--sm" data-mod-edit="${esc(p.id)}">${icon('pencil', 16)} Editar</button>
        <button class="btn btn--sm" data-mod-zip="${esc(p.id)}">${icon('package', 16)} Archivos</button>
        ${st.state === 'quarantine' && p.enabled ? `<button class="btn btn--sm btn--primary" data-mod-release="${esc(p.id)}">${icon('refresh', 16)} Reintentar acá</button>` : ''}
        <button class="btn btn--sm btn--danger" data-mod-del="${esc(p.id)}">${icon('trash', 16)}</button>`}</div></div>`;
    };
    return `
    ${safeMode() ? notice('Modo seguro activo: los proyectos no se ejecutan. Podés editarlos y apagarlos; para volver a la normalidad entrá con ?safe=0.', 'warn') : ''}
    ${m.tableMissing ? notice('Falta crear la tabla en Supabase (migración 004_site_mods.sql). Mientras tanto, los proyectos se guardan solo en este dispositivo.', 'warn') : ''}
    <div class="card card--pad stack"><h3>Creador de proyectos</h3>
      <p class="muted">Pegá código para sumar cosas nuevas a la app (diseño, funciones, secciones) sin tocar los archivos del proyecto. Se guardan en: <b>${esc(storageLabel())}</b>.</p>
      <div class="row row--wrap"><button class="btn btn--primary" data-mod-new ${canSaveMods() ? '' : 'disabled'}>${icon('plus', 18)} Nuevo proyecto</button><button class="btn" data-mod-import>${icon('upload', 18)} Importar</button>
      ${localPending && m.source === 'cloud' ? `<button class="btn" data-mod-push>${icon('upload', 18)} Subir lo local a la nube</button>` : ''}</div>
      <p class="muted"><small>⚠ Un proyecto es código que ejecuta cada persona que abre la app. Solo un admin puede guardarlos, pero pegá únicamente código que entiendas o que confíes. Nunca pongas claves secretas: el código se puede ver.</small></p></div>
    <div class="stack mt-3">${[...FILE_MODS.map((f) => card({ ...f, enabled: true, version: 1 }, true)), ...list.map((p) => card(p, false))].join('') || '<div class="card card--pad muted">Todavía no hay proyectos. Creá el primero con “Nuevo proyecto” (podés arrancar con la plantilla de Isla dinámica).</div>'}</div>`;
}

export function installNavigationDesigner(ctx) {
    const get = (id) => getMods().projects[id];
    const previewId = 'lsl-admin-nav-preview';
    const clearNavPreview = () => document.getElementById(previewId)?.remove();
    ctx.on('input', '[data-nav-field]', () => updateNavigationValues(ctx.el));
    ctx.on('change', '[data-nav-field]', () => updateNavigationValues(ctx.el));
    ctx.on('click', '[data-nav-preview]', () => {
        const c = readNavigationConfig(ctx.el);
        let style = document.getElementById(previewId);
        if (!style) { style = document.createElement('style'); style.id = previewId; document.head.appendChild(style); }
        style.textContent = navigationCss(c);
        toast('Vista previa aplicada solo en este dispositivo.', 'info');
    });
    ctx.on('click', '[data-nav-clear]', () => { clearNavPreview(); toast('Vista previa quitada.', 'info'); });
    ctx.on('click', '[data-nav-save]', async () => {
        if (!canSaveMods()) return toast('Tu cuenta no tiene permiso para publicar diseños.', 'error');
        const c = readNavigationConfig(ctx.el);
        const prev = get(NAV_PROJECT_ID);
        const now = new Date().toISOString();
        const history = prev ? [...(prev.history ?? []), { v: prev.version, at: prev.updatedAt ?? now, js: prev.js ?? '', css: prev.css ?? '', html: prev.html ?? '' }].slice(-8) : [];
        const project = {
            ...(prev ?? {}), id: NAV_PROJECT_ID, name: 'Diseño de navegación global', mount: 'global', screen: '*', position: 'end',
            section: { title: '', icon: 'palette', nav: 'none' }, enabled: true, notes: 'Configuración publicada desde Administración → Diseño de la app en general → Diseño de navegación.',
            js: '', css: navigationCss(c), html: '', settings: { ...(prev?.settings ?? {}), navigationConfig: c },
            version: prev ? (prev.version ?? 1) + 1 : 1, createdAt: prev?.createdAt ?? now, updatedAt: now, history,
        };
        try {
            await saveProject(project);
            clearNavPreview();
            await syncProjects(getMods().projects);
            toast(getMods().source === 'cloud' ? 'Diseño publicado para todos los usuarios.' : 'Diseño guardado en este dispositivo. Falta conectar la nube para compartirlo.', 'success', 5000);
        } catch (e) {
            toast(e.message || 'No se pudo publicar el diseño.', 'error', 5000);
        }
    });
}

export function installCreator(ctx) {
    const get = (id) => getMods().projects[id];
    ctx.on('click', '[data-mod-new]', () => openStudio(null));
    ctx.on('click', '[data-mod-edit]', (el) => { const p = get(el.dataset.modEdit); if (p) openStudio(p); });
    ctx.on('click', '[data-mod-zip]', (el) => { const p = get(el.dataset.modZip); if (p) exportZip(p); });
    ctx.on('click', '[data-mod-release]', (el) => { releaseProject(el.dataset.modRelease); void syncProjects(getMods().projects); toast('Reintentando…', 'info'); });
    ctx.on('click', '[data-mod-import]', () => importFile());
    ctx.on('click', '[data-mod-push]', async () => { try { const n = await pushLocalToCloud(); localPending = false; toast(`Se subieron ${n} registros a la nube`, 'success'); } catch (e) { toast(e.message || 'No se pudo subir', 'error'); } });
    ctx.on('change', '[data-mod-on]', async (el) => {
        const p = get(el.dataset.modOn); if (!p) return;
        try { await saveProject({ ...p, enabled: el.checked, updatedAt: new Date().toISOString() }); toast(el.checked ? 'Activado' : 'Apagado', 'success'); }
        catch (e) { toast(e.message || 'No se pudo guardar', 'error'); el.checked = !el.checked; }
    });
    ctx.on('click', '[data-mod-del]', async (el) => {
        const p = get(el.dataset.modDel);
        if (!p || !(await confirmDialog(`¿Borrar el proyecto «${p.name}»? Dejá un respaldo con “Archivos” antes si lo querés recuperar.`, { danger: true, confirm: 'Borrar' }))) return;
        try { await deleteProject(p.id); toast('Proyecto borrado', 'success'); } catch (e) { toast(e.message || 'No se pudo borrar', 'error'); }
    });
}

/* ---------- exportar ---------- */
function moduleSource(p) {
    const body = String(p.js ?? '');
    const isModule = /(^|\n)\s*(export\s|import\s)/.test(body);
    const html = p.html ? `  api.host.innerHTML = ${JSON.stringify(p.html)};\n` : '';
    return isModule && !html ? body : `export default async function (api) {\n${html}${body.split('\n').map((l) => '  ' + l).join('\n')}\n}\n`;
}
function exportZip(p) {
    const meta = JSON.stringify({ id: p.id, name: p.name, mount: p.mount, screen: p.screen, position: p.position, section: p.section }, null, 2);
    const line = `{ id: '${p.id}', name: ${JSON.stringify(p.name)}, mount: '${p.mount}'${p.mount === 'screen' ? `, screen: '${p.screen}'` : ''}${p.mount === 'section' ? `, section: ${JSON.stringify(p.section ?? {})}` : ''}${p.css ? `, css: '${p.id}/style.css'` : ''}, load: () => import('./${p.id}/index.js') },`;
    const files = [
        { name: `${p.id}/index.js`, content: moduleSource(p) },
        ...(p.css ? [{ name: `${p.id}/style.css`, content: p.css }] : []),
        { name: `${p.id}/proyecto.json`, content: JSON.stringify(p, null, 2) },
        { name: `${p.id}/LEEME.txt`, content: `Proyecto «${p.name}» (v${p.version}) · mount: ${p.mount}\n\nPara dejarlo como archivos del código:\n1) Copiá la carpeta "${p.id}" dentro de src/mods/ de tu proyecto.\n2) En src/mods/registry.js agregá esta línea dentro de FILE_MODS:\n   ${line}\n3) Agregá src/mods/${p.id}/index.js${p.css ? ` y src/mods/${p.id}/style.css` : ''} a PRECACHE en sw.js y subí la versión.\n4) Apagá o borrá el proyecto en el Creador para que no corra dos veces.\n\nPara volver a cargarlo en el Creador: Importar → proyecto.json\n\nMetadatos:\n${meta}\n` },
    ];
    downloadBlob(`${p.id}.zip`, makeZip(files));
}
async function importFile() {
    const t = await pickFile('application/json,.json');
    if (!t) return;
    try { const o = JSON.parse(t); if (typeof o.name !== 'string' || !('js' in o || 'css' in o || 'html' in o)) throw new Error(); openStudio(null, { ...o, importing: true }); }
    catch { toast('Ese archivo no es un proyecto del Creador (proyecto.json).', 'error', 5000); }
}

/* ---------- estudio ---------- */
/** Separa un archivo HTML pegado entero en html / css / js. */
export function splitBundle(text) {
    let css = '', js = '';
    let rest = String(text).replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_, c) => { css += c.trim() + '\n'; return ''; });
    rest = rest.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (_, c) => { js += c.trim() + '\n'; return ''; });
    const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(rest);
    rest = (body ? body[1] : rest).replace(/<\/?(html|head|body)[^>]*>|<!doctype[^>]*>|<meta[^>]*>|<title>[\s\S]*?<\/title>/gi, '').trim();
    return { html: rest, css: css.trim(), js: js.trim() };
}

function openStudio(original, preset) {
    const base = original ?? preset ?? {};
    const P = {
        name: base.name ?? '', mount: base.mount ?? 'global', screen: base.screen ?? 'home', position: base.position ?? 'end',
        section: { title: '', icon: 'zap', nav: 'drawer', ...(base.section ?? {}) }, enabled: original ? original.enabled : true, notes: base.notes ?? '',
        js: base.js ?? '', css: base.css ?? '', html: base.html ?? '',
    };
    let tab = 'data', previewing = false, busy = false;
    const draftKey = 'mods:studio:' + (original?.id ?? 'nuevo');
    const el = document.createElement('div');
    el.className = 'layer studio';
    el.innerHTML = `<div class="studio__bar"><button class="icon-btn" data-s="close" aria-label="Cerrar">${icon('x', 22)}</button><h2 data-s-title></h2>
      <button class="btn btn--sm" data-s="test">${icon('play', 16)} Probar</button><button class="btn btn--sm btn--primary" data-s="save">Guardar</button></div>
      <div class="studio__tabs" role="tablist"></div><div class="studio__main"></div><div class="studio__status" data-s-status>Pegá tu código en JS / CSS / HTML. “Probar” lo ejecuta de verdad sin guardarlo.</div>
      <div class="studio__mini" hidden><span>Probando «<b data-s-mname></b>»</span><button class="btn btn--sm" data-s="back">Volver al código</button><button class="btn btn--sm btn--danger" data-s="stop">Detener prueba</button></div>`;
    const layer = openLayer(el, { onClose: () => { void stopPreview(true); document.documentElement.classList.remove('studio-mini'); } });
    const $ = (s) => el.querySelector(s);
    const id = () => original?.id ?? slug(P.name);
    const status = (msg, kind = '') => { const s = $('[data-s-status]'); s.textContent = msg; s.className = 'studio__status' + (kind ? ' is-' + kind : ''); };
    const sync = () => { // lee lo escrito en pantalla hacia P
        const g = (n) => el.querySelector(`[name="${n}"]`);
        if (tab === 'data') {
            P.name = g('name')?.value ?? P.name; P.mount = g('mount')?.value ?? P.mount; P.screen = g('screen')?.value ?? P.screen; P.position = g('position')?.value ?? P.position;
            P.section = { title: g('stitle')?.value ?? P.section.title, icon: g('sicon')?.value ?? P.section.icon, nav: g('snav')?.value ?? P.section.nav };
            P.enabled = g('enabled') ? g('enabled').checked : P.enabled; P.notes = g('notes')?.value ?? P.notes;
        }
        else P[tab] = $('.studio__code')?.value ?? P[tab];
    };
    let draftT;
    const saveDraft = () => { clearTimeout(draftT); draftT = setTimeout(() => void kvSet(draftKey, { ...P, at: Date.now() }), 700); };

    function badge() {
        const sid = id();
        const ex = sid && getMods().projects[sid];
        if (original) return `<span class="studio__badge studio__badge--rep">Editando · v${original.version}</span>`;
        if (!sid) return '';
        return ex ? `<span class="studio__badge studio__badge--rep">Reemplaza «${esc(ex.name)}» (v${ex.version})</span>` : '<span class="studio__badge studio__badge--new">Proyecto nuevo</span>';
    }
    function renderTabs() {
        $('[data-s-title]').textContent = P.name || 'Proyecto nuevo';
        $('.studio__tabs').innerHTML = [['data', 'Datos'], ['js', 'JS'], ['css', 'CSS'], ['html', 'HTML']].map(([k, l]) => `<button role="tab" class="studio__tab ${tab === k ? 'is-on' : ''}" data-s-tab="${k}">${l}${k !== 'data' && P[k] ? `<i>${lines(P[k])} líneas</i>` : ''}</button>`).join('');
    }
    function renderMain() {
        const main = $('.studio__main');
        if (tab !== 'data') {
            const hints = { js: '// Código JS. Recibís `api` (api.host, api.data(), api.on(...), api.navigate(...)…). Ver docs/creador.md', css: '/* Estilos del proyecto. Podés usar las variables de la app: var(--accent), var(--card)… */', html: '<!-- HTML inicial. Va dentro de api.host -->' };
            main.innerHTML = `<textarea class="studio__code" spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off" wrap="off" placeholder="${esc(hints[tab])}" aria-label="Código ${tab}">${esc(P[tab])}</textarea>`;
            return;
        }
        const screens = FEATURES.filter((f) => !f.path.includes(':') && !f.adminOnly && !f.id.startsWith('mod-'));
        main.innerHTML = `<div class="studio__form">
      <label class="field"><span class="field__label">Nombre del proyecto</span><input class="input" name="name" value="${esc(P.name)}" placeholder="ej.: Isla dinámica" ${original ? '' : 'autofocus'}><span data-s-badge style="margin-top:6px;display:block">${badge()}</span></label>
      <label class="field"><span class="field__label">Dónde va</span><select class="input" name="mount">${Object.entries(MOUNTS).map(([k, t]) => `<option value="${k}" ${P.mount === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      ${P.mount === 'screen' ? `<div class="form-grid"><label class="field"><span class="field__label">En qué pantalla</span><select class="input" name="screen"><option value="*" ${P.screen === '*' ? 'selected' : ''}>En todas</option>${screens.map((f) => `<option value="${f.id}" ${P.screen === f.id ? 'selected' : ''}>${esc(f.title)}</option>`).join('')}</select></label><label class="field"><span class="field__label">Posición</span><select class="input" name="position"><option value="start" ${P.position === 'start' ? 'selected' : ''}>Arriba</option><option value="end" ${P.position !== 'start' ? 'selected' : ''}>Abajo</option></select></label></div>` : ''}
      ${P.mount === 'section' ? `<div class="form-grid"><label class="field"><span class="field__label">Título de la sección</span><input class="input" name="stitle" value="${esc(P.section.title)}" placeholder="ej.: Resumen"></label><label class="field"><span class="field__label">Ícono</span><input class="input" name="sicon" value="${esc(P.section.icon)}" placeholder="zap, trophy, bar-chart…"></label><label class="field"><span class="field__label">Dónde aparece</span><select class="input" name="snav"><option value="drawer" ${P.section.nav === 'drawer' ? 'selected' : ''}>Menú ☰</option><option value="tab" ${P.section.nav === 'tab' ? 'selected' : ''}>Barra inferior</option><option value="none" ${P.section.nav === 'none' ? 'selected' : ''}>Solo por enlace (#/x/${esc(id() || 'nombre')})</option></select></label></div>` : ''}
      <label class="check"><input type="checkbox" name="enabled" ${P.enabled ? 'checked' : ''}><span class="check__box"></span><span>Activo (se ejecuta para todos al guardar)</span></label>
      <label class="field"><span class="field__label">Notas (opcional)</span><textarea class="input" name="notes" rows="2">${esc(P.notes)}</textarea></label>
      <div class="field"><span class="field__label">Atajos</span><div class="row row--wrap">
        <button class="btn btn--sm" data-s="template">${icon('puzzle', 16)} Usar una plantilla</button><button class="btn btn--sm" data-s="bundle">${icon('code', 16)} Pegar un HTML completo</button>${original ? `<button class="btn btn--sm" data-s="zip">${icon('package', 16)} Descargar archivos</button><button class="btn btn--sm" data-s="history">${icon('history', 16)} Versiones (${(original.history ?? []).length})</button>` : ''}</div></div></div>`;
    }
    function render() { renderTabs(); renderMain(); }
    render();

    /* --- eventos --- */
    const onInput = (e) => {
        if (e.target.matches('.studio__code')) { P[tab] = e.target.value; saveDraft(); renderTabsKeep(); return; }
        if (e.target.name === 'name') { P.name = e.target.value; $('[data-s-badge]').innerHTML = badge(); $('[data-s-title]').textContent = P.name || 'Proyecto nuevo'; saveDraft(); }
        else if (e.target.name === 'mount') { sync(); renderMain(); saveDraft(); }
    };
    let tabsT; const renderTabsKeep = () => { clearTimeout(tabsT); tabsT = setTimeout(renderTabs, 400); };
    el.addEventListener('input', onInput);
    el.addEventListener('change', (e) => { if (e.target.name) { sync(); saveDraft(); if (e.target.name === 'mount') renderMain(); } });
    el.addEventListener('keydown', (e) => { // Tab dentro del editor inserta espacios
        if (e.key === 'Tab' && e.target.matches('.studio__code')) { e.preventDefault(); const t = e.target, s = t.selectionStart; t.setRangeText('  ', s, t.selectionEnd, 'end'); P[tab] = t.value; }
        if (e.key === 'Escape') e.stopPropagation();
    });

    async function test() {
        sync();
        const sid = id();
        if (!sid) { status('Ponele un nombre al proyecto (pestaña Datos).', 'bad'); return false; }
        const probe = candidate();
        status('Probando…');
        const ok = await startProject({ ...probe, enabled: true }, { preview: true });
        previewing = true;
        const st = projectStatus(sid);
        if (ok) status(`✔ Corrió sin errores (${st.ms} ms). Si es algo visual, ya lo tenés puesto en la app.`, 'ok');
        else { previewing = false; status('✖ Falló: ' + st.message, 'bad'); }
        return ok;
    }
    async function stopPreview(restore = true) {
        if (!previewing) return;
        previewing = false;
        await stopProject(id());
        if (restore) void syncProjects(getMods().projects);
    }
    const candidate = () => {
        const sid = id();
        return { ...(original ?? {}), id: sid, name: P.name.trim(), mount: P.mount, screen: P.screen, position: P.position, section: P.section, enabled: P.enabled, notes: P.notes, js: P.js, css: P.css, html: P.html, version: original?.version ?? 1, settings: original?.settings ?? {} };
    };
    function minimize(on) {
        el.classList.toggle('is-mini', on);
        document.documentElement.classList.toggle('studio-mini', on);
        el.querySelector('.studio__mini').hidden = !on;
        if (on) el.querySelector('[data-s-mname]').textContent = P.name;
    }

    async function save() {
        if (busy) return;
        sync();
        const name = P.name.trim(), sid = id();
        if (!name || !/^[a-z0-9][a-z0-9-]{1,39}$/.test(sid)) return status('Poné un nombre (mínimo 2 letras o números).', 'bad');
        if (P.mount === 'screen' && !P.screen) return status('Elegí en qué pantalla va.', 'bad');
        if (P.mount === 'section' && !P.section.title.trim()) return status('Poné el título de la sección (pestaña Datos).', 'bad');
        if ((P.js + P.css + P.html).length > MAX_BYTES) return status('El proyecto es demasiado grande (máximo ~350 KB).', 'bad');
        const existing = getMods().projects[sid];
        busy = true;
        try {
            let replacing = false;
            if (!original && existing) { // mismo nombre que otro proyecto → se reemplaza (con confirmación)
                const ok = await confirmDialog(`Ya existe «${existing.name}» (v${existing.version}, ${lines(existing.js)} líneas de JS). ¿Reemplazarlo con este código? La versión actual queda en el historial.`, { title: 'Reemplazar proyecto', confirm: 'Reemplazar' });
                if (!ok) return;
                replacing = true;
            }
            const prev = original ? getMods().projects[original.id] ?? original : replacing ? existing : null;
            // Antes de guardar se prueba de verdad: si falla, no se publica activo.
            let enabled = P.enabled;
            await stopPreview(false);
            if (enabled && !safeMode()) {
                status('Probando antes de guardar…');
                const good = await startProject({ ...candidate(), enabled: true }, { preview: true });
                const st = projectStatus(sid);
                await stopProject(sid);
                if (!good) {
                    const keep = await confirmDialog(`El proyecto falló al probarlo:\n${st.message}\n\n¿Guardarlo igual pero APAGADO para poder corregirlo?`, { title: 'No se puede activar', confirm: 'Guardar apagado' });
                    if (!keep) return void status('✖ No se guardó: ' + st.message, 'bad');
                    enabled = false;
                }
            }
            const now = new Date().toISOString();
            const same = prev && prev.js === P.js && prev.css === P.css && prev.html === P.html;
            const history = prev ? [...(same ? [] : [{ v: prev.version, at: prev.updatedAt ?? now, js: prev.js, css: prev.css, html: prev.html }]), ...(prev.history ?? [])].slice(0, 8) : [];
            const proj = { ...candidate(), enabled, version: prev ? (same ? prev.version : prev.version + 1) : 1, createdAt: prev?.createdAt ?? now, updatedAt: now, history };
            await saveProject(proj);
            await kvDel(draftKey);
            toast(replacing ? 'Proyecto reemplazado' : original ? 'Proyecto guardado' : 'Proyecto creado', 'success');
            closeLayer(layer);
        }
        catch (e) { status('✖ No se pudo guardar: ' + (e.message || e), 'bad'); }
        finally { busy = false; }
    }

    el.addEventListener('click', async (e) => {
        const t = e.target.closest('[data-s],[data-s-tab]');
        if (!t) return;
        if (t.dataset.sTab) { sync(); tab = t.dataset.sTab; render(); return; }
        const a = t.dataset.s;
        if (a === 'close') { sync(); const dirty = JSON.stringify([P.js, P.css, P.html, P.name]) !== JSON.stringify([base.js ?? '', base.css ?? '', base.html ?? '', base.name ?? '']); if (dirty && !(await confirmDialog('Hay cambios sin guardar. ¿Salir igual? (queda un borrador en este dispositivo)', { confirm: 'Salir' }))) return; closeLayer(layer); }
        else if (a === 'save') void save();
        else if (a === 'test') { if (await test()) minimize(true); }
        else if (a === 'back') minimize(false);
        else if (a === 'stop') { minimize(false); await stopPreview(); status('Prueba detenida.'); }
        else if (a === 'zip') exportZip(candidate());
        else if (a === 'template') {
            const { el: m } = openModal({ title: 'Plantillas', body: `<div class="stack">${TEMPLATES.map((tp) => `<button class="card card--pad" style="text-align:left" data-tp="${tp.key}"><b>${esc(tp.label)}</b><br><small class="muted">${esc(tp.hint)}</small></button>`).join('')}</div>`, actions: [{ label: 'Cancelar', variant: 'ghost' }] });
            m.addEventListener('click', (ev) => {
                const b = ev.target.closest('[data-tp]'); if (!b) return;
                const tp = TEMPLATES.find((x) => x.key === b.dataset.tp);
                Object.assign(P, { name: original ? P.name : tp.name, mount: tp.mount, screen: tp.screen ?? 'home', position: tp.position ?? 'end', section: { title: '', icon: 'zap', nav: 'drawer', ...(tp.section ?? {}) }, js: tp.js, css: tp.css, html: tp.html });
                m.querySelector('[data-close]')?.click(); tab = 'data'; render(); saveDraft(); status('Plantilla cargada. Tocá “Probar” para verla funcionando.');
            });
        }
        else if (a === 'bundle') {
            const { el: m } = openModal({ title: 'Pegar un HTML completo', body: '<p class="muted">Pegá un archivo .html entero: separo solo lo que va en HTML, CSS (<style>) y JS (<script>).</p><textarea class="input" data-bundle rows="8" spellcheck="false" style="font-family:monospace;font-size:12px"></textarea>', actions: [{ label: 'Cancelar', variant: 'ghost' }, { label: 'Separar y cargar', variant: 'primary', onClick: (mm) => { const r = splitBundle(mm.querySelector('[data-bundle]').value); if (!(r.html || r.css || r.js)) { return false; } Object.assign(P, r); render(); saveDraft(); status('Listo: lo repartí en las pestañas HTML, CSS y JS.'); } }] });
            void m;
        }
        else if (a === 'history') {
            const h = original.history ?? [];
            if (!h.length) return void toast('Todavía no hay versiones anteriores', 'info');
            const { el: m } = openModal({ title: 'Versiones anteriores', body: `<div class="stack stack--sm">${h.map((v, i) => `<div class="card card--pad row"><div class="grow"><b>v${v.v}</b><br><small class="muted">${esc(new Date(v.at).toLocaleString('es-AR'))} · ${lines(v.js)} líneas JS</small></div><button class="btn btn--sm" data-restore="${i}">Cargar en el editor</button></div>`).join('')}</div>`, actions: [{ label: 'Cerrar', variant: 'ghost' }] });
            m.addEventListener('click', (ev) => { const b = ev.target.closest('[data-restore]'); if (!b) return; const v = h[+b.dataset.restore]; Object.assign(P, { js: v.js, css: v.css, html: v.html }); m.querySelector('[data-close]')?.click(); render(); saveDraft(); status(`Cargué la v${v.v} en el editor. Tocá Guardar para dejarla como versión actual.`); });
        }
    });

    // borrador sin guardar de una sesión anterior
    void kvGet(draftKey, null).then(async (d) => {
        if (!d || preset?.importing || Date.now() - d.at > 7 * 864e5) return;
        const differs = ['js', 'css', 'html', 'name'].some((k) => (d[k] ?? '') !== (P[k] ?? ''));
        if (differs && (await confirmDialog('Encontré un borrador sin guardar de este proyecto. ¿Lo retomás?', { title: 'Borrador', confirm: 'Retomar' }))) { Object.assign(P, d); render(); }
        else if (differs) await kvDel(draftKey);
    });
    if (preset?.importing) status('Proyecto importado. Revisalo y tocá Guardar.');
}
