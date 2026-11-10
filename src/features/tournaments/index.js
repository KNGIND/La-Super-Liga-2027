/* COPAS Y TORNEOS — los cruces se arman solos con los partidos de cada copa (ida/vuelta, penales). */
import { segmented, seasonPicker } from '../../components/buttons/index.js';
import { crest } from '../../components/cards/crest.js';
import { emptyState } from '../../components/loaders/index.js';
import { getData } from '../../services/data/index.js';
import { cupTies, currentSeason, forSeason, team } from '../../services/data/selectors.js';
import { esc } from '../../utils/dom.js';
import { dayShort } from '../../utils/format.js';
const tournaments = (ctx) => {
    let sel = '';
    let season = '';
    ctx.view(() => {
        const full = getData();
        const sid = season || currentSeason(full)?.id;
        const d = forSeason(full, sid);
        const cups = d.competitions.filter((c) => c.kind === 'copa');
        if (!cups.length)
            return emptyState('No hay copas todavía', 'Cuando se carguen partidos de copa, los cruces aparecen acá.', 'trophy');
        if (!cups.some((c) => c.id === sel))
            sel = cups[0].id;
        const ties = cupTies(d, sel);
        const phases = [...new Set(ties.map((t) => t.phase))];
        const final = ties.find((t) => /^final$/i.test(t.phase) && t.winnerId);
        const champ = final ? team(d, final.winnerId) : undefined;
        return `
      <div class="page-head"><h1>Copas y torneos</h1>${seasonPicker(full, sid)}${cups.length > 1 ? segmented(cups.map((c) => [c.id, c.name]), sel, 'data-cup') : `<p>${esc(cups[0].name)}</p>`}</div>
      ${champ ? `<div class="card champion mb-4">${crest(champ, 56)}<div><small>Campeón</small><h2>${esc(champ.name)}</h2></div><span style="margin-left:auto;color:var(--gold)">${'🏆'}</span></div>` : ''}
      <div class="bracket">${phases.map((ph) => `
        <div class="bracket__col"><h4>${esc(ph)}</h4>
        ${ties.filter((t) => t.phase === ph).map((t) => {
            const a = team(d, t.aId), b = team(d, t.bId);
            const cls = (id) => (t.winnerId ? (t.winnerId === id ? 'is-win' : 'is-lose') : '');
            const multi = t.legs.length > 1;
            return `<div class="card tie">
            <div class="tie__team ${cls(t.aId)}">${crest(a, 28)}<span>${esc(a?.name)}</span><b>${t.legs.some((l) => l.status !== 'upcoming') ? t.aggA : '–'}</b></div>
            <div class="tie__team ${cls(t.bId)}">${crest(b, 28)}<span>${esc(b?.name)}</span><b>${t.legs.some((l) => l.status !== 'upcoming') ? t.aggB : '–'}</b></div>
            ${t.decidedByPens ? `<div class="tie__pens">Definido por penales (${esc(t.legs[t.legs.length - 1].pens)})</div>` : ''}
            <div class="tie__legs">${t.legs.map((l) => `<a href="#/match/${esc(l.id)}"><span>${multi ? (l.leg === 'vuelta' ? 'Vuelta' : 'Ida') : 'Partido'} · ${esc(dayShort(l.kickoff))}</span><b>${l.homeScore == null ? 'Por jugar' : `${l.homeScore}-${l.awayScore}`}</b></a>`).join('')}</div>
          </div>`;
        }).join('')}</div>`).join('')}</div>`;
    });
    ctx.on('change', '[data-season]', (el) => { season = el.value; ctx.refresh(); });
    ctx.on('click', '[data-cup]', (el) => { sel = el.dataset.cup; ctx.refresh(); });
};
export default tournaments;
