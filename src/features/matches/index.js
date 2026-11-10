/* PARTIDOS: calendario con filtros (próximos / en vivo / resultados / todos) y por competición. */
import { segmented, seasonPicker } from '../../components/buttons/index.js';
import { matchCard, matchList } from '../../components/cards/match-card.js';
import { emptyState } from '../../components/loaders/index.js';
import { getData } from '../../services/data/index.js';
import { currentSeason, forSeason, groupByDay, isLive, sortedMatches } from '../../services/data/selectors.js';
import { favoriteTeams } from '../../services/user.js';
import { esc } from '../../utils/dom.js';
import { dayLong, relativeDay, ts } from '../../utils/format.js';
const TABS = [['upcoming', 'Próximos'], ['live', 'En vivo'], ['results', 'Resultados'], ['all', 'Todos']];
/** Selector de fechas: un botón por día con partidos (como el calendario de las apps de fútbol). */
function dateStrip(groups, active) {
    const raw = new Date(groups[0].iso).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }).replace(' de ', ' ');
    const month = raw.charAt(0).toUpperCase() + raw.slice(1);
    const days = groups.map((g) => {
        const dt = new Date(g.iso);
        const wd = dt.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '');
        return `<button type="button" class="day ${g.key === active ? 'is-on' : ''}" data-day="${esc(g.key)}" aria-pressed="${g.key === active}"><span>${esc(wd)}</span><b>${dt.getDate()}</b><i></i></button>`;
    }).join('');
    return `<div class="datestrip__month">${esc(month)}</div><div class="datestrip"><button type="button" class="day ${active === 'all' ? 'is-on' : ''}" data-day="all" aria-pressed="${active === 'all'}"><span>Ver</span><b>Todas</b><i></i></button>${days}</div>`;
}
const matches = (ctx) => {
    const want = ctx.query.get('tab');
    let tab = want && TABS.some(([t]) => t === want) ? want : 'upcoming';
    let comp = 'all';
    let onlyFav = false;
    let season = '';
    let day = 'all'; // día elegido en el selector de fechas ('all' = todos)
    let first = !want;
    ctx.view(() => {
        const full = getData();
        const sid = season || currentSeason(full)?.id;
        const d = forSeason(full, sid);
        const all = sortedMatches(d);
        if (first) { // elige una pestaña útil la primera vez
            first = false;
            if (all.some(isLive))
                tab = 'live';
            else if (!all.some((m) => m.status === 'upcoming'))
                tab = 'results';
        }
        const fav = favoriteTeams();
        let list = all.filter((m) => comp === 'all' || m.competitionId === comp);
        if (onlyFav && fav.length)
            list = list.filter((m) => fav.includes(m.homeId) || fav.includes(m.awayId));
        if (tab === 'upcoming')
            list = list.filter((m) => m.status === 'upcoming');
        if (tab === 'live')
            list = list.filter(isLive);
        if (tab === 'results')
            list = list.filter((m) => m.status === 'finished').reverse();
        const allGroups = groupByDay(list);
        if (day !== 'all' && !allGroups.some((g) => g.key === day))
            day = 'all';
        const groups = day === 'all' ? allGroups : allGroups.filter((g) => g.key === day);
        const strip = allGroups.length > 1 ? dateStrip(allGroups, day) : '';
        const liveCount = all.filter(isLive).length;
        return `
      <div class="page-head">
        <h1>Partidos</h1>
        ${seasonPicker(full, sid)}
        ${segmented(TABS.map(([t, l]) => [t, t === 'live' && liveCount ? `${l} (${liveCount})` : l]), tab, 'data-tab')}
        <div class="filters">
          ${segmented([['all', 'Todas'], ...d.competitions.map((c) => [c.id, c.name])], comp, 'data-comp', 'chips')}
          ${fav.length ? `<button class="chip ${onlyFav ? 'chip--accent' : ''}" data-fav aria-pressed="${onlyFav}">★ Mis equipos</button>` : ''}
        </div>
      </div>
      ${strip}
      ${groups.length ? groups.map((g) => `
        <div class="daylabel">${esc(relativeDay(g.iso))} <small>${esc(dayLong(g.iso))}</small></div>
        ${matchList(d, g.matches, { favoriteIds: fav })}`).join('')
            : emptyState(tab === 'live' ? 'No hay partidos en vivo' : tab === 'upcoming' ? 'No hay partidos próximos' : 'Sin partidos para mostrar', 'Probá con otro filtro.', 'calendar')}
    `;
    });
    void ts;
    ctx.on('click', '[data-tab]', (el) => { tab = el.dataset.tab; day = 'all'; ctx.refresh(); });
    ctx.on('change', '[data-season]', (el) => { season = el.value; day = 'all'; ctx.refresh(); });
    ctx.on('click', '[data-day]', (el) => { day = el.dataset.day; ctx.refresh(); });
    ctx.on('click', '[data-comp]', (el) => { comp = el.dataset.comp; day = 'all'; ctx.refresh(); });
    ctx.on('click', '[data-fav]', () => { onlyFav = !onlyFav; ctx.refresh(); });
};
export default matches;
