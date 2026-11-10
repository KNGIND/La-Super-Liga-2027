/* BÚSQUEDA GLOBAL: equipos, jugadores, partidos y noticias. Todo local, instantáneo y sin tildes. */
import { crest } from '../../components/cards/crest.js';
import { matchCard, matchList } from '../../components/cards/match-card.js';
import { newsCard } from '../../components/cards/news-card.js';
import { icon } from '../../components/icons.js';
import { emptyState } from '../../components/loaders/index.js';
import { getData } from '../../services/data/index.js';
import { team } from '../../services/data/selectors.js';
import { ls } from '../../services/storage/kv.js';
import { debounce, esc, norm } from '../../utils/dom.js';
const K = 'lsl27:recent';
const search = (ctx) => {
    let q = '';
    const run = () => {
        const d = getData(), n = norm(q), box = ctx.el.querySelector('[data-results]');
        if (n.length < 2) {
            const recent = ls.get(K, []);
            box.innerHTML = recent.length ? `<h4 class="mb-3">Búsquedas recientes</h4><div class="recent">${recent.map((r) => `<button class="chip" data-recent="${esc(r)}">${icon('history', 12)} ${esc(r)}</button>`).join('')}</div>` : emptyState('Buscá lo que quieras', 'Equipos, jugadores, partidos o noticias.', 'search');
            return;
        }
        const teams = d.teams.filter((t) => norm(t.name + ' ' + t.short).includes(n));
        const players = d.players.filter((p) => norm(p.name).includes(n)).slice(0, 12);
        const matches = d.matches.filter((m) => norm(`${team(d, m.homeId)?.name} ${team(d, m.awayId)?.name} ${m.round} ${m.stadium}`).includes(n)).slice(0, 8);
        const news = d.news.filter((x) => norm(x.title + ' ' + x.summary).includes(n)).slice(0, 6);
        const sec = (t, body) => (body ? `<section class="section"><div class="section__head"><h3>${t}</h3></div>${body}</section>` : '');
        const html = sec('Equipos', `<div class="grid grid--2">${teams.map((t) => `<a class="card tc" href="#/team/${esc(t.id)}" data-keep style="--team:${esc(t.color)}">${crest(t, 36)}<b>${esc(t.name)}</b></a>`).join('')}</div>`.replace(/^<div class="grid grid--2"><\/div>$/, '')) +
            sec('Jugadores', players.length ? `<div class="grid grid--2">${players.map((p) => `<a class="card pc" href="#/team/${esc(p.teamId)}" data-keep><span class="pc__num">${p.number}</span><div class="pc__body"><b>${esc(p.name)}</b><small>${esc(team(d, p.teamId)?.name)} · ${esc(p.pos)}</small></div></a>`).join('')}</div>` : '') +
            sec('Partidos', matches.length ? `${matchList(d, matches, { showDate: true })}` : '') +
            sec('Noticias', news.length ? `<div class="grid grid--2">${news.map((x) => newsCard(x)).join('')}</div>` : '');
        box.innerHTML = teams.length || players.length || matches.length || news.length ? html : emptyState(`Sin resultados para “${q}”`, 'Revisá la ortografía o probá con otra palabra.', 'search');
    };
    ctx.view(() => `<div class="searchbar"><input class="input" id="sq" type="search" placeholder="Buscar equipos, jugadores, partidos…" autocomplete="off" enterkeyhint="search" value="${esc(q)}">${icon('search', 18)}</div><div data-results></div>`, { on: [], after: () => { run(); ctx.el.querySelector('#sq')?.focus({ preventScroll: true }); } });
    const save = debounce(() => { const n = q.trim(); if (n.length >= 2)
        ls.set(K, [n, ...ls.get(K, []).filter((x) => x !== n)].slice(0, 8)); }, 1200);
    ctx.on('input', '#sq', (el) => { q = el.value; run(); save(); });
    ctx.on('click', '[data-recent]', (el) => { q = el.dataset.recent; ctx.el.querySelector('#sq').value = q; run(); });
};
export default search;
