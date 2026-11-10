/* SERVICIO DE DATOS — la única puerta de entrada a los datos de la liga.
   Las pantallas NO hablan con Supabase: usan getData(), saveRow(), deleteRow()…

   Modos:
   - 'cloud'  → tablas nuevas lsl2_* de Supabase (lectura para todos; escritura según rol, con RLS).
   - 'legacy' → lee la tabla vieja lsl_state (solo lectura) hasta que corras las migraciones.
   - 'local'  → datos de ejemplo (src/data/seed.json) + tus cambios guardados en este dispositivo.

   Origen del dato que se está mostrando (data.origin): 'server' (recién confirmado),
   'cache' (guardado de una visita anterior) o 'seed'/'draft' (local). */
import { BACKEND, DATA } from '../../core/config.js';
import { bus } from '../../core/events.js';
import { kvDel, kvGet, kvSet } from '../storage/kv.js';
import { canEdit, isAdmin } from '../supabase/auth.js';
import { SbError, remove, select, selectLegacy, upsert } from '../supabase/client.js';
import { fromLegacy } from './legacy-adapter.js';
import { ORDER, TABLE_NAMES, fromRow, normalizeDataset, toRow } from './schema.js';
const K_DRAFT = 'dataset:draft';
const K_CACHE = 'dataset:cache';
let data = normalizeDataset(null);
let status = { mode: 'local', origin: 'seed', syncedAt: null, loading: true, error: '', online: navigator.onLine };
let timer;
let busy = false;
const changeHooks = [];
export const getData = () => data;
export const getStatus = () => status;
export const onDataChange = (fn) => void changeHooks.push(fn);
function setStatus(patch) {
    status = { ...status, ...patch };
    bus.emit('connection', undefined);
}
function setData(next, origin, notify = true) {
    const prev = data;
    data = next;
    setStatus({ origin });
    if (notify)
        changeHooks.forEach((f) => f(prev, next));
    bus.emit('data', undefined);
}
/** ¿Se puede escribir ahora? En local siempre (borrador). En nube, según el rol. */
export function canWrite() {
    if (status.mode === 'local')
        return true;
    if (status.mode === 'legacy')
        return false;
    return canEdit() || isAdmin();
}
/* ---------- carga ---------- */
async function loadSeed() {
    const seed = (await import('../../data/seed.js')).default;
    return normalizeDataset(seed);
}
async function fetchCloud() {
    const [leagueRows, ...rest] = await Promise.all([
        select('league', 'select=*&id=eq.1'),
        ...TABLE_NAMES.map((t) => select(t, `select=*${ORDER[t] ? `&order=${ORDER[t]}` : ''}`)),
    ]);
    const ds = { league: leagueRows[0] ? fromRow(leagueRows[0]) : undefined };
    TABLE_NAMES.forEach((t, i) => (ds[t] = rest[i].map((r) => fromRow(r))));
    // Zonas de la tabla: si todavía no corriste la migración 003, se usan las predeterminadas (no rompe nada).
    try {
        const z = await select('zones', 'select=*');
        if (z.length)
            ds.zones = z.map((r) => fromRow(r));
    }
    catch { /* tabla inexistente: se usan las predeterminadas */ }
    return normalizeDataset(ds);
}
async function fetchLegacy() {
    const rows = await selectLegacy('lsl_state', 'id=eq.1&select=data');
    const d = rows[0]?.data;
    return d && Array.isArray(d.teams) ? fromLegacy(d) : null;
}
/** Arranca: muestra algo AL INSTANTE (caché o datos locales) y después confirma con el servidor. */
export async function initData() {
    if (!BACKEND.enabled) {
        const draft = await kvGet(K_DRAFT, null);
        setStatus({ mode: 'local' });
        setData(draft ? normalizeDataset(draft) : await loadSeed(), draft ? 'draft' : 'seed', false);
        setStatus({ loading: false });
        return;
    }
    const cache = await kvGet(K_CACHE, null);
    if (cache) {
        setStatus({ mode: cache.mode, syncedAt: cache.at });
        setData(normalizeDataset(cache.data), 'cache', false);
    }
    else {
        // Primera vez y todavía sin conexión: si hay un borrador local lo mostramos; si no, los datos de ejemplo.
        const draft = await kvGet(K_DRAFT, null);
        setData(draft ? normalizeDataset(draft) : await loadSeed(), draft ? 'draft' : 'seed', false);
    }
    setStatus({ loading: false });
    void refresh();
    schedule();
    document.addEventListener('visibilitychange', () => !document.hidden && void refresh());
    addEventListener('online', () => void refresh());
}
export async function refresh() {
    if (!BACKEND.enabled || busy)
        return false;
    busy = true;
    setStatus({ loading: true, online: navigator.onLine });
    try {
        let next = null;
        let mode = 'cloud';
        try {
            next = await fetchCloud();
            // Tablas nuevas existen pero están vacías → todavía no migraste: mostramos lo viejo.
            if (!next.teams.length) {
                const old = await fetchLegacy().catch(() => null);
                if (old)
                    (next = old), (mode = 'legacy');
            }
        }
        catch (e) {
            if (e instanceof SbError && (e.status === 404 || e.code === 'PGRST205' || e.code === '42P01')) {
                next = await fetchLegacy();
                mode = 'legacy';
                if (!next)
                    throw e;
            }
            else
                throw e;
        }
        const at = Date.now();
        setStatus({ mode, syncedAt: at, error: '', online: true });
        setData(next, 'server');
        void kvSet(K_CACHE, { data: next, at, mode });
        return true;
    }
    catch (e) {
        const msg = e instanceof SbError ? e.friendly : 'No se pudo actualizar.';
        setStatus({ error: msg, online: navigator.onLine });
        return false;
    }
    finally {
        busy = false;
        setStatus({ loading: false });
    }
}
function schedule() {
    clearTimeout(timer);
    const live = data.matches.some((m) => m.status === 'live' || m.status === 'paused');
    const sec = live ? DATA.pollLiveSeconds : DATA.pollIdleSeconds;
    timer = setTimeout(async () => {
        if (!document.hidden)
            await refresh();
        schedule();
    }, sec * 1000);
}
/* ---------- escritura ---------- */
async function persistLocal() {
    await kvSet(K_DRAFT, data);
}
function mutate(fn) {
    const next = structuredClone(data);
    fn(next);
    const prev = data;
    data = next;
    changeHooks.forEach((f) => f(prev, next));
    bus.emit('data', undefined);
}
const rowId = (r) => r.id;
export async function saveRow(name, row) {
    if (!canWrite())
        throw new Error('No tenés permiso para editar o el modo es solo lectura.');
    if (status.mode === 'cloud')
        await upsert(name, toRow(row));
    mutate((d) => {
        const list = d[name];
        const i = list.findIndex((x) => x.id === rowId(row));
        if (i >= 0)
            list[i] = row;
        else
            list.push(row);
    });
    if (status.mode === 'local') {
        await persistLocal();
        setStatus({ origin: 'draft' });
    }
    else
        void kvSet(K_CACHE, { data, at: Date.now(), mode: status.mode });
}
export async function deleteRow(name, id) {
    if (!canWrite())
        throw new Error('No tenés permiso para borrar o el modo es solo lectura.');
    if (status.mode === 'cloud')
        await remove(name, id);
    mutate((d) => {
        d[name] = d[name].filter((x) => x.id !== id);
    });
    if (status.mode === 'local')
        await persistLocal();
    else
        void kvSet(K_CACHE, { data, at: Date.now(), mode: status.mode });
}
export async function saveLeague(patch) {
    if (!canWrite())
        throw new Error('No tenés permiso para editar o el modo es solo lectura.');
    const next = { ...data.league, ...patch, id: 1 };
    if (status.mode === 'cloud')
        await upsert('league', toRow(next));
    mutate((d) => void (d.league = next));
    if (status.mode === 'local')
        await persistLocal();
}
/** Reemplaza todo (importar un archivo). En nube sube fila por fila: puede tardar. */
export async function importDataset(raw) {
    const ds = normalizeDataset(raw);
    if (!ds.teams.length)
        throw new Error('El archivo no tiene equipos: no parece un respaldo válido.');
    if (status.mode === 'cloud') {
        if (!isAdmin())
            throw new Error('Solo un admin puede importar en modo nube.');
        await upsert('league', toRow(ds.league));
        for (const t of ['seasons', 'competitions', 'teams', 'players', 'channels', 'matches', 'news', 'sanctions', 'zones']) {
            const rows = ds[t];
            for (let i = 0; i < rows.length; i += 200)
                await upsert(t, rows.slice(i, i + 200).map(toRow));
        }
    }
    setData(ds, status.mode === 'local' ? 'draft' : 'server');
    if (status.mode === 'local')
        await persistLocal();
}
export const exportDataset = () => JSON.stringify({ schema: 2, exportedAt: new Date().toISOString(), ...data }, null, 2);
/** Local: vuelve a los datos de ejemplo y borra tus cambios de este dispositivo. */
export async function resetLocal() {
    await kvDel(K_DRAFT);
    setData(await loadSeed(), 'seed');
}
