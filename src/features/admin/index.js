/* PANEL DE ADMINISTRACIÓN
   - Modo nube: solo entran cuentas con rol admin/editor. El servidor igual verifica cada escritura (RLS).
   - Modo local: contraseña local (protege contra curiosos, NO es seguridad real: los datos son un borrador de este dispositivo).
   - Modo legacy (app vieja): solo lectura hasta correr las migraciones. */
import { bindColorFields, checkField, colorField, readForm, selectField, textArea, textField } from '../../components/inputs/index.js';
import { emptyState, notice } from '../../components/loaders/index.js';
import { confirmDialog, openModal, toast } from '../../components/modals/index.js';
import { icon } from '../../components/icons.js';
import { canWrite, deleteRow, exportDataset, getData, getStatus, importDataset, refresh, resetLocal, saveLeague, saveRow } from '../../services/data/index.js';
import { settleLocal } from '../../services/data/predictions.js';
import { kvGet, kvSet } from '../../services/storage/kv.js';
import { loadLeaderboard } from '../../services/data/predictions.js';
import { currentProfile, listUsers, setUserRole } from '../../services/supabase/auth.js';
import { SbError, rpc } from '../../services/supabase/client.js';
import { downloadText, esc, norm, pickFile } from '../../utils/dom.js';
import { csvToRows, entityToCsv } from './csv.js';
import { resizeImage } from '../../utils/image.js';
import { ENTITIES, entityOf, formToValue, rowToForm } from './schemas.js';
import { creatorHtml, installCreator, navigationDesignerHtml, installNavigationDesigner } from './creator.js';
import { getMods, storageLabel } from '../../services/mods/store.js';
import { safeMode } from '../../services/mods/safe.js';
/* ---------- contraseña local ---------- */
let unlocked = false;
async function hash(s) {
    if (crypto.subtle) {
        const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('lsl27:' + s));
        return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
    }
    let h = 5381; // http sin https: no hay crypto.subtle → hash simple (solo cosmético)
    for (const c of 'lsl27:' + s)
        h = ((h << 5) + h + c.charCodeAt(0)) | 0;
    return 'x' + h;
}
/* ---------- formulario genérico ---------- */
function fieldHtml(f, v, d) {
    const val = rowToForm(f, v);
    const base = { name: f.name, label: f.label, required: f.required, hint: f.hint };
    switch (f.type) {
        case 'select': return selectField({ ...base, value: val, options: f.options(d) });
        case 'textarea':
        case 'events':
        case 'lineup': return textArea({ ...base, value: val, rows: f.rows });
        case 'number': return textField({ ...base, value: val, type: 'number' });
        case 'datetime': return textField({ ...base, value: val, type: 'datetime-local' });
        case 'color': return colorField({ ...base, value: val });
        case 'check': return checkField({ ...base, checked: !!v });
        case 'image': return `<div class="field"><span class="field__label">${esc(f.label)}</span><div class="color-row"><input class="input" name="${esc(f.name)}" value="${esc(val.startsWith('data:') ? '(imagen cargada)' : val)}" data-imgurl placeholder="https://… o subí un archivo"><label class="btn btn--sm" style="align-self:center">${icon('upload', 16)}<input type="file" accept="image/*" hidden data-img="${esc(f.name)}"></label></div>${val.startsWith('data:') ? `<img src="${esc(val)}" alt="" style="max-height:64px;margin-top:8px;border-radius:8px">` : ''}</div>`;
        default: return textField({ ...base, value: val });
    }
}
function openEntityForm(e, original, onSaved) {
    const d = getData();
    const row = original ?? e.blank(d);
    const images = {};
    const { el } = openModal({
        title: `${original ? 'Editar' : 'Nuevo'} ${e.singular}`,
        wide: true,
        body: `<form class="form-grid" data-form novalidate>${e.fields.map((f) => `<div style="${['textarea', 'events', 'lineup', 'image'].includes(f.type) ? 'grid-column:1/-1' : ''}">${fieldHtml(f, row[f.name], d)}</div>`).join('')}</form><p class="form-error" data-err role="alert" hidden></p>`,
        actions: [
            { label: 'Cancelar', variant: 'ghost' },
            {
                label: 'Guardar', variant: 'primary',
                onClick: async (m) => {
                    const err = m.querySelector('[data-err]');
                    const raw = readForm(m.querySelector('[data-form]'));
                    const next = { ...row };
                    try {
                        for (const f of e.fields) {
                            if (f.type === 'image') {
                                next[f.name] = images[f.name] ?? (String(raw[f.name]).startsWith('(imagen') ? row[f.name] : String(raw[f.name]).trim());
                                continue;
                            }
                            if (f.required && typeof raw[f.name] === 'string' && !String(raw[f.name]).trim())
                                throw new Error(`Falta completar: ${f.label}.`);
                            next[f.name] = formToValue(f, raw[f.name]);
                        }
                        const bad = e.validate?.(next, d);
                        if (bad)
                            throw new Error(bad);
                        await saveRow(e.table, next);
                        for (const extra of e.afterSave?.(next, getData()) ?? [])
                            await saveRow(e.table, extra);
                        toast('Guardado', 'success');
                        onSaved();
                    }
                    catch (x) {
                        err.hidden = false;
                        err.textContent = x instanceof SbError ? x.friendly : x.message;
                        return false;
                    }
                },
            },
        ],
        onMount: (m) => {
            bindColorFields(m);
            m.addEventListener('change', async (ev) => {
                const inp = ev.target;
                if (!inp.dataset.img || !inp.files?.[0])
                    return;
                try {
                    images[inp.dataset.img] = await resizeImage(inp.files[0], inp.dataset.img === 'image' ? 900 : 256);
                    m.querySelector(`[name="${inp.dataset.img}"]`).value = '(imagen cargada)';
                    toast('Imagen lista', 'success');
                }
                catch (x) {
                    toast(x.message, 'error');
                }
            });
        },
    });
    void el;
}
/* ---------- módulos del panel (menú tipo "consola") ----------
   Para agregar una sección al menú: sumala acá [ícono, grupo] y en tabs (más abajo). */
