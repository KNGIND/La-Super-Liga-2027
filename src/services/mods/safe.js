/* MODO SEGURO — la red de contención de las personalizaciones.
   Con el modo seguro activo NO se aplica ningún cambio del Editor en vivo ni se ejecuta ningún proyecto del Creador.
   Cómo se activa:
     · a mano:      abrí la app con  ?safe=1   (ej.: https://tu-app.vercel.app/?safe=1 )  · para salir: ?safe=0
     · automático:  si la app se reinicia 4 veces seguidas en menos de 15 s (señal de que algo la está rompiendo),
                    queda en modo seguro 10 minutos para que puedas entrar al panel y desactivar lo que falla.
   Además, un proyecto que falla al iniciar queda en "cuarentena" solo (ver runtime.js). */
import { ls } from '../storage/kv.js';

const K_SESSION = 'lsl27:safe';
const K_BOOTS = 'lsl27:mods:boots';
const K_AUTO = 'lsl27:mods:autosafe';
let on = false;
let reason = '';

export const safeMode = () => on;
export const safeReason = () => reason;

export function initSafeMode() {
    const q = new URLSearchParams(location.search).get('safe') ?? new URLSearchParams(location.hash.split('?')[1] ?? '').get('safe');
    try {
        if (q === '1') sessionStorage.setItem(K_SESSION, '1');
        if (q === '0') { sessionStorage.removeItem(K_SESSION); ls.del(K_AUTO); ls.del(K_BOOTS); }
        if (sessionStorage.getItem(K_SESSION) === '1') { on = true; reason = 'manual'; }
    }
    catch { if (q === '1') { on = true; reason = 'manual'; } }
    if (!on && Date.now() < ls.get(K_AUTO, 0)) { on = true; reason = 'auto'; }
    // Contador de reinicios rápidos
    const rec = ls.get(K_BOOTS, { n: 0, t: 0 });
    const n = Date.now() - rec.t < 15000 ? rec.n + 1 : 1;
    if (!on && n >= 4) { on = true; reason = 'auto'; ls.set(K_AUTO, Date.now() + 10 * 60 * 1000); ls.del(K_BOOTS); }
    else ls.set(K_BOOTS, { n, t: Date.now() });
    // si la app sigue viva a los 8 s, el arranque fue estable
    setTimeout(() => ls.del(K_BOOTS), 8000);
    return on;
}

/* ---------- cuarentena por dispositivo (proyectos que fallaron) ---------- */
const K_Q = 'lsl27:mods:quarantine';
export const quarantine = () => ls.get(K_Q, {});
export const isQuarantined = (p) => { const q = quarantine()[p.id]; return !!q && q.version === p.version; };
export function putInQuarantine(p, why) { const q = quarantine(); q[p.id] = { version: p.version, why: String(why).slice(0, 200), at: Date.now() }; ls.set(K_Q, q); }
export function releaseQuarantine(id) { const q = quarantine(); delete q[id]; ls.set(K_Q, q); }
