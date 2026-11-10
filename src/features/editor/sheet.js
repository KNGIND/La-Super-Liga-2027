/* Panel del Editor en vivo (HTML). Solo dibuja; los eventos están en index.js.
   Cada fila lleva data-k="propiedad" (elemento), data-v="--variable" (global), etc. */
import { icon } from '../../components/icons.js';
import { FEATURES } from '../registry.js';
import { esc } from '../../utils/dom.js';
import { navOriginal } from '../../services/mods/overrides.js';

export const MODES = [['element', 'Elemento', 'pointer'], ['global', 'Global', 'palette'], ['changes', 'Cambios', 'layers'], ['nav', 'Secciones', 'list']];
const TABS = [['pos', 'Posición'], ['style', 'Estilo'], ['content', 'Función'], ['adv', 'Avanzado']];
const VAR_COLORS = [['--accent', 'Color principal'], ['--bg', 'Fondo'], ['--surface', 'Barras y menús'], ['--card', 'Tarjetas'], ['--border', 'Bordes'], ['--text', 'Texto'], ['--text-2', 'Texto secundario'], ['--live', 'En vivo'], ['--success', 'Verde / éxito']];
const VAR_SIZES = [['--r-md', 'Redondeo chico (botones)', 0, 30], ['--r-lg', 'Redondeo tarjetas', 0, 40], ['--gutter', 'Margen lateral', 8, 40]];
export const VARS = { VAR_COLORS, VAR_SIZES };

const v = (S, k) => S.item?.s?.[k] ?? S.def?.[k] ?? '';
const isSet = (S, k) => S.item?.s?.[k] != null;

const rng = (S, k, label, min, max, step = 1) => `<div class="ed-row ${isSet(S, k) ? 'is-set' : ''}"><span class="ed-row__l">${label}</span>
  <input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${v(S, k)}" aria-label="${label}">
  <input class="ed-num" type="number" inputmode="decimal" data-k="${k}" step="${step}" value="${v(S, k)}" aria-label="${label} (número)">
  <button class="ed-x" data-clear="${k}" aria-label="Volver al valor original de ${label}" ${isSet(S, k) ? '' : 'disabled'}>${icon('undo', 14)}</button></div>`;
const col = (S, k, label) => `<div class="ed-row ${isSet(S, k) ? 'is-set' : ''}"><span class="ed-row__l">${label}</span>
  <input type="color" class="ed-color" data-k="${k}" value="${esc(v(S, k) || '#000000')}" aria-label="${label}"><span class="ed-hex">${esc(v(S, k) || '')}</span>
  <button class="ed-x" data-clear="${k}" aria-label="Volver al color original" ${isSet(S, k) ? '' : 'disabled'}>${icon('undo', 14)}</button></div>`;
const sel = (S, k, label, opts) => `<div class="ed-row ${isSet(S, k) ? 'is-set' : ''}"><span class="ed-row__l">${label}</span>
  <select class="ed-sel" data-k="${k}">${opts.map(([val, t]) => `<option value="${val}" ${String(v(S, k)) === String(val) ? 'selected' : ''}>${t}</option>`).join('')}</select>
  <button class="ed-x" data-clear="${k}" aria-label="Volver al valor original" ${isSet(S, k) ? '' : 'disabled'}>${icon('undo', 14)}</button></div>`;
const sw = (S, k, label, hint) => `<label class="ed-row ed-row--sw"><span class="ed-row__l"><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}</span><input type="checkbox" class="switch" data-k="${k}" ${S.item?.s?.[k] ? 'checked' : ''}></label>`;