const GROUPS = ['Competición', 'Equipos', 'Contenido', 'Comunidad', 'Personalizar', 'Diseño de la app en general', 'Sistema'];
const MODS = {
    matches: ['ball', 'Competición'], competitions: ['trophy', 'Competición'], seasons: ['calendar', 'Competición'], zones: ['award', 'Competición'],
    teams: ['shield', 'Equipos'], players: ['users', 'Equipos'],
    news: ['newspaper', 'Contenido'], channels: ['tv', 'Contenido'], sanctions: ['shield-alert', 'Contenido'], notifications: ['bell', 'Contenido'],
    predictions: ['target', 'Comunidad'], users: ['user', 'Comunidad'],
    editor: ['pencil', 'Personalizar'], creator: ['code', 'Personalizar'], navigation: ['palette', 'Diseño de la app en general'],
    league: ['sliders', 'Sistema'], data: ['database', 'Sistema'],
};
const isWide = () => matchMedia('(min-width: 900px)').matches;

/* ---------- pantalla ---------- */
const admin = (ctx) => {
    let tab = ''; // '' = menú del panel (celular); en pantallas grandes se abre la primera sección sola
    let msg = '';
    let q = ''; // texto del buscador de la lista
    let users = null;
    let board = null; // ranking de pronósticos (solo nube)
    const roleOk = (e) => {
        const st = getStatus();
        if (st.mode !== 'cloud')
            return true;
        const r = currentProfile()?.role;
        return !!r && r !== 'user' && e.roles.includes(r);
    };
    ctx.view(() => {
        const st = getStatus();
        const prof = currentProfile();
        const d = getData();
        if (st.mode === 'cloud' && (!prof || prof.role === 'user'))
            return `<div class="card gate">${icon('lock', 28)}<h2>Acceso restringido</h2><p class="muted">${prof ? 'Tu cuenta no tiene permisos de administración.' : 'Iniciá sesión con una cuenta de administrador o editor.'}</p><a class="btn btn--primary" href="#/profile">Ir a mi perfil</a><p class="muted mt-3"><small>¿Todavía no sos admin? Registrate desde tu perfil y después, en Supabase → SQL Editor, ejecutá: <code>update lsl2_profiles set role = 'admin' where email = 'tu@email.com';</code> (pasos completos en docs/supabase.md).</small></p></div>`;
        if (st.mode === 'local' && !unlocked) {
            const has = ctx.el.dataset.hasPass === '1';
            return `<form class="card gate" data-gate>${icon('lock', 28)}<h2>${has ? 'Panel de administración' : 'Creá una contraseña local'}</h2>
        <p class="muted">${has ? 'Escribí la contraseña de este dispositivo.' : 'Protege el panel en este dispositivo. Los cambios que hagas quedan como borrador local.'}</p>
        <label class="field"><span class="field__label">Contraseña</span><input class="input" type="password" name="p" autocomplete="${has ? 'current-password' : 'new-password'}" required minlength="4"></label>
        <p class="form-error" data-gate-err hidden></p><button class="btn btn--primary" type="submit">${has ? 'Entrar' : 'Crear y entrar'}</button></form>`;
        }
        const isAdm = st.mode !== 'cloud' || prof?.role === 'admin';
        const tabs = [
            ...ENTITIES.filter(roleOk).map((e) => [e.tab, e.plural]),
            ...(isAdm ? [['league', 'La liga'], ['predictions', 'Pronósticos'], ['editor', 'Editor en vivo'], ['creator', 'Creador'], ['navigation', 'Navegación']] : []),
            ...(st.mode === 'cloud' && isAdm ? [['users', 'Usuarios y roles']] : []),
            ['data', 'Datos'],
        ];
        if (tab && !tabs.some(([t]) => t === tab))
            tab = '';
        if (!tab && isWide())
            tab = tabs[0][0]; // en pantallas grandes siempre hay una sección abierta; en celular se ve primero el menú
        const ro = !canWrite();
        const head = `<div class="adm-notes">
      ${ro ? notice('Solo lectura: los datos vienen de la app anterior. Para editar: 1) en Supabase → SQL Editor ejecutá supabase/migrations/001_core.sql y después 002_import_legacy.sql; 2) registrate desde Perfil; 3) en el SQL Editor ejecutá: update lsl2_profiles set role = \'admin\' where email = \'tu@email.com\'; (ver docs/supabase.md).', 'warn') : ''}
      ${msg ? notice(msg, 'info') : ''}
      </div>`;
        const inner = (() => {
        const e = entityOf(tab);
        if (e) {
            const list = d[e.table].slice();
            if (e.sort)
                list.sort(e.sort);
            return head + `<div class="adm-bar"><small data-count>${list.length} ${e.plural.toLowerCase()}</small><button class="btn btn--primary btn--sm" data-new ${ro ? 'disabled' : ''}>${icon('plus', 16)} ${e.fem ? 'Nueva' : 'Nuevo'} ${e.singular}</button></div>
        <div class="adm-tools"><input class="input" type="search" data-q placeholder="Buscar en ${esc(e.plural.toLowerCase())}…" value="${esc(q)}" aria-label="Buscar"><button class="btn btn--sm" data-csv-out>${icon('download', 16)} CSV</button><button class="btn btn--sm" data-csv-in ${ro ? 'disabled' : ''}>${icon('upload', 16)} Importar CSV</button></div>
        ${list.length ? `<div class="stack stack--sm">${list.map((r) => {
                const s = e.summary(r, d);
                const live = e.table === 'matches' && (r.status === 'live' || r.status === 'paused');
                return `<div class="card adm-row ${e.toggle && !r[e.toggle] ? 'is-off' : ''}" data-s="${esc(norm(s.title + ' ' + s.sub))}">${s.color ? `<span class="adm-sw" style="background:${esc(s.color)}"></span>` : ''}<div class="adm-row__main"><b>${esc(s.title)}</b><small>${esc(s.sub)}</small>
            ${live ? `<div class="row row--wrap mt-2"><button class="btn btn--sm" data-quick="${esc(r.id)}|home">+1 local</button><button class="btn btn--sm" data-quick="${esc(r.id)}|away">+1 visitante</button><button class="btn btn--sm btn--primary" data-quick="${esc(r.id)}|end">Finalizar</button></div>` : ''}</div>
            <div class="adm-row__acts">${e.toggle ? `<input type="checkbox" class="switch" data-toggle="${esc(r.id)}" ${r[e.toggle] ? 'checked' : ''} ${ro ? 'disabled' : ''} aria-label="Activar o desactivar">` : ''}<button class="icon-btn" data-edit="${esc(r.id)}" aria-label="Editar" ${ro ? 'disabled' : ''}>${icon('pencil', 18)}</button><button class="icon-btn" data-del="${esc(r.id)}" aria-label="Borrar" ${ro ? 'disabled' : ''}>${icon('trash', 18)}</button></div></div>`;
            }).join('')}</div>` : emptyState(`No hay ${e.plural.toLowerCase()}`, 'Creá el primero con el botón de arriba.', 'database')}`;
        }
        if (tab === 'creator')
            return head + creatorHtml();
        if (tab === 'navigation')
            return head + navigationDesignerHtml();
        if (tab === 'editor') {
            const m = getMods();
            const nProj = Object.keys(m.projects).length;
            return head + `<div class="card card--pad stack"><h3>Editor en vivo</h3>
        <p class="muted">Cambiá el aspecto y las funciones de cualquier cosa de la app mirándola en vivo: tamaño, rotación, posición, colores, textos, qué hace al tocarla, mostrar u ocultar, y el orden de las secciones.</p>
        <div class="list"><div class="list__row"><b>Cómo se usa</b><small class="grow">1) Tocá “Abrir editor”. 2) Navegá normal. 3) Para editar algo, <b>mantené apretado</b> ese elemento. 4) Ajustá en el panel o arrastrá el recuadro. 5) “Publicar” para que lo vean todos.</small></div>
        <div class="list__row"><b>Se guarda en</b><small class="grow">${esc(storageLabel())} · ${m.overrides.items.length} cambios publicados · ${nProj} proyectos</small></div></div>
        ${safeMode() ? notice('Modo seguro activo: el editor no se puede abrir hasta que salgas del modo seguro (?safe=0).', 'warn') : ''}
        ${m.tableMissing ? notice('Falta la migración 004_site_mods.sql en Supabase: por ahora lo publicado se guarda solo en este dispositivo.', 'warn') : ''}
        <div class="row row--wrap"><button class="btn btn--primary" data-ed-open ${safeMode() ? 'disabled' : ''}>${icon('pencil', 18)} Abrir editor</button></div>
        <p class="muted"><small>Si algo sale mal y no podés ver la app: abrila con <code>?safe=1</code> al final de la dirección para apagar todas las personalizaciones.</small></p></div>`;
        }
        if (tab === 'league') {
            const L = d.league;
            const f = (name, label, type = 'text') => textField({ name, label, value: L[name], type });
            return head + `<form class="card card--pad" data-league novalidate><div class="form-grid">${f('name', 'Nombre de la liga')}${f('short', 'Sigla')}${f('season', 'Temporada')}${f('seasonStatus', 'Estado de la temporada')}${f('pointsWin', 'Puntos por victoria', 'number')}${f('pointsDraw', 'Puntos por empate', 'number')}${f('pointsLoss', 'Puntos por derrota', 'number')}${f('tagline', 'Lema')}</div>
        ${textArea({ name: 'info', label: 'Información de la liga', value: L.info, rows: 4 })}${textArea({ name: 'rules', label: 'Reglamento', value: L.rules, rows: 6 })}${textField({ name: 'logo', label: 'Logo (URL)', value: L.logo.startsWith('data:') ? '' : L.logo })}
        <p class="form-error" data-err hidden></p><button class="btn btn--primary" type="submit" ${ro ? 'disabled' : ''}>Guardar cambios</button></form>`;
        }
        let boardHtml = '';
        if (tab === 'predictions' && st.mode === 'cloud') {
            if (!board) {
                void loadLeaderboard().then((r) => { board = r; ctx.refresh(); }).catch(() => { board = []; ctx.refresh(); });
                boardHtml = '<div class="center mt-4"><span class="spinner"></span></div>';
            }
            else {
                boardHtml = `<div class="card card--pad mt-4"><h3>Ranking de usuarios</h3>${board.length ? `<div class="list mt-2">${board.map((r, i) => `<div class="list__row"><b class="num">${i + 1}</b><span class="grow">${esc(r.name)}</span><small>${r.exact} exactos · ${r.predictions} pron.</small><b class="num">${r.points} pts</b></div>`).join('')}</div>` : '<p class="muted mt-2">Todavía no hay pronósticos con puntos.</p>'}</div>`;
            }
        }
        if (tab === 'predictions')
            return head + `<div class="card card--pad stack"><h3>Cálculo de puntos</h3><p class="muted">${st.mode === 'cloud' ? 'En modo nube, los puntos los calcula el servidor automáticamente cuando un partido pasa a "Finalizado" (trigger SQL). Si corregiste un resultado, podés recalcular todo.' : 'En modo local los puntos se calculan en este dispositivo.'}</p>
        <button class="btn btn--primary" data-settle>${icon('refresh', 18)} Recalcular puntos</button></div>${boardHtml}`;
        if (tab === 'users') {
            const roleHelp = `<div class="card card--pad mb-3"><h3>Qué puede hacer cada rol</h3><div class="list mt-2">
          <div class="list__row"><b>Usuario</b><small class="grow">Ve todo, guarda sus pronósticos y edita su nombre y favoritos.</small></div>
          <div class="list__row"><b>Editor</b><small class="grow">Además carga y edita partidos, resultados, eventos, noticias, comunicados y avisos.</small></div>
          <div class="list__row"><b>Admin</b><small class="grow">Todo lo anterior + equipos, jugadores, competiciones, temporadas, la liga, roles y recálculo de puntos.</small></div></div>
          <p class="muted mt-2"><small>Estos permisos los hace cumplir el servidor (políticas RLS), no solo esta pantalla.</small></p></div>`;
            if (!users) {
                void listUsers().then((u) => { users = u; ctx.refresh(); }).catch((x) => { msg = x instanceof SbError ? x.friendly : 'No se pudo cargar usuarios.'; users = []; ctx.refresh(); });
                return head + '<div class="center mt-6"><span class="spinner"></span></div>';
            }
            return head + roleHelp + (users.length ? `<div class="stack stack--sm">${users.map((u) => `<div class="card adm-row"><div class="adm-row__main"><b>${esc(u.name)}</b><small>${esc(u.email)}</small></div><select class="input" style="width:auto" data-role="${esc(u.id)}" ${u.id === prof?.id ? 'disabled' : ''}>${['user', 'editor', 'admin'].map((r) => `<option ${r === u.role ? 'selected' : ''}>${r}</option>`).join('')}</select></div>`).join('')}</div>` : emptyState('Sin usuarios', '', 'users'));
        }
        return head + `<div class="stack">
      <div class="card card--pad"><h3>Estado</h3><p class="muted mt-2">Modo: <b>${st.mode}</b> · Origen: <b>${st.origin}</b>${st.error ? ` · <span style="color:var(--danger)">${esc(st.error)}</span>` : ''}</p></div>
      <div class="card card--pad stack"><h3>Respaldo</h3><p class="muted">Exportá todos los datos a un archivo JSON, o importá uno (reemplaza lo actual).</p><div class="row row--wrap"><button class="btn" data-export>${icon('download', 18)} Exportar</button><button class="btn" data-import ${ro ? 'disabled' : ''}>${icon('upload', 18)} Importar</button><button class="btn" data-csv>${icon('download', 18)} Partidos (CSV)</button></div></div>
      ${st.mode === 'local' ? `<div class="card card--pad stack"><h3>Borrador local</h3><p class="muted">Tus cambios están solo en este dispositivo. Exportá el respaldo para no perderlos.</p><button class="btn btn--danger" data-reset>Descartar cambios locales</button></div>` : `<button class="btn" data-sync>${icon('refresh', 18)} Sincronizar ahora</button>`}</div>`;
        })();
        // ---- armazón de la consola: encabezado con estado, menú de módulos y contenido ----
        const title = tabs.find(([t]) => t === tab)?.[1] ?? '';
        const cnt = (t) => { const en = entityOf(t); return en ? String(d[en.table].length) : ''; };
        const modBtn = ([t, label]) => { const [ic] = MODS[t] ?? ['sliders']; const c = cnt(t); const n = Number(c); return `<button type="button" class="adm-mod ${t === tab ? 'is-on' : ''}" data-tab="${esc(t)}" ${t === tab ? 'aria-current="page"' : ''}><span class="adm-mod__ico">${icon(ic, 20)}</span><span class="adm-mod__txt"><b>${esc(label)}</b>${c ? `<small>${esc(c)} ${n === 1 ? 'registro' : 'registros'}</small>` : ''}</span><span class="adm-mod__chev">${icon('chevron-right', 16)}</span></button>`; };
        const side = GROUPS.map((g) => { const items = tabs.filter(([t]) => (MODS[t]?.[1] ?? 'Sistema') === g); return items.length ? `<div class="adm-group"><h4>${esc(g)}</h4><div class="adm-mods">${items.map(modBtn).join('')}</div></div>` : ''; }).join('');
        const modeLabel = { cloud: 'Nube · en vivo', legacy: 'Solo lectura', local: 'Borrador local' }[st.mode] ?? st.mode;
        const role = st.mode === 'cloud' ? (prof?.role ?? '—') : 'admin local';
        const stat = (n, l) => `<div class="adm-stat"><b>${n}</b><small>${l}</small></div>`;
        return `<div class="adm" data-open="${tab ? 1 : 0}">
      <section class="adm-hero">
        <div class="adm-hero__top"><span class="adm-hero__logo">${icon('shield', 22)}</span>
          <div class="adm-hero__txt"><h1>Consola de administración</h1><small>${esc(d.league.name)} · ${esc(d.league.season)}</small></div></div>
        <div class="adm-hero__chips"><span class="adm-led ${st.mode === 'cloud' ? 'is-ok' : st.mode === 'legacy' ? 'is-warn' : ''}"></span><span class="chip">${esc(modeLabel)}</span><span class="chip chip--accent">Rol: ${esc(role)}</span></div>
        <div class="adm-stats">${stat(d.matches.length, 'Partidos')}${stat(d.teams.length, 'Equipos')}${stat(d.players.length, 'Jugadores')}${stat(d.news.length, 'Noticias')}</div>
      </section>
      <div class="adm-shell">
        <nav class="adm-side" aria-label="Secciones del panel">${side}</nav>
        <section class="adm-main">${tab ? `<div class="adm-mainbar"><button type="button" class="adm-back" data-tab="" aria-label="Volver al menú del panel">${icon('arrow-left', 20)}<span>Panel</span></button><h2>${esc(title)}</h2></div>` : ''}${inner}</section>
      </div></div>`;
    }, { on: ['data', 'session', 'mods', 'mods-status'], after: () => applyFilter() });
    installCreator(ctx);
    installNavigationDesigner(ctx);
    ctx.on('click', '[data-ed-open]', async () => { const { startEditor } = await import('../editor/index.js'); if (await startEditor()) ctx.navigate('/'); });
    const fresh = () => ctx.refresh();
    /** Filtra la lista sin volver a dibujarla (así el teclado no se cierra mientras escribís). */
    function applyFilter() {
        const key = norm(q);
        const rows = ctx.el.querySelectorAll('.adm-row[data-s]');
        let shown = 0;
        rows.forEach((r) => { const ok = !key || r.dataset.s.includes(key); r.hidden = !ok; if (ok) shown++; });
        const c = ctx.el.querySelector('[data-count]');
        const e = entityOf(tab);
        if (c && e) c.textContent = key ? `${shown} de ${rows.length} ${e.plural.toLowerCase()}` : `${rows.length} ${e.plural.toLowerCase()}`;
    }
    ctx.on('input', '[data-q]', (el) => { q = el.value; applyFilter(); });
    void kvGet('admin:pass', '').then((h) => { ctx.el.dataset.hasPass = h ? '1' : '0'; if (getStatus().mode === 'local' && !unlocked)
        fresh(); });
    ctx.on('submit', '[data-gate]', async (form, ev) => {
        ev.preventDefault();
        const p = String(new FormData(form).get('p') ?? '');
        const err = form.querySelector('[data-gate-err]');
        const stored = await kvGet('admin:pass', '');
        const h = await hash(p);
        if (stored && stored !== h) {
            err.hidden = false;
            err.textContent = 'Contraseña incorrecta.';
            return;
        }
        if (p.length < 4) {
            err.hidden = false;
            err.textContent = 'Mínimo 4 caracteres.';
            return;
        }
        if (!stored)
            await kvSet('admin:pass', h);
        unlocked = true;
        fresh();
    });
    ctx.on('click', '[data-tab]', (el) => {
        tab = el.dataset.tab; msg = ''; q = '';
        if (tab === 'predictions') board = null;
        fresh();
        // En celular el menú y el contenido son pantallas distintas: volvemos arriba para ver el comienzo.
        if (!isWide()) scrollTo({ top: 0 });
    });
    ctx.on('change', '[data-toggle]', async (el) => {
        const e = entityOf(tab);
        const r = e && getData()[e.table].find((x) => x.id === el.dataset.toggle);
        if (!r) return;
        try { await saveRow(e.table, { ...r, [e.toggle]: el.checked }); toast(el.checked ? 'Activada' : 'Desactivada', 'success'); }
        catch (x) { toast(x instanceof SbError ? x.friendly : x.message, 'error'); el.checked = !el.checked; }
    });
    ctx.on('click', '[data-new]', () => { const e = entityOf(tab); if (e)
        openEntityForm(e, null, fresh); });
    ctx.on('click', '[data-edit]', (el) => {
        const e = entityOf(tab);
        if (!e)
            return;
        const r = getData()[e.table].find((x) => x.id === el.dataset.edit);
        if (r)
            openEntityForm(e, r, fresh);
    });
    ctx.on('click', '[data-del]', async (el) => {
        const e = entityOf(tab);
        if (!e)
            return;
        const id = el.dataset.del;
        const block = e.inUse?.(id, getData());
        if (block)
            return toast(block, 'error', 5000);
        if (!(await confirmDialog(`¿Borrar este ${e.singular}? No se puede deshacer.`, { danger: true, confirm: 'Borrar' })))
            return;
        try {
            await deleteRow(e.table, id);
            toast('Borrado', 'success');
        }
        catch (x) {
            toast(x instanceof SbError ? x.friendly : x.message, 'error', 5000);
        }
    });
    ctx.on('click', '[data-quick]', async (el) => {
        const [id, what] = el.dataset.quick.split('|');
        const m = getData().matches.find((x) => x.id === id);
        if (!m)
            return;
        const next = { ...m };
        if (what === 'home')
            next.homeScore = (m.homeScore ?? 0) + 1;
        else if (what === 'away')
            next.awayScore = (m.awayScore ?? 0) + 1;
        else {
            next.status = 'finished';
            next.homeScore ?? (next.homeScore = 0);
            next.awayScore ?? (next.awayScore = 0);
        }
        try {
            await saveRow('matches', next);
        }
        catch (x) {
            toast(x instanceof SbError ? x.friendly : x.message, 'error');
        }
    });
    ctx.on('submit', '[data-league]', async (form, ev) => {
        ev.preventDefault();
        const raw = readForm(form);
        const num = (k) => Math.max(0, Math.floor(Number(raw[k]) || 0));
        const err = form.querySelector('[data-err]');
        if (!String(raw.name).trim()) {
            err.hidden = false;
            err.textContent = 'La liga necesita un nombre.';
            return;
        }
        try {
            await saveLeague({ name: String(raw.name).trim(), short: String(raw.short).trim(), season: String(raw.season).trim(), seasonStatus: String(raw.seasonStatus).trim(), tagline: String(raw.tagline).trim(), info: String(raw.info), rules: String(raw.rules), logo: String(raw.logo).trim() || getData().league.logo, pointsWin: num('pointsWin'), pointsDraw: num('pointsDraw'), pointsLoss: num('pointsLoss') });
            err.hidden = true;
            toast('Liga actualizada', 'success');
        }
        catch (x) {
            err.hidden = false;
            err.textContent = x instanceof SbError ? x.friendly : x.message;
        }
    });
    ctx.on('click', '[data-settle]', async () => {
        try {
            if (getStatus().mode === 'cloud') {
                await rpc('settle_all');
                toast('Puntos recalculados', 'success');
            }
            else {
                settleLocal(getData());
                toast('Puntos locales recalculados', 'success');
            }
        }
        catch (x) {
            toast(x instanceof SbError ? x.friendly : 'No se pudo recalcular', 'error');
        }
    });
    ctx.on('change', '[data-role]', async (el) => {
        try {
            await setUserRole(el.dataset.role, el.value);
            toast('Rol actualizado', 'success');
        }
        catch (x) {
            toast(x instanceof SbError ? x.friendly : 'No se pudo cambiar el rol', 'error');
            users = null;
            fresh();
        }
    });
    ctx.on('click', '[data-export]', () => downloadText(`la-super-liga-${new Date().toISOString().slice(0, 10)}.json`, exportDataset()));
    ctx.on('click', '[data-csv]', () => {
        const d = getData(), q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
        const nm = (id) => d.teams.find((t) => t.id === id)?.name ?? id;
        downloadText('partidos.csv', ['fecha,competicion,fase,local,goles_local,goles_visitante,visitante,estado', ...d.matches.map((m) => [m.kickoff, m.competitionId, m.round, nm(m.homeId), m.homeScore ?? '', m.awayScore ?? '', nm(m.awayId), m.status].map(q).join(','))].join('\n'), 'text/csv');
    });
    ctx.on('click', '[data-csv-out]', () => {
        const e = entityOf(tab);
        if (e) downloadText(`${e.tab}-${new Date().toISOString().slice(0, 10)}.csv`, entityToCsv(e, getData()), 'text/csv;charset=utf-8');
    });
    ctx.on('click', '[data-csv-in]', async () => {
        const e = entityOf(tab);
        if (!e) return;
        const text = await pickFile('.csv,text/csv,text/plain');
        if (!text) return;
        const r = csvToRows(e, getData(), text);
        if (!r.rows.length) return void toast(r.errors[0] ?? 'No hay filas para importar.', 'error', 6000);
        const bad = r.errors.length ? `\n\nProblemas (${r.errors.length}):\n${r.errors.slice(0, 6).join('\n')}${r.errors.length > 6 ? '\n…' : ''}` : '';
        const ok = await confirmDialog(`Se van a crear ${r.created} y actualizar ${r.updated} ${e.plural.toLowerCase()}.${bad}`, { confirm: r.errors.length ? 'Importar las válidas' : 'Importar' });
        if (!ok) return;
        let done = 0;
        try {
            for (const row of r.rows) { await saveRow(e.table, row); for (const extra of e.afterSave?.(row, getData()) ?? []) await saveRow(e.table, extra); done++; }
            toast(`Importados: ${done}`, 'success');
        } catch (x) {
            toast(`Se importaron ${done} de ${r.rows.length}. ${x instanceof SbError ? x.friendly : x.message}`, 'error', 6000);
        }
    });
    ctx.on('click', '[data-import]', async () => {
        const text = await pickFile('application/json,.json');
        if (!text)
            return;
        try {
            const obj = JSON.parse(text);
            if (!(await confirmDialog('Esto REEMPLAZA los datos actuales por los del archivo.', { danger: true, confirm: 'Importar' })))
                return;
            await importDataset(obj);
            toast('Datos importados', 'success');
        }
        catch (x) {
            toast(x instanceof SyntaxError ? 'El archivo no es un JSON válido.' : x instanceof SbError ? x.friendly : x.message, 'error', 5000);
        }
    });
    ctx.on('click', '[data-reset]', async () => { if (await confirmDialog('Se borran tus cambios locales.', { danger: true })) {
        await resetLocal();
        toast('Restaurado', 'success');
    } });
    ctx.on('click', '[data-sync]', async () => toast((await refresh()) ? 'Sincronizado' : 'No se pudo sincronizar', 'info'));
};
export default admin;
