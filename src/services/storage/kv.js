/* Almacenamiento local en IndexedDB (clave → valor). Si IndexedDB no está disponible
   (modo privado, WebView raro) cae a memoria para que la app no se rompa. */
const DB_NAME = 'lsl27';
const STORE = 'kv';
const mem = new Map();
let dbp = null;
function open() {
    if (dbp)
        return dbp;
    dbp = new Promise((resolve) => {
        try {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => req.result.createObjectStore(STORE);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
            req.onblocked = () => resolve(null);
        }
        catch {
            resolve(null);
        }
    });
    return dbp;
}
function tx(mode, run) {
    return open().then((db) => new Promise((resolve) => {
        if (!db)
            return resolve(undefined);
        try {
            const r = run(db.transaction(STORE, mode).objectStore(STORE));
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => resolve(undefined);
        }
        catch {
            resolve(undefined);
        }
    }));
}
export async function kvGet(key, fallback) {
    if (mem.has(key))
        return mem.get(key);
    const v = await tx('readonly', (s) => s.get(key));
    return v === undefined ? fallback : v;
}
export async function kvSet(key, value) {
    mem.set(key, value);
    const db = await open();
    if (!db)
        return false;
    await tx('readwrite', (s) => s.put(value, key));
    return true;
}
export async function kvDel(key) {
    mem.delete(key);
    await tx('readwrite', (s) => s.delete(key));
}
/* ---------- localStorage con try/catch (solo para cosas chiquitas y síncronas) ---------- */
export const ls = {
    get(key, fallback) {
        try {
            const v = localStorage.getItem(key);
            return v == null ? fallback : JSON.parse(v);
        }
        catch {
            return fallback;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        }
        catch {
            /* sin espacio o bloqueado: seguimos sin guardar */
        }
    },
    del(key) {
        try {
            localStorage.removeItem(key);
        }
        catch {
            /* nada */
        }
    },
};
