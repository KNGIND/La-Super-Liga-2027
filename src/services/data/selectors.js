import { dayKey, ts } from '../../utils/format.js';
export const teamById = (d, id) => d.teams.find((t) => t.id === id);
export const matchById = (d, id) => d.matches.find((m) => m.id === id);
export const competitionById = (d, id) => d.competitions.find((c) => c.id === id);
export const playersOf = (d, teamId) => d.players.filter((p) => p.teamId === teamId);
export const sortedMatches = (d) => d.matches.slice().sort((a, b) => ts(a.kickoff) - ts(b.kickoff));
/** Temporada actual (la marcada como "actual" o, si no hay, la última). */
export const currentSeason = (d) => d.seasons.find((s) => s.current) ?? d.seasons[d.seasons.length - 1];
/** Datos de UNA temporada: deja solo sus partidos. Con una sola temporada no cambia nada. */
export function forSeason(d, id) {
    if (d.seasons.length < 2)
        return d;
    const sid = id || currentSeason(d)?.id;
    return { ...d, matches: d.matches.filter((m) => !m.seasonId || m.seasonId === sid) };
}
export const isLive = (m) => m.status === 'live' || m.status === 'paused';
/** Tabla de posiciones de una competición de tipo liga. Se calcula SIEMPRE desde los partidos. */
export function standings(d, competitionId = 'liga', throughRound) {
    const { pointsWin: W, pointsDraw: D, pointsLoss: L } = d.league;
    const rows = new Map();
    for (const t of d.teams)
        rows.set(t.id, { teamId: t.id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: t.adjust || 0, form: [] });
    const rounds = roundsOf(d, competitionId);
    const cutoff = throughRound ? rounds.indexOf(throughRound) : -1;
    for (const m of sortedMatches(d)) {
        if (m.status !== 'finished' || m.competitionId !== competitionId)
            continue;
        if (cutoff >= 0 && rounds.indexOf(m.round) > cutoff)
            continue;
        const h = rows.get(m.homeId), a = rows.get(m.awayId);
        if (!h || !a)
            continue;
        const hs = m.homeScore ?? 0, as = m.awayScore ?? 0;
        h.played++;
        a.played++;
        h.gf += hs;
        h.ga += as;
        a.gf += as;
        a.ga += hs;
        if (hs > as) {
            h.won++;
            a.lost++;
            h.points += W;
            a.points += L;
            h.form.push('w');
            a.form.push('l');
        }
        else if (hs < as) {
            a.won++;
            h.lost++;
            a.points += W;
            h.points += L;
            a.form.push('w');
            h.form.push('l');
        }
        else {
            h.drawn++;
            a.drawn++;
            h.points += D;
            a.points += D;
            h.form.push('d');
            a.form.push('d');
        }
    }
    const names = new Map(d.teams.map((t) => [t.id, t.name]));
    const out = [...rows.values()].map((r) => ({ ...r, gd: r.gf - r.ga, form: r.form.slice(-5) }));
    out.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || (names.get(a.teamId) < names.get(b.teamId) ? -1 : 1));
    return out;
}
/** Jornadas/fases de una competición en orden cronológico. */
export function roundsOf(d, competitionId) {
    const out = [];
    for (const m of sortedMatches(d))
        if (m.competitionId === competitionId && m.round && !out.includes(m.round))
            out.push(m.round);
    return out;
}
/** Resultado de un partido desde el punto de vista de un equipo. */
export function resultFor(m, teamId) {
    if (m.status !== 'finished' || m.homeScore == null || m.awayScore == null)
        return null;
    const mine = m.homeId === teamId ? m.homeScore : m.awayScore;
    const theirs = m.homeId === teamId ? m.awayScore : m.homeScore;
    return mine > theirs ? 'w' : mine < theirs ? 'l' : 'd';
}
export const matchesOfTeam = (d, teamId) => sortedMatches(d).filter((m) => m.homeId === teamId || m.awayId === teamId);
/** Goleadores de la temporada: cuenta eventos de gol (los autogoles no suman al jugador). */
export function topScorers(d, limit = 10) {
    const map = new Map();
    for (const m of d.matches) {
        for (const e of m.events) {
            if (e.type !== 'goal' && e.type !== 'pen_goal')
                continue;
            const teamId = e.side === 'home' ? m.homeId : m.awayId;
            const k = `${teamId}|${e.player}`;
            const r = map.get(k) ?? { player: e.player, teamId, goals: 0 };
            r.goals++;
            map.set(k, r);
        }
    }
    return [...map.values()].sort((a, b) => b.goals - a.goals || a.player.localeCompare(b.player)).slice(0, limit);
}
export function statsOfPlayer(d, teamId, name) {
    const s = { goals: 0, yellow: 0, red: 0, matches: 0 };
    for (const m of d.matches) {
        const home = m.homeId === teamId, away = m.awayId === teamId;
        if (!home && !away)
            continue;
        const lineup = home ? m.homeLineup : m.awayLineup;
        if (lineup.some((p) => p.name === name))
            s.matches++;
        for (const e of m.events) {
            if (e.player !== name || (e.side === 'home') !== home)
                continue;
            if (e.type === 'goal' || e.type === 'pen_goal')
                s.goals++;
            else if (e.type === 'yellow')
                s.yellow++;
            else if (e.type === 'red')
                s.red++;
        }
    }
    return s;
}
/* ---------- copas ---------- */
const PHASE_ORDER = ['octavos', 'cuartos', 'semifinal', 'tercer', 'final'];
export const phaseRank = (round) => {
    const r = round.toLowerCase();
    const i = PHASE_ORDER.findIndex((p) => r.includes(p));
    return i < 0 ? 99 : i;
};
/** "Semifinal · Ida" → "Semifinal" */
export const phaseName = (round) => round.replace(/\s*[·\-–]\s*(ida|vuelta)\s*$/i, '').trim();
/** Agrupa los partidos de una copa en cruces (ida/vuelta o partido único). */
export function cupTies(d, competitionId) {
    const groups = new Map();
    for (const m of sortedMatches(d)) {
        if (m.competitionId !== competitionId)
            continue;
        const pair = [m.homeId, m.awayId].sort().join('-');
        const k = `${phaseName(m.round)}|${pair}`;
        groups.set(k, [...(groups.get(k) ?? []), m]);
    }
    const ties = [];
    for (const [key, legs] of groups) {
        const aId = legs[0].homeId, bId = legs[0].awayId;
        let aggA = 0, aggB = 0, done = legs.every((l) => l.status === 'finished');
        for (const l of legs) {
            if (l.status === 'upcoming') {
                done = false;
                continue;
            }
            const homeIsA = l.homeId === aId;
            aggA += (homeIsA ? l.homeScore : l.awayScore) ?? 0;
            aggB += (homeIsA ? l.awayScore : l.homeScore) ?? 0;
        }
        let winnerId = null, decidedByPens = false;
        if (done) {
            if (aggA !== aggB)
                winnerId = aggA > aggB ? aId : bId;
            else {
                const last = legs[legs.length - 1];
                const m = /^(\d+)\D+(\d+)$/.exec(last.pens.trim());
                if (m) {
                    decidedByPens = true;
                    const ph = +m[1], pa = +m[2];
                    const homeIsA = last.homeId === aId;
                    winnerId = (homeIsA ? ph > pa : pa > ph) ? aId : bId;
                }
            }
        }
        ties.push({ key, phase: phaseName(legs[0].round), legs, aId, bId, aggA, aggB, winnerId, decidedByPens, done });
    }
    return ties.sort((x, y) => phaseRank(x.phase) - phaseRank(y.phase));
}
/** Agrupa partidos por día local. */
export function groupByDay(list) {
    const map = new Map();
    for (const m of list) {
        const k = dayKey(m.kickoff);
        map.set(k, [...(map.get(k) ?? []), m]);
    }
    return [...map.entries()].map(([key, matches]) => ({ key, iso: matches[0].kickoff, matches }));
}
/** Próximo partido (o el que está en vivo) de una lista. */
export function nextMatch(list, now = Date.now()) {
    return list.find(isLive) ?? list.find((m) => m.status === 'upcoming' && ts(m.kickoff) >= now - 3 * 3600e3);
}
/* ---------- búsqueda rápida por id (con caché por dataset) ---------- */
const maps = new WeakMap();
function lookup(d) {
    let m = maps.get(d);
    if (!m) {
        m = { teams: new Map(d.teams.map((t) => [t.id, t])), channels: new Map(d.channels.map((c) => [c.id, c])) };
        maps.set(d, m);
    }
    return m;
}
export const team = (d, id) => lookup(d).teams.get(id);
export const channel = (d, id) => lookup(d).channels.get(id);

/** Zona de la tabla que corresponde a una fila (índice desde 0) de `total` equipos; undefined si ninguna. */
export function zoneAt(zones, index, total) {
    const pos = index + 1;
    for (const z of (zones ?? []).filter((x) => x.enabled).sort((a, b) => a.position - b.position)) {
        const from = z.fromBottom ? total - (z.toPosition || z.position) + 1 : z.position;
        const to = z.fromBottom ? total - z.position + 1 : (z.toPosition || z.position);
        if (pos >= from && pos <= to)
            return z;
    }
    return undefined;
}
