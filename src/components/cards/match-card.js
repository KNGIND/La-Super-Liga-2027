import { competitionById, isLive, team } from '../../services/data/selectors.js';
import { dayShort, startsIn, timeOf } from '../../utils/format.js';
import { esc } from '../../utils/dom.js';
import { crest } from './crest.js';
export function statusBadge(m) {
    if (m.status === 'live')
        return `<span class="badge badge--live"><i></i>En vivo${m.minute ? ` · ${m.minute}'` : ''}</span>`;
    if (m.status === 'paused')
        return `<span class="badge badge--live"><i></i>Descanso</span>`;
    if (m.status === 'finished')
        return `<span class="badge">Final</span>`;
    return `<span class="badge badge--soft">${esc(startsIn(m.kickoff) || timeOf(m.kickoff))}</span>`;
}
export function scoreBlock(m) {
    if (m.status === 'upcoming' || m.homeScore == null)
        return `<div class="mc__score mc__score--time"><b>${esc(timeOf(m.kickoff))}</b><small>hs</small></div>`;
    const pens = m.pens ? `<small class="mc__pens">Pen. ${esc(m.pens)}</small>` : '';
    return `<div class="mc__score ${isLive(m) ? 'is-live' : ''}"><b>${m.homeScore}</b><span>-</span><b>${m.awayScore}</b>${pens}</div>`;
}
/** Marcador de la fila compacta: dos números apilados; el ganador en fuerte, el perdedor atenuado. */
function rowScores(m) {
    if (m.status === 'upcoming' || m.homeScore == null)
        return '';
    const h = m.homeScore, a = m.awayScore;
    const done = m.status === 'finished';
    const cls = (mine, other) => (done && mine < other ? 'is-lose' : '') + (isLive(m) ? ' is-live' : '');
    return `<div class="mc__scores"><b class="${cls(h, a)}">${h}</b><b class="${cls(a, h)}">${a}</b></div>`;
}
/** Columna izquierda de la fila: hora, minuto en vivo o "Final". */
function rowStatus(m, o) {
    const date = o.showDate ? `<small>${esc(dayShort(m.kickoff))}</small>` : '';
    if (m.status === 'live')
        return `<div class="mc__st is-live"><b>${m.minute ? `${m.minute}'` : 'Vivo'}</b><i></i></div>`;
    if (m.status === 'paused')
        return `<div class="mc__st is-live"><b>Desc.</b></div>`;
    if (m.status === 'finished')
        return `<div class="mc__st"><b>Final</b>${date}${m.pens ? `<small>Pen. ${esc(m.pens)}</small>` : ''}</div>`;
    return `<div class="mc__st"><b>${esc(timeOf(m.kickoff))}</b>${date}</div>`;
}
export function matchCard(d, m, o = {}) {
    const h = team(d, m.homeId), a = team(d, m.awayId);
    const comp = competitionById(d, m.competitionId);
    const fav = o.favoriteIds ?? [];
    const label = [comp?.name, m.round].filter(Boolean).join(' · ');
    if (!o.large) { // fila compacta (estilo Sofascore): hora | equipos apilados | marcador
        const win = m.status === 'finished' && m.homeScore != null && m.awayScore != null;
        const t = (x, id, mine, other) => `<div class="mc__team ${fav.includes(id) ? 'is-fav' : ''} ${win && mine < other ? 'is-lose' : ''}">${crest(x, 22)}<span>${esc(x?.name ?? '—')}</span></div>`;
        return `<a class="mc mc--row ${isLive(m) ? 'mc--live' : ''}" href="#/match/${esc(m.id)}" aria-label="${esc(h?.name)} contra ${esc(a?.name)}">
    ${rowStatus(m, o)}
    <div class="mc__teams">${t(h, m.homeId, m.homeScore, m.awayScore)}${t(a, m.awayId, m.awayScore, m.homeScore)}</div>
    ${rowScores(m)}
  </a>`;
    }
    return `<a class="mc card mc--large ${isLive(m) ? 'mc--live' : ''}" href="#/match/${esc(m.id)}" aria-label="${esc(h?.name)} contra ${esc(a?.name)}">
    <div class="mc__top"><span class="mc__comp">${esc(label)}${o.showDate ? ` · ${esc(dayShort(m.kickoff))}` : ''}</span>${statusBadge(m)}</div>
    <div class="mc__row">
      <div class="mc__team ${fav.includes(m.homeId) ? 'is-fav' : ''}">${crest(h, 48)}<span>${esc(h?.name ?? '—')}</span></div>
      ${scoreBlock(m)}
      <div class="mc__team ${fav.includes(m.awayId) ? 'is-fav' : ''}">${crest(a, 48)}<span>${esc(a?.name ?? '—')}</span></div>
    </div>
  </a>`;
}
/** Lista de partidos agrupada por competición: una tarjeta por competición con su encabezado y una fila por partido. */
export function matchList(d, list, o = {}) {
    const groups = [];
    for (const m of list) {
        let g = groups.find((x) => x.id === m.competitionId);
        if (!g)
            groups.push((g = { id: m.competitionId, items: [] }));
        g.items.push(m);
    }
    return `<div class="mlist">${groups.map((g) => {
        const comp = competitionById(d, g.id);
        return `<section class="card mgroup"><header class="mgroup__head"><span>${esc(comp?.name ?? 'Partidos')}</span>${comp?.kind ? `<small>${esc({ liga: 'Liga', copa: 'Copa', amistoso: 'Amistoso' }[comp.kind] ?? '')}</small>` : ''}</header>${g.items.map((m) => matchCard(d, m, o)).join('')}</section>`;
    }).join('')}</div>`;
}
