/* PRONÓSTICOS — guardado, sincronización y ranking.
   - Con cuenta (nube): se guardan en Supabase (lsl2_predictions). El servidor valida que el
     partido no haya empezado y calcula los puntos (trigger SQL). El cliente solo muestra.
   - Sin cuenta o modo local: se guardan en este dispositivo; los puntos se calculan acá y se marcan
     como "locales" (no entran al ranking). */
import { BACKEND } from '../../core/config.js';
import { bus } from '../../core/events.js';
import { pointsFor } from '../../features/predictions/scoring.js';
import { kvGet, kvSet } from '../storage/kv.js';
import { currentProfile, isLoggedIn } from '../supabase/auth.js';
import { SbError, request, select, table } from '../supabase/client.js';
import { getData, getStatus } from './index.js';
import { ts } from '../../utils/format.js';
const K = 'predictions:local';
let mine = {};
let loaded = false;
export const getPredictions = () => mine;
/** ¿Estos pronósticos viven en el servidor (cuenta) o solo acá? */
export const isCloudUser = () => BACKEND.enabled && getStatus().mode === 'cloud' && isLoggedIn();
export async function loadPredictions() {
    mine = await kvGet(K, {});
    loaded = true;
    bus.emit('predictions', undefined);
    if (isCloudUser())
        await pullRemote();
    settleLocal(getData());
}
async function pullRemote() {
    const p = currentProfile();
    if (!p)
        return;
    try {
        const rows = await select('predictions', `select=match_id,home,away,points,created_at&user_id=eq.${p.id}`);
        for (const r of rows) {
            // lo no enviado todavía (synced:false) tiene prioridad sobre lo del servidor
            if (mine[r.match_id] && !mine[r.match_id].synced)
                continue;
            mine[r.match_id] = { matchId: r.match_id, home: r.home, away: r.away, createdAt: r.created_at, points: r.points, synced: true };
        }
        await kvSet(K, mine);
        bus.emit('predictions', undefined);
    }
    catch { /* sin red: mostramos lo guardado */ }
}
/** Un pronóstico se puede cambiar mientras el partido no empezó. */
export function isOpen(m, now = Date.now()) {
    return m.status === 'upcoming' && ts(m.kickoff) > now;
}
export async function savePrediction(matchId, home, away) {
    const m = getData().matches.find((x) => x.id === matchId);
    if (!m || !isOpen(m))
        throw new Error('Este partido ya empezó: no se puede pronosticar.');
    mine[matchId] = { matchId, home, away, createdAt: new Date().toISOString(), points: null, synced: !isCloudUser() };
    await kvSet(K, mine);
    bus.emit('predictions', undefined);
    if (!isCloudUser())
        return 'saved';
    return (await flushPredictions()) ? 'saved' : 'queued';
}
/** Envía al servidor lo que quedó pendiente (por falta de internet, por ejemplo). */
export async function flushPredictions() {
    const p = currentProfile();
    if (!isCloudUser() || !p)
        return true;
    const pending = Object.values(mine).filter((x) => !x.synced);
    let ok = true;
    for (const x of pending) {
        try {
            // Primero actualizar (solo home/away: es lo único que permite el servidor); si no existía, insertar.
            const q = `user_id=eq.${p.id}&match_id=eq.${encodeURIComponent(x.matchId)}`;
            const upd = (await request(`/rest/v1/${table('predictions')}?${q}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ home: x.home, away: x.away }) }));
            if (!upd.length)
                await request(`/rest/v1/${table('predictions')}`, { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ user_id: p.id, match_id: x.matchId, home: x.home, away: x.away }) });
            mine[x.matchId] = { ...x, synced: true };
        }
        catch (e) {
            ok = false;
            // El servidor rechazó (partido ya empezado): lo descartamos para no reintentar para siempre.
            if (e instanceof SbError && (e.status === 403 || e.status === 400 || e.status === 409))
                delete mine[x.matchId];
        }
    }
    await kvSet(K, mine);
    bus.emit('predictions', undefined);
    return ok;
}
/** Puntos de pronósticos que NO están en el servidor (modo local / sin cuenta). */
export function settleLocal(d) {
    let changed = false;
    for (const m of d.matches) {
        const p = mine[m.id];
        if (!p || p.synced && isCloudUser() || p.points != null || m.status !== 'finished' || m.homeScore == null || m.awayScore == null)
            continue;
        mine[m.id] = { ...p, points: pointsFor({ home: p.home, away: p.away }, { home: m.homeScore, away: m.awayScore }) };
        changed = true;
    }
    if (changed) {
        void kvSet(K, mine);
        bus.emit('predictions', undefined);
    }
}
export function totalPoints() {
    return Object.values(mine).reduce((s, p) => s + (p.points ?? 0), 0);
}
export async function loadLeaderboard() {
    if (!BACKEND.enabled || getStatus().mode !== 'cloud')
        return [];
    const rows = await select('leaderboard', 'select=*&order=points.desc,exact.desc&limit=50');
    return rows.map((r) => ({ userId: r.user_id, name: r.name, points: r.points, exact: r.exact, predictions: r.predictions }));
}
export const predictionsReady = () => loaded;
bus.on('data', () => loaded && settleLocal(getData()));
bus.on('session', () => void loadPredictions());
addEventListener('online', () => void flushPredictions());
