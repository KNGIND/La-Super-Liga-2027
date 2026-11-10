/* EQUIPOS: lista en tarjetas. */
import { teamCard } from '../../components/cards/team-card.js';
import { emptyState } from '../../components/loaders/index.js';
import { getData } from '../../services/data/index.js';
import { favoriteTeams } from '../../services/user.js';
const teams = (ctx) => {
    ctx.view(() => {
        const d = getData();
        const fav = favoriteTeams();
        const list = d.teams.slice().sort((a, b) => Number(fav.includes(b.id)) - Number(fav.includes(a.id)) || a.name.localeCompare(b.name));
        return `<div class="page-head"><h1>Equipos</h1><p>${list.length} equipos en ${d.league.name}.</p></div>
      ${list.length ? `<div class="grid grid--3">${list.map((t) => teamCard(d, t, { favorite: fav.includes(t.id) })).join('')}</div>` : emptyState('Sin equipos', '', 'shield')}`;
    }, { on: ['data', 'session'] });
};
export default teams;
