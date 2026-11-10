/* ALMACÉN DE PERSONALIZACIONES
   Guarda dos cosas:
     · overrides → los cambios del Editor en vivo (un solo registro).
     · projects  → los proyectos del Creador (uno por proyecto).
   Dónde se guardan:
     · Con Supabase configurado y la tabla lsl2_site_mods creada (migración 004): en la NUBE, así lo ven todos.
       Solo un admin puede escribir (RLS en el servidor).
     · Sin Supabase, o si falta la tabla: LOCAL (IndexedDB de este dispositivo). Se avisa en el panel.
   Las pantallas y el editor no hablan con Supabase: usan estas funciones. */
import { BACKEND } from '../../core/config.js';
import { bus } from '../../core/events.js';
import { kvGet, kvSet } from '../storage/kv.js';
import { isAdmin } from '../supabase/auth.js';
import { SbError, remove, select, upsert } from '../supabase/client.js';

const K_LOCAL = 'mods:local';
const K_CACHE = 'mods:cache';
export const emptyOverrides = () => ({ items: [], vars: { all: {}, dark: {}, light: {} }, fontScale: 1, nav: null });

let state = { overrides: emptyOverrides(), projects: {}, source: 'local', tableMissing: false, loaded: false, syncedAt: 0, error: '' };
let sig = '';
export const getMods = () => state;
const signature = () => JSON.stringify([state.overrides, state.projects, state.source]);
const changed = () => { const s = signature(); const c = s !== sig; sig = s; return c; };

function fromRows(rows) {
    const out = { overrides: emptyOverrides(), projects: {} };
    for (const r of rows) {
        if (r.kind === 'overrides') out.overrides = { ...emptyOverrides(), ...(r.data ?? {}) };
        else if (r.kind === 'project' && r.data) out.projects[r.data.id ?? String(r.id).replace(/^proj:/, '')] = { ...r.data, enabled: !!r.enabled, version: r.version ?? r.data.version ?? 1, updatedAt: r.updated_at ?? r.data.updatedAt };
    }
    return out;
}
const projectRow = (p) => ({ id: 'proj:' + p.id, kind: 'project', name: p.name, enabled: !!p.enabled, version: p.version, data: p });

/** Primero lo guardado (instantáneo), después confirma con el servidor. */
export async function loadMods() {
    const local = await kvGet(K_LOCAL, null);
    const cache = BACKEND.enabled ? await kvGet(K_CACHE, null) : null;
    const base = cache ?? local;
    if (base) state = { ...state, overrides: { ...emptyOverrides(), ...base.overrides }, projects: base.projects ?? {}, source: cache ? 'cloud' : 'local' };
    state.loaded = true;
    changed();
    return state;
}

/** Trae lo último del servidor. Devuelve true si algo cambió. */
export async function refreshMods() {
    if (!BACKEND.enabled) return false;
    try {
        const rows = await select('site_mods', 'select=*');
        const next = fromRows(rows);
        state = { ...state, ...next, source: 'cloud', tableMissing: false, syncedAt: Date.now(), error: '' };
        void kvSet(K_CACHE, { overrides: next.overrides, projects: next.projects });
    }
    catch (e) {
        if (e instanceof SbError && (e.status === 404 || e.code === 'PGRST205' || e.code === '42P01')) {
            const local = await kvGet(K_LOCAL, null);
            state = { ...state, overrides: { ...emptyOverrides(), ...(local?.overrides ?? {}) }, projects: local?.projects ?? {}, source: 'local', tableMissing: true, error: '' };
        }
        else { state.error = e instanceof SbError ? e.friendly : 'Sin conexión.'; return false; }
    }
    const c = changed();
    if (c) bus.emit('mods', undefined);
    return c;
}

/** ¿Se puede guardar? En la nube solo un admin; en local, siempre (el panel ya pide su contraseña). */
export const canSaveMods = () => state.source !== 'cloud' || isAdmin();
export const storageLabel = () => (state.source === 'cloud' ? 'Nube (lo ven todos)' : BACKEND.enabled ? 'Solo este dispositivo (falta la migración 004)' : 'Solo este dispositivo');

async function persistLocal() { await kvSet(K_LOCAL, { overrides: state.overrides, projects: state.projects }); }
function guard() { if (!canSaveMods()) throw new Error('Solo un admin puede guardar personalizaciones.'); }
function done() { changed(); bus.emit('mods', undefined); if (state.source === 'cloud') void kvSet(K_CACHE, { overrides: state.overrides, projects: state.projects }); }

export async function saveOverrides(o) {
    guard();
    if (state.source === 'cloud') await upsert('site_mods', [{ id: 'overrides', kind: 'overrides', name: 'Editor en vivo', enabled: true, version: 1, data: o }]);
    state = { ...state, overrides: o };
    if (state.source === 'local') await persistLocal();
    done();
}
export async function saveProject(p) {
    guard();
    if (state.source === 'cloud') await upsert('site_mods', [projectRow(p)]);
    state = { ...state, projects: { ...state.projects, [p.id]: p } };
    if (state.source === 'local') await persistLocal();
    done();
}
export async function deleteProject(id) {
    guard();
    if (state.source === 'cloud') await remove('site_mods', 'proj:' + id);
    const projects = { ...state.projects };
    delete projects[id];
    state = { ...state, projects };
    if (state.source === 'local') await persistLocal();
    done();
}
/** Pasa lo guardado en este dispositivo a la nube (cuando recién corriste la migración 004). */
export async function pushLocalToCloud() {
    if (state.source !== 'cloud') throw new Error('La nube todavía no está disponible.');
    guard();
    const local = await kvGet(K_LOCAL, null);
    if (!local) return 0;
    const rows = [{ id: 'overrides', kind: 'overrides', name: 'Editor en vivo', enabled: true, version: 1, data: local.overrides }, ...Object.values(local.projects ?? {}).map(projectRow)];
    await upsert('site_mods', rows);
    await refreshMods();
    return rows.length;
}
export const hasLocalOnly = async () => !!(await kvGet(K_LOCAL, null));
