/* TABLA DE POSICIONES — se calcula siempre desde los partidos (nunca se escribe a mano).
   Incluye historial por jornada y goleadores. */
import { seasonPicker } from '../../components/buttons/index.js';
import { crest } from '../../components/cards/crest.js';
import { icon } from '../../components/icons.js';
import { emptyState } from '../../components/loaders/index.js';
import { getData } from '../../services/data/index.js';
import { currentSeason, forSeason, roundsOf, standings, team, topScorers, zoneAt } from '../../services/data/selectors.js';
import { favoriteTeams } from '../../services/user.js';
import { esc } from '../../utils/dom.js';
import { signed } from '../../utils/format.js';
const standingsScreen = (ctx) => {
    let round = '';
    let season = '';
    ctx.view(() => {
        const full = getData();
        const sid = season || currentSeason(full)?.id;
        const d = forSeason(full, sid);
        if (!d.teams.length)
            return emptyState('Sin equipos todavía', '', 'list');
        const rounds = roundsOf(d, 'liga').filter((r) => d.matches.some((m) => m.competitionId === 'liga' && m.round === r && m.status === 'finished'));
        const rows = standings(d, 'liga', round || undefined);
        const fav = favoriteTeams();
        const zones = (d.zones ?? []).filter((z) => z.enabled).sort((a, b) => a.fromBottom - b.fromBottom || a.position - b.position);
        const scorers = topScorers(d, 8);
        return `
      <div class="page-head"><h1>Tabla de posiciones</h1>${seasonPicker(full, sid)}
        <p>${esc(full.seasons.find((s) => s.id === sid)?.name ?? d.league.season)} · Victoria ${d.league.pointsWin} pts, empate ${d.league.pointsDraw}, derrota ${d.league.pointsLoss}.</p>
        ${rounds.length ? `<label class="field" style="max-width:260px;margin:0"><span class="field__label">Ver tabla hasta</span><select class="input" data-round><option value="">Actual</option>${rounds.map((r) => `<option ${r === round ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>` : ''}
      </div>
      <div class="table-scroll"><table class="tbl tbl--st"><thead><tr><th>#</th><th style="text-align:left">Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th><th>Forma</th></tr></thead><tbody>
      ${rows.map((r, i) => {
            const t = team(d, r.teamId);
            const z = zoneAt(d.zones, i, rows.length);
            return `<tr class="${z ? 'has-zone' : ''} ${fav.includes(r.teamId) ? 'is-fav' : ''}" ${z ? `style="--zone:${esc(z.color)}" title="${esc(z.label)}"` : ''}><td><span class="rk">${i + 1}</span></td><td class="team"><a class="tname" href="#/team/${esc(r.teamId)}">${crest(t, 26)}<span>${esc(t?.name)}</span>${z?.icon ? `<span class="zone-ico">${icon(z.icon, 15)}</span>` : ''}</a></td><td>${r.played}</td><td>${r.won}</td><td>${r.drawn}</td><td>${r.lost}</td><td>${r.gf}</td><td>${r.ga}</td><td>${signed(r.gd)}</td><td class="pts">${r.points}</td><td><span class="form">${r.form.map((f) => `<i class="${f}" title="${f}"></i>`).join('')}</span></td></tr>`;
        }).join('')}</tbody></table></div>
      <div class="legend">${zones.map((z) => `<span style="--c:${esc(z.color)}">${esc(z.label)}</span>`).join('')}${fav.length ? '<span style="--c:var(--accent)">Tus equipos</span>' : ''}</div>
      ${scorers.length ? `<section class="section"><div class="section__head"><h3>Goleadores</h3></div><div class="card card--pad list">${scorers.map((s, i) => `<div class="list__row"><b class="num">${i + 1}</b><span class="row">${crest(team(d, s.teamId), 24)}<span>${esc(s.player)} <small>${esc(team(d, s.teamId)?.short)}</small></span></span><b class="num">${s.goals}</b></div>`).join('')}</div></section>` : ''}`;
    });
    ctx.on('change', '[data-season]', (el) => { season = el.value; round = ''; ctx.refresh(); });
    ctx.on('change', '[data-round]', (el) => { round = el.value; ctx.refresh(); });
};
export default standingsScreen;
