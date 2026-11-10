/* PLANTELES Y ALINEACIONES: elegís un equipo y ves su plantel y la última alineación publicada. */
import { segmented } from '../../components/buttons/index.js';
import { crest } from '../../components/cards/crest.js';
import { emptyState } from '../../components/loaders/index.js';
import { getData } from '../../services/data/index.js';
import { matchesOfTeam, playersOf, team } from '../../services/data/selectors.js';
import { esc } from '../../utils/dom.js';
import { dateShort } from '../../utils/format.js';
import { formationRows } from '../../utils/lineup.js';
const squads = (ctx) => {
    let sel = '';
    ctx.view(() => {
        const d = getData();
        if (!d.teams.length)
            return emptyState('Sin equipos', '', 'clipboard');
        if (!d.teams.some((t) => t.id === sel))
            sel = d.teams[0].id;
        const t = team(d, sel);
        const last = matchesOfTeam(d, sel).filter((m) => (m.homeId === sel ? m.homeLineup : m.awayLineup).length).pop();
        const home = last?.homeId === sel;
        const lineup = last ? (home ? last.homeLineup : last.awayLineup) : [];
        const formation = last ? (home ? last.homeFormation : last.awayFormation) : '';
        const rows = last ? formationRows(formation, lineup) : null;
        const squad = playersOf(d, sel);
        return `
      <div class="page-head"><h1>Planteles</h1>${segmented(d.teams.map((x) => [x.id, x.short || x.name]), sel, 'data-t')}</div>
      <div class="two-col">
        <section class="section"><div class="section__head"><h3 class="row">${crest(t, 28)} ${esc(t.name)}</h3></div>
          ${last ? `<p class="muted mb-3">Última alineación: vs ${esc(team(d, home ? last.awayId : last.homeId)?.name)} · ${esc(dateShort(last.kickoff))} · ${esc(formation || 'sin formación')}</p>` : ''}
          ${rows ? `<div class="pitch" style="--c1:${esc(t.color)};--c2:${esc(t.color2)};--ink:#fff">${rows.map((r) => `<div class="pitch__line">${r.map((p) => `<div class="pp"><i>${p.number}</i><span>${esc(p.name)}</span></div>`).join('')}</div>`).join('')}</div>` : emptyState('Sin alineación publicada', 'Se muestra la del último partido que la tenga cargada.', 'clipboard')}
        </section>
        <section class="section"><div class="section__head"><h3>Plantel (${squad.length})</h3></div>
          <ul class="card card--pad lineup-list">${squad.slice().sort((a, b) => a.number - b.number).map((p) => `<li><b>${p.number}</b><span class="grow">${esc(p.name)}</span><small>${esc(p.pos)}</small></li>`).join('') || '<li>Sin jugadores cargados</li>'}</ul>
        </section>
      </div>`;
    });
    ctx.on('click', '[data-t]', (el) => { sel = el.dataset.t; ctx.refresh(); });
};
export default squads;
