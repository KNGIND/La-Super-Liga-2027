import { standings } from '../../services/data/selectors.js';
import { esc } from '../../utils/dom.js';
import { crest } from './crest.js';
export function teamCard(d, t, opts = {}) {
    const pos = standings(d).findIndex((r) => r.teamId === t.id) + 1;
    const row = standings(d).find((r) => r.teamId === t.id);
    return `<a class="tc card" href="#/team/${esc(t.id)}" style="--team:${esc(t.color)}">
    ${crest(t, 52)}
    <div class="tc__body"><b>${esc(t.name)}</b><small>${row ? `${pos}º · ${row.points} pts · ${row.played} PJ` : esc(t.short)}</small></div>
    ${opts.favorite ? '<span class="tc__fav" title="Favorito">★</span>' : ''}
  </a>`;
}
