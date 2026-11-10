/* DETALLE DE EQUIPO: resumen, partidos y plantel. Con botón de favorito. */
import { icon } from '../../components/icons.js';
import { crest } from '../../components/cards/crest.js';
import { matchCard, matchList } from '../../components/cards/match-card.js';
import { playerCard } from '../../components/cards/player-card.js';
import { emptyState } from '../../components/loaders/index.js';
import { toast } from '../../components/modals/index.js';
import { getData } from '../../services/data/index.js';
import { matchesOfTeam, playersOf, standings, statsOfPlayer, team } from '../../services/data/selectors.js';
import { favoriteTeams, toggleFavoriteTeam } from '../../services/user.js';
import { esc } from '../../utils/dom.js';
const POS = [['POR', 'Arqueros'], ['DEF', 'Defensores'], ['MED', 'Mediocampistas'], ['DEL', 'Delanteros'], ['', 'Otros']];
const detail = (ctx) => {
    ctx.view(() => {
        const d = getData();
        const t = team(d, ctx.params.id);
        if (!t)
            return emptyState('No encontramos el equipo', '', 'shield', '<a class="btn btn--primary" href="#/teams">Ver equipos</a>');
        const ms = matchesOfTeam(d, t.id);
        const row = standings(d).find((r) => r.teamId === t.id);
        const pos = standings(d).findIndex((r) => r.teamId === t.id) + 1;
        const isFav = favoriteTeams().includes(t.id);
        const squad = playersOf(d, t.id);
        const upcoming = ms.filter((m) => m.status !== 'finished').slice(0, 3);
        const recent = ms.filter((m) => m.status === 'finished').slice(-3).reverse();
        return `
      <section class="card team-hero" style="--team:${esc(t.color)}">
        ${crest(t, 80)}
        <div class="grow"><h1>${esc(t.name)}</h1>
          ${row ? `<div class="team-hero__stats"><div><b>${pos}º</b><small>Posición</small></div><div><b>${row.points}</b><small>Puntos</small></div><div><b>${row.played}</b><small>Jugados</small></div><div><b>${row.gf}-${row.ga}</b><small>Goles</small></div></div>` : ''}
        </div>
        <button class="icon-btn fav-btn ${isFav ? 'is-on' : ''}" data-fav aria-label="${isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}" aria-pressed="${isFav}">${icon('star', 24)}</button>
      </section>
      ${upcoming.length ? `<section class="section"><div class="section__head"><h3>Próximos</h3></div>${matchList(d, upcoming, { showDate: true })}</section>` : ''}
      ${recent.length ? `<section class="section"><div class="section__head"><h3>Últimos resultados</h3></div>${matchList(d, recent, { showDate: true })}</section>` : ''}
      <section class="section"><div class="section__head"><h3>Plantel</h3><small>${squad.length} jugadores</small></div>
        ${POS.map(([p, label]) => {
            const list = squad.filter((x) => (x.pos || '') === p);
            return list.length ? `<h4 class="pos-title">${label}</h4><div class="grid grid--2">${list.map((x) => { const s = statsOfPlayer(d, t.id, x.name); return playerCard(d, x, s.goals ? `<span class="chip chip--success">${s.goals} ⚽</span>` : ''); }).join('')}</div>` : '';
        }).join('') || emptyState('Plantel sin cargar', '', 'users')}
      </section>`;
    }, { on: ['data', 'session'] });
    ctx.on('click', '[data-fav]', async () => {
        const t = team(getData(), ctx.params.id);
        if (!t)
            return;
        try {
            toast((await toggleFavoriteTeam(t.id, t.name)) ? `${t.name} es favorito` : 'Quitado de favoritos', 'success');
        }
        catch {
            toast('No se pudo guardar el favorito', 'error');
        }
    });
};
export default detail;
