/* INICIO: resumen de la liga. Todo se arma con componentes compartidos. */
import { matchCard, matchList } from '../../components/cards/match-card.js';
import { newsCard } from '../../components/cards/news-card.js';
import { crest } from '../../components/cards/crest.js';
import { emptyState } from '../../components/loaders/index.js';
import { icon } from '../../components/icons.js';
import { getData } from '../../services/data/index.js';
import { isLive, sortedMatches, standings, team, topScorers, zoneAt } from '../../services/data/selectors.js';
import { favoriteTeams, userName } from '../../services/user.js';
import { esc } from '../../utils/dom.js';
import { ts } from '../../utils/format.js';
import { mountRive } from '../../animations/rive/index.js';
const head = (title, href, label = 'Ver todo') => `<div class="section__head"><h3>${esc(title)}</h3><a class="section__link" href="${href}">${label} ${icon('chevron-right', 14)}</a></div>`;
function miniTable(d) {
    const fav = favoriteTeams();
    const rows = standings(d).slice(0, 5);
    return `<div class="table-scroll"><table class="tbl"><thead><tr><th>#</th><th style="text-align:left">Equipo</th><th>PJ</th><th>DG</th><th>Pts</th></tr></thead><tbody>${rows
        .map((r, i) => { const z = zoneAt(d.zones, i, standings(d).length); return `<tr class="${z ? 'has-zone' : ''} ${fav.includes(r.teamId) ? 'is-fav' : ''}" ${z ? `style="--zone:${esc(z.color)}" title="${esc(z.label)}"` : ''}><td><span class="rk">${i + 1}</span></td><td class="team"><a class="tname" href="#/team/${esc(r.teamId)}">${crest(team(d, r.teamId), 24)}<span>${esc(team(d, r.teamId)?.name)}</span>${z?.icon ? `<span class="zone-ico">${icon(z.icon, 14)}</span>` : ''}</a></td><td>${r.played}</td><td>${r.gd > 0 ? '+' : ''}${r.gd}</td><td class="pts">${r.points}</td></tr>`; })
        .join('')}</tbody></table></div>`;
}
const home = (ctx) => {
    let stopRive = null;
    ctx.listen(() => stopRive?.());
    ctx.view(() => {
        const d = getData();
        if (!d.teams.length)
            return emptyState('Todavía no hay datos', 'Cuando se carguen equipos y partidos, los vas a ver acá.', 'ball');
        const all = sortedMatches(d);
        const live = all.filter(isLive);
        const upcoming = all.filter((m) => m.status === 'upcoming').slice(0, 3);
        const results = all.filter((m) => m.status === 'finished').slice(-4).reverse();
        const fav = favoriteTeams();
        const favNext = fav.length ? all.find((m) => m.status === 'upcoming' && (fav.includes(m.homeId) || fav.includes(m.awayId))) : undefined;
        const news = d.news.slice().sort((a, b) => Number(b.pinned) - Number(a.pinned) || ts(b.publishedAt) - ts(a.publishedAt)).slice(0, 3);
        const played = all.filter((m) => m.status === 'finished').length;
        const goals = all.reduce((s, m) => s + (m.homeScore ?? 0) + (m.awayScore ?? 0), 0);
        const name = userName();
        const scorers = topScorers(d, 3);
        const left = `
      ${live.length ? `<section class="section">${head('En vivo', '#/matches?tab=live')}<div class="stack">${live.map((m) => matchCard(d, m, { large: true })).join('')}</div></section>` : ''}
      ${favNext ? `<section class="section"><div class="section__head"><h3>Tu equipo juega</h3></div>${matchList(d, [favNext], { showDate: true, favoriteIds: fav })}</section>` : ''}
      <section class="section">${head('Próximos partidos', '#/matches')}
        ${upcoming.length ? matchList(d, upcoming, { showDate: true, favoriteIds: fav }) : emptyState('No hay partidos próximos', 'Cuando se programen, aparecen acá.', 'calendar')}</section>
      <section class="section">${head('Últimos resultados', '#/matches?tab=results')}
        ${results.length ? matchList(d, results, { showDate: true, favoriteIds: fav }) : emptyState('Aún no hay resultados', '', 'ball')}</section>`;
        const right = `
      <section class="section">${head('Tabla', '#/standings')}${miniTable(d)}</section>
      ${scorers.length ? `<section class="section"><div class="section__head"><h3>Goleadores</h3></div><div class="card card--pad list">${scorers.map((s, i) => `<div class="list__row"><b class="num">${i + 1}</b><span class="row">${crest(team(d, s.teamId), 24)}${esc(s.player)}</span><b class="num">${s.goals}</b></div>`).join('')}</div></section>` : ''}
      <section class="section">${head('Noticias', '#/news')}<div class="stack">${news.map((n) => newsCard(n)).join('') || emptyState('Sin noticias', '', 'newspaper')}</div></section>`;
        return `
      <section class="card hero">
        <small>${esc(d.league.season)} · ${esc(d.league.seasonStatus)}</small>
        <h1 class="hero__title">${name ? `Hola, ${esc(name)}` : esc(d.league.name)}</h1>
        <p class="hero__sub">${esc(d.league.tagline || (name ? d.league.name : 'Todo lo que pasa en la liga, en un solo lugar.'))}</p>
        <div class="rive-slot" data-rive="hero.riv"></div>
        <div class="kpis"><div class="card kpi"><b>${d.teams.length}</b><small>Equipos</small></div><div class="card kpi"><b>${played}</b><small>Jugados</small></div><div class="card kpi"><b>${goals}</b><small>Goles</small></div></div>
      </section>
      <div class="two-col mt-4"><div>${left}</div><div>${right}</div></div>`;
    }, { after: (el) => { const slot = el.querySelector('[data-rive]'); stopRive?.(); if (slot)
            void mountRive(slot, 'hero.riv').then((f) => (stopRive = f)); } });
};
export default home;