function elementBody(S) {
    if (!S.sel) return `<div class="ed-empty">${icon('pointer', 26)}<b>Mantené apretado un elemento</b><small>Tocá normal para navegar. Cuando apretás y mantenés unos instantes, el elemento queda elegido y podés moverlo, rotarlo, cambiarle el tamaño, el color o la función.</small></div>`;
    const t = S.tab;
    const routes = FEATURES.filter((f) => !f.path.includes(':') && !f.adminOnly).map((f) => [f.path, f.title]);
    const a = S.item?.action ?? { type: 'default', value: '' };
    if (t === 'pos') return rng(S, 'x', 'Mover ←→', -400, 400) + rng(S, 'y', 'Mover ↑↓', -400, 400) + rng(S, 'rot', 'Rotación °', -180, 180) + rng(S, 'scale', 'Escala', 0.2, 3, 0.01) + rng(S, 'w', 'Ancho', 0, Math.max(innerWidth, 600)) + rng(S, 'h', 'Alto', 0, Math.max(innerHeight, 800));
    if (t === 'style') return col(S, 'color', 'Color del texto') + col(S, 'bg', 'Color de fondo') + col(S, 'bc', 'Color del borde') + rng(S, 'bw', 'Grosor del borde', 0, 12) + rng(S, 'br', 'Redondeo', 0, 80) + sel(S, 'shadow', 'Sombra', [['none', 'Sin sombra'], ['soft', 'Suave'], ['strong', 'Fuerte']]) + rng(S, 'op', 'Opacidad', 0, 1, 0.05) + rng(S, 'fs', 'Tamaño de texto', 8, 72) + sel(S, 'fw', 'Grosor de texto', [['400', 'Normal'], ['500', 'Medio'], ['600', 'Seminegrita'], ['700', 'Negrita'], ['800', 'Extranegrita']]) + rng(S, 'blur', 'Vidrio (desenfoque)', 0, 40);
    if (t === 'content') return sw(S, 'hide', 'Ocultar', 'Desaparece de la app (acá lo ves “fantasma”).') + sw(S, 'off', 'Desactivar', 'Se ve, pero no responde al toque.') +
        (S.canText ? `<label class="ed-row ed-row--col"><span class="ed-row__l">Texto</span><input class="input" data-t="text" value="${esc(S.item?.text ?? S.textNow)}" placeholder="Texto nuevo"><small class="ed-hint">Si el texto viene de los datos (nombres, marcadores) se vuelve a pisar cada vez que cambia la pantalla.</small></label>` : '') +
        `<div class="ed-row ed-row--col"><span class="ed-row__l">Al tocar</span>
          <select class="ed-sel" data-a="type"><option value="default" ${a.type === 'default' ? 'selected' : ''}>Lo de siempre</option><option value="go" ${a.type === 'go' ? 'selected' : ''}>Ir a una pantalla</option><option value="url" ${a.type === 'url' ? 'selected' : ''}>Abrir un enlace</option><option value="none" ${a.type === 'none' ? 'selected' : ''}>No hacer nada</option></select>
          ${a.type === 'go' ? `<select class="ed-sel" data-a="value">${routes.map(([p, tt]) => `<option value="${p}" ${a.value === p ? 'selected' : ''}>${esc(tt)}</option>`).join('')}</select>` : ''}
          ${a.type === 'url' ? `<input class="input" data-a="value" inputmode="url" placeholder="https://…" value="${esc(a.value)}">` : ''}
          <small class="ed-hint">Se prueba al salir del editor (acá adentro los toques siguen funcionando normal).</small></div>`;
    // avanzado
    return `<div class="ed-row ed-row--col"><span class="ed-row__l">A quién se aplica</span><select class="ed-sel" data-target>
        <option value="single" ${S.sel.mode === 'single' ? 'selected' : ''}>Solo este elemento</option>
        ${S.sel.group ? `<option value="group" ${S.sel.mode === 'group' ? 'selected' : ''}>Todos los parecidos (${S.groupCount})</option>` : ''}</select></div>
      <div class="ed-row ed-row--col"><span class="ed-row__l">En qué pantallas</span><select class="ed-sel" data-scope>
        <option value="" ${!S.item?.route && !S.scopeRoute ? 'selected' : ''}>En todas</option><option value="route" ${(S.item?.route || S.scopeRoute) ? 'selected' : ''}>Solo en ${esc(S.routeTitle)}</option></select></div>
      <label class="ed-row ed-row--col"><span class="ed-row__l">CSS libre <small>(avanzado)</small></span><textarea class="input ed-css" data-k="custom" rows="3" spellcheck="false" placeholder="ej.: letter-spacing: 2px; text-transform: uppercase;">${esc(S.item?.s?.custom ?? '')}</textarea></label>
      <div class="ed-row ed-row--col"><span class="ed-row__l">Selector</span><code class="ed-code">${esc(S.sel[S.sel.mode] || S.sel.single)}</code></div>
      <div class="ed-btnrow"><button class="btn btn--sm" data-ed="parent">${icon('arrow-up', 16)} Elegir el contenedor</button><button class="btn btn--sm btn--danger" data-ed="reset-el" ${S.item ? '' : 'disabled'}>${icon('trash', 16)} Quitar mis cambios</button></div>`;
}

