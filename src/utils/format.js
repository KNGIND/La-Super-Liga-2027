/* Formato de fechas, horas y números. Todo en español de Argentina. */
const LOCALE = 'es-AR';
const fTime = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false });
const fDay = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });
const fLong = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
const fShort = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' });
const fFull = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short' });
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const cache = new Map();
/** ISO → milisegundos (con caché; devuelve 0 si la fecha no es válida). */
export function ts(iso) {
    let v = cache.get(iso);
    if (v === undefined) {
        v = new Date(iso).getTime();
        if (Number.isNaN(v))
            v = 0;
        cache.set(iso, v);
    }
    return v;
}
export const timeOf = (iso) => fTime.format(ts(iso));
export const dayShort = (iso) => cap(fDay.format(ts(iso)).replace('.', ''));
export const dayLong = (iso) => cap(fLong.format(ts(iso)));
export const dateShort = (iso) => fShort.format(ts(iso)).replace('.', '');
export const dateTime = (iso) => fFull.format(ts(iso));
/** Clave de día local "2026-10-31" para agrupar partidos. */
export function dayKey(iso) {
    const d = new Date(ts(iso));
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function relativeDay(iso, now = Date.now()) {
    const a = new Date(ts(iso));
    a.setHours(0, 0, 0, 0);
    const b = new Date(now);
    b.setHours(0, 0, 0, 0);
    const diff = Math.round((a.getTime() - b.getTime()) / 864e5);
    if (diff === 0)
        return 'Hoy';
    if (diff === 1)
        return 'Mañana';
    if (diff === -1)
        return 'Ayer';
    return dayShort(iso);
}
export function startsIn(iso, now = Date.now()) {
    const ms = ts(iso) - now;
    if (ms <= 0)
        return '';
    const m = Math.round(ms / 6e4);
    if (m < 60)
        return `Empieza en ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24)
        return `Empieza en ${h} h${m % 60 ? ` ${m % 60} min` : ''}`;
    const d = Math.round(ms / 864e5);
    return `Faltan ${d} ${d === 1 ? 'día' : 'días'}`;
}
export function timeAgo(iso, now = Date.now()) {
    const s = Math.max(0, Math.round((now - ts(iso)) / 1000));
    if (s < 60)
        return 'ahora';
    const m = Math.floor(s / 60);
    if (m < 60)
        return `hace ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24)
        return `hace ${h} h`;
    const d = Math.floor(h / 24);
    if (d < 7)
        return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
    return dateShort(iso);
}
/** "+3", "0", "-2" */
export const signed = (n) => (n > 0 ? `+${n}` : String(n));
/** Convierte "2026-10-31T20:30:00-03:00" al valor que espera <input type="datetime-local">. */
export function toLocalInput(iso) {
    if (!iso)
        return '';
    const d = new Date(ts(iso));
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
/** Inversa de toLocalInput: devuelve ISO con la zona horaria del dispositivo. */
export function fromLocalInput(v) {
    return v ? new Date(v).toISOString() : '';
}
