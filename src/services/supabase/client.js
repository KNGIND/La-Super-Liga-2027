/* Cliente mínimo de Supabase por REST (fetch). Sin librerías: pesa casi nada y
   anda bien en celulares de gama baja. Toda comunicación con Supabase pasa por acá.
   Si algún día preferís @supabase/supabase-js, solo tenés que reemplazar este archivo
   y auth.ts: el resto de la app no sabe cómo se habla con el servidor. */
import { BACKEND, STORAGE_KEYS } from '../../core/config.js';
import { ls } from '../storage/kv.js';
export class SbError extends Error {
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
    }
    /** Mensaje para mostrarle a una persona. */
    get friendly() {
        if (this.status === 0)
            return 'Sin conexión con el servidor.';
        if (this.status === 401)
            return 'Tu sesión venció. Volvé a iniciar sesión.';
        if (this.status === 403 || this.code === '42501')
            return 'No tenés permiso para hacer esto (política de seguridad del servidor).';
        if (this.status === 404 || this.code === 'PGRST205' || this.code === '42P01')
            return 'Falta una tabla en Supabase. Ejecutá las migraciones de supabase/migrations/.';
        if (this.code === '23505')
            return 'Ese registro ya existe.';
        if (this.code === '23503')
            return 'No se puede: otros datos dependen de este registro.';
        return this.message || `Error ${this.status}`;
    }
}
let session = ls.get(STORAGE_KEYS.session, null);
const listeners = new Set();
export const getSession = () => session;
export const onSessionChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));
export function setSession(s) {
    session = s;
    if (s)
        ls.set(STORAGE_KEYS.session, s);
    else
        ls.del(STORAGE_KEYS.session);
    listeners.forEach((f) => f());
}
async function parse(res) {
    const text = await res.text();
    let body = null;
    try {
        body = text ? JSON.parse(text) : null;
    }
    catch {
        body = text;
    }
    if (!res.ok) {
        const b = (body ?? {});
        throw new SbError(res.status, b.code ?? '', b.message ?? b.msg ?? b.error_description ?? String(text).slice(0, 160));
    }
    return body;
}
let refreshing = null;
/** Renueva el token si está por vencer. Devuelve true si hay sesión válida. */
export async function ensureFreshSession() {
    if (!session)
        return false;
    if (session.expiresAt - Date.now() > 60000)
        return true;
    refreshing ?? (refreshing = (async () => {
        try {
            const r = (await parse(await fetch(`${BACKEND.url}/auth/v1/token?grant_type=refresh_token`, {
                method: 'POST',
                headers: { apikey: BACKEND.anonKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: session.refresh }),
            })));
            setSession(toSession(r));
            return true;
        }
        catch (e) {
            if (e instanceof SbError && e.status >= 400 && e.status < 500)
                setSession(null);
            return false;
        }
        finally {
            refreshing = null;
        }
    })());
    return refreshing;
}
export function toSession(r) {
    return {
        access: r.access_token ?? '',
        refresh: r.refresh_token ?? '',
        expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000,
        userId: r.user?.id ?? '',
        email: r.user?.email ?? '',
    };
}
export async function request(path, init = {}) {
    if (!BACKEND.enabled)
        throw new SbError(0, 'disabled', 'Supabase no está configurado.');
    const { auth = true, ...rest } = init;
    if (auth)
        await ensureFreshSession();
    const headers = {
        apikey: BACKEND.anonKey,
        Authorization: `Bearer ${auth && session ? session.access : BACKEND.anonKey}`,
        'Content-Type': 'application/json',
        ...(rest.headers ?? {}),
    };
    try {
        return await parse(await fetch(BACKEND.url + path, { ...rest, headers, cache: 'no-store' }));
    }
    catch (e) {
        if (e instanceof SbError)
            throw e;
        throw new SbError(0, 'network', 'Sin conexión con el servidor.');
    }
}
/* ---------- API de tablas ---------- */
export const table = (name) => BACKEND.tablePrefix + name;
export async function select(name, query = 'select=*') {
    return (await request(`/rest/v1/${table(name)}?${query}`));
}
export async function upsert(name, rows, onConflict = 'id') {
    await request(`/rest/v1/${table(name)}?on_conflict=${onConflict}`, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
    });
}
export async function remove(name, id, column = 'id') {
    await request(`/rest/v1/${table(name)}?${column}=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
}
export async function rpc(fn, body = {}) {
    return (await request(`/rest/v1/rpc/${BACKEND.tablePrefix}${fn}`, { method: 'POST', body: JSON.stringify(body) }));
}
/** Lee una tabla de la app VIEJA (solo lectura), p. ej. lsl_state. */
export async function selectLegacy(name, query) {
    return (await request(`/rest/v1/${name}?${query}`));
}