function globalBody(S) {
    const sc = S.themeScope;
    const bag = S.model.vars?.[sc] ?? {};
    const cv = (name, label) => { const set = bag[name] != null; return `<div class="ed-row ${set ? 'is-set' : ''}"><span class="ed-row__l">${label}</span><input type="color" class="ed-color" data-v="${name}" value="${esc(bag[name] ?? S.varDef[name] ?? '#000000')}" aria-label="${label}"><span class="ed-hex">${esc(bag[name] ?? S.varDef[name] ?? '')}</span><button class="ed-x" data-vclear="${name}" ${set ? '' : 'disabled'} aria-label="Volver al original">${icon('undo', 14)}</button></div>`; };
    const sv = (name, label, min, max) => { const set = S.model.vars?.all?.[name] != null; const cur = parseFloat(S.model.vars?.all?.[name] ?? S.varDef[name]) || 0; return `<div class="ed-row ${set ? 'is-set' : ''}"><span class="ed-row__l">${label}</span><input type="range" data-vs="${name}" min="${min}" max="${max}" value="${cur}"><input class="ed-num" type="number" data-vs="${name}" value="${cur}"><button class="ed-x" data-vclear="${name}" data-all ${set ? '' : 'disabled'} aria-label="Volver al original">${icon('undo', 14)}</button></div>`; };
    return `<p class="ed-hint">Esto cambia toda la app a la vez (los colores y tamaños de <code>design-tokens.css</code>).</p>
      <div class="ed-row ed-row--col"><span class="ed-row__l">Colores para el tema</span><select class="ed-sel" data-theme-scope>${[['dark', 'Oscuro'], ['light', 'Claro'], ['all', 'Ambos']].map(([k, t]) => `<option value="${k}" ${sc === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      ${VAR_COLORS.map(([n, l]) => cv(n, l)).join('')}
      <div class="ed-sep">Formas y tamaños</div>
      ${VAR_SIZES.map(([n, l, a, b]) => sv(n, l, a, b)).join('')}
      <div class="ed-row ${(S.model.fontScale ?? 1) !== 1 ? 'is-set' : ''}"><span class="ed-row__l">Tamaño de textos %</span><input type="range" data-fscale min="75" max="140" value="${Math.round((S.model.fontScale ?? 1) * 100)}"><input class="ed-num" type="number" data-fscale value="${Math.round((S.model.fontScale ?? 1) * 100)}"><button class="ed-x" data-fscale-clear ${(S.model.fontScale ?? 1) !== 1 ? '' : 'disabled'} aria-label="Volver al 100%">${icon('undo', 14)}</button></div>`;
}

function changesBody(S) {
    const items = S.model.items ?? [];
    const gv = Object.values(S.model.vars ?? {}).reduce((n, o) => n + Object.keys(o ?? {}).length, 0) + ((S.model.fontScale ?? 1) !== 1 ? 1 : 0);
    return `${items.length ? items.map((it) => `<div class="ed-item ${it.enabled === false ? 'is-off' : ''}"><div class="ed-item__t"><b>${esc(it.label || it.sel)}</b><small>${esc(it.sel.length > 54 ? it.sel.slice(0, 54) + '…' : it.sel)} · ${it.route ? 'solo en esta pantalla' : 'todas las pantallas'} · ${Object.keys(it.s ?? {}).filter((k) => k !== 'inl').length + (it.text != null ? 1 : 0) + (it.action ? 1 : 0)} ajustes</small></div>
        <input type="checkbox" class="switch" data-item-on="${it.id}" ${it.enabled === false ? '' : 'checked'} aria-label="Activar o desactivar este cambio">
        <button class="icon-btn" data-item-go="${it.id}" aria-label="Elegirlo">${icon('pointer', 18)}</button><button class="icon-btn" data-item-del="${it.id}" aria-label="Borrar este cambio">${icon('trash', 18)}</button></div>`).join('') : '<div class="ed-empty"><b>Todavía no cambiaste elementos</b><small>Mantené apretado algo en la pantalla para empezar.</small></div>'}
      ${gv ? `<div class="ed-item"><div class="ed-item__t"><b>Variables globales</b><small>${gv} modificadas (pestaña Global)</small></div></div>` : ''}
      ${S.model.nav ? `<div class="ed-item"><div class="ed-item__t"><b>Secciones</b><small>Orden y visibilidad personalizados</small></div></div>` : ''}
      <div class="ed-btnrow"><button class="btn btn--sm" data-ed="export">${icon('download', 16)} Exportar</button><button class="btn btn--sm" data-ed="import">${icon('upload', 16)} Importar</button><button class="btn btn--sm btn--danger" data-ed="reset-all">${icon('trash', 16)} Restablecer todo</button></div>`;
}

const title = (id) => FEATURES.find((f) => f.id === id)?.title ?? id;
function navBody(S) {
    const base = S.model.nav ?? navOriginal();
    const dis = new Set(base.disabled ?? []);
    const row = (id, list, i, n) => `<div class="ed-item ${dis.has(id) ? 'is-off' : ''}"><div class="ed-item__t"><b>${esc(title(id))}</b></div>
      <input type="checkbox" class="switch" data-nav-on="${id}" ${dis.has(id) ? '' : 'checked'} ${id === 'home' || id === 'admin' ? 'disabled' : ''} aria-label="Mostrar ${esc(title(id))}">
      <button class="icon-btn" data-nav-up="${id}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">${icon('arrow-up', 18)}</button><button class="icon-btn" data-nav-down="${id}" ${i === n - 1 ? 'disabled' : ''} aria-label="Bajar">${icon('arrow-down', 18)}</button>
      <button class="btn btn--sm" data-nav-move="${id}">${list === 'tabs' ? 'Al menú' : 'A la barra'}</button></div>`;
    const tabs = base.tabs ?? [], drawer = base.drawer ?? [];
    return `<div class="ed-sep">Barra inferior / lateral ${tabs.length > 5 ? '<span class="chip chip--warn">más de 5 no entran bien en el celular</span>' : ''}</div>${tabs.map((id, i) => row(id, 'tabs', i, tabs.length)).join('')}
      <div class="ed-sep">Menú (☰)</div>${drawer.map((id, i) => row(id, 'drawer', i, drawer.length)).join('')}
      <div class="ed-btnrow"><button class="btn btn--sm" data-ed="nav-reset" ${S.model.nav ? '' : 'disabled'}>${icon('refresh', 16)} Volver al orden original</button></div>`;
}

export const barText = (S) => (S.dirty ? '<i class="ed-dot"></i> Sin publicar' : S.sel || !S.collapsed ? 'Todo publicado' : 'Mantené apretado algo para editarlo');
export function sheetHtml(S) {
    const top = `<div class="ed-bar">
      <button class="icon-btn ed-bar__exit" data-ed="exit" aria-label="Salir del editor">${icon('x', 20)}</button>
      <button class="icon-btn" data-ed="undo" aria-label="Deshacer" ${S.canUndo ? '' : 'disabled'}>${icon('undo', 19)}</button>
      <button class="icon-btn" data-ed="redo" aria-label="Rehacer" ${S.canRedo ? '' : 'disabled'}>${icon('redo', 19)}</button>
      <span class="ed-bar__sp">${barText(S)}</span>
      <button class="icon-btn" data-ed="collapse" aria-label="${S.collapsed ? 'Mostrar panel' : 'Achicar panel'}">${icon(S.collapsed ? 'chevron-up' : 'chevron-down', 20)}</button>
      <button class="btn btn--sm btn--primary" data-ed="publish" ${S.dirty ? '' : 'disabled'}>Publicar</button></div>`;
    if (S.collapsed) return top;
    const modes = `<div class="ed-modes" role="tablist">${MODES.map(([k, l, ic]) => `<button role="tab" class="ed-mode ${S.mode === k ? 'is-on' : ''}" data-mode="${k}" aria-selected="${S.mode === k}">${icon(ic, 16)}<span>${l}${k === 'changes' && S.model.items.length ? ` <em>${S.model.items.length}</em>` : ''}</span></button>`).join('')}</div>`;
    let head = '', body = '';
    if (S.mode === 'element') {
        head = S.sel ? `<div class="ed-sel-head"><div><b>${esc(S.label)}</b><small>${S.sel.mode === 'group' ? `${S.groupCount} elementos parecidos` : 'Un elemento'}${S.item ? ' · con cambios' : ''}</small></div></div><div class="ed-tabs">${TABS.map(([k, l]) => `<button class="ed-tab ${S.tab === k ? 'is-on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>` : '';
        body = elementBody(S);
    }
    else if (S.mode === 'global') body = globalBody(S);
    else if (S.mode === 'changes') body = changesBody(S);
    else body = navBody(S);
    const warn = !S.canSave ? `<div class="ed-warn">${icon('lock', 14)} Solo un admin puede publicar. Podés probar, pero no se va a guardar.</div>` : '';
    return `${top}${modes}${head}<div class="ed-body">${warn}${body}</div>`;
}
