/* NOTIFICACIONES
   Qué hace hoy (real): detecta cambios en los datos (partido que empieza, gol, resultado final,
   noticia o comunicado nuevo) y los guarda como avisos dentro de la app. Si diste permiso, también
   muestra un aviso del sistema mientras la app esté abierta o en segundo plano.
   Qué NO hace todavía: push con la app cerrada. Eso requiere un servicio externo (OneSignal / FCM)
   y una Edge Function — ver docs/notificaciones-push.md. */
import { bus } from '../../core/events.js';
import { getPrefs, setPrefs } from '../../core/prefs.js';
import { getData, getStatus, onDataChange } from '../data/index.js';
import { kvGet, kvSet } from '../storage/kv.js';
import { team } from '../data/selectors.js';
import { ts } from '../../utils/format.js';
const K_LOCAL = 'notif:local';
const K_BASE = 'notif:baseline';
const MAX_LOCAL = 60;
let local = [];
let base = { matches: {}, news: [], ready: false };
export async function initNotifications() {
    local = await kvGet(K_LOCAL, []);
    base = await kvGet(K_BASE, { matches: {}, news: [], ready: false });
    onDataChange((_, next) => detect(next));
    bus.emit('data', undefined);
}
const sig = (m) => `${m.status}|${m.homeScore ?? '-'}|${m.awayScore ?? '-'}`;
function detect(d) {
    const st = getStatus();
    if (st.origin === 'seed' || st.loading && st.origin === 'cache')
        return;
    const snap = { matches: {}, news: d.news.map((n) => n.id), ready: true };
    d.matches.forEach((m) => (snap.matches[m.id] = sig(m)));
    if (!base.ready) {
        base = snap;
        void kvSet(K_BASE, base);
        return;
    } // primera vez: no inundar de avisos
    const p = getPrefs();
    const out = [];
    const now = new Date().toISOString();
    const name = (id) => team(d, id)?.name ?? '—';
    for (const m of d.matches) {
        const before = base.matches[m.id];
        const after = sig(m);
        if (before === after)
            continue;
        const title = `${name(m.homeId)} vs ${name(m.awayId)}`;
        const [bs, bh, ba] = (before ?? '').split('|');
        if (m.status === 'live' && bs !== 'live' && bs !== 'paused' && p.notifyMatches)
            out.push({ id: `m:${m.id}:live`, kind: 'match', title: '¡Empezó el partido!', body: title, link: `/match/${m.id}`, createdAt: now });
        else if (m.status === 'finished' && bs !== 'finished' && p.notifyResults)
            out.push({ id: `m:${m.id}:end`, kind: 'result', title: 'Final del partido', body: `${title}: ${m.homeScore}-${m.awayScore}`, link: `/match/${m.id}`, createdAt: now });
        else if ((m.status === 'live' || m.status === 'paused') && (bh !== String(m.homeScore) || ba !== String(m.awayScore)) && p.notifyResults)
            out.push({ id: `g:${m.id}:${m.homeScore}-${m.awayScore}`, kind: 'result', title: '¡Gol!', body: `${title}: ${m.homeScore}-${m.awayScore}`, link: `/match/${m.id}`, createdAt: now });
    }
    for (const n of d.news) {
        if (base.news.includes(n.id) || !p.notifyNews || ts(n.publishedAt) > Date.now() + 6e4)
            continue;
        out.push({ id: `n:${n.id}`, kind: n.kind === 'announcement' ? 'announcement' : 'news', title: n.kind === 'announcement' ? 'Comunicado' : n.category, body: n.title, link: `/news/${n.id}`, createdAt: now });
    }
    base = snap;
    void kvSet(K_BASE, base);
    if (!out.length)
        return;
    local = [...out, ...local.filter((x) => !out.some((o) => o.id === x.id))].slice(0, MAX_LOCAL);
    void kvSet(K_LOCAL, local);
    out.forEach(showSystem);
    bus.emit('data', undefined);
}
function showSystem(n) {
    if (!('Notification' in window) || Notification.permission !== 'granted')
        return;
    navigator.serviceWorker?.getRegistration().then((reg) => reg?.showNotification(n.title, { body: n.body, tag: n.id, icon: 'icons/icon-192.png', data: { link: n.link } }));
}
/** Avisos del servidor (creados por el admin) + los detectados en este dispositivo, del más nuevo al más viejo. */
export function allNotifications() {
    const seen = new Set();
    return [...getData().notifications, ...local]
        .filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true)))
        .sort((a, b) => ts(b.createdAt) - ts(a.createdAt));
}
export const unreadCount = () => {
    const last = ts(getPrefs().lastSeenNotifications);
    return allNotifications().filter((n) => ts(n.createdAt) > last).length;
};
export function markAllRead() {
    setPrefs({ lastSeenNotifications: new Date().toISOString() });
}
export const systemPermission = () => ('Notification' in window ? Notification.permission : 'unsupported');
export async function requestSystemPermission() {
    if (!('Notification' in window))
        return 'unsupported';
    const r = await Notification.requestPermission();
    bus.emit('prefs', undefined);
    return r;
}
