/* NOTICIAS Y COMUNICADOS. */
import { segmented } from '../../components/buttons/index.js';
import { newsCard } from '../../components/cards/news-card.js';
import { emptyState } from '../../components/loaders/index.js';
import { getData } from '../../services/data/index.js';
import { ts } from '../../utils/format.js';
const news = (ctx) => {
    let kind = 'all';
    ctx.view(() => {
        const d = getData();
        const now = Date.now();
        const list = d.news
            .filter((n) => ts(n.publishedAt) <= now + 6e4 && (kind === 'all' || n.kind === kind))
            .sort((a, b) => Number(b.pinned) - Number(a.pinned) || ts(b.publishedAt) - ts(a.publishedAt));
        return `<div class="page-head"><h1>Noticias</h1>${segmented([['all', 'Todo'], ['news', 'Noticias'], ['announcement', 'Comunicados']], kind, 'data-kind')}</div>
      ${list.length ? `<div class="grid grid--2">${list.map((n, i) => newsCard(n, { large: i === 0 })).join('')}</div>` : emptyState('No hay publicaciones', '', 'newspaper')}`;
    });
    ctx.on('click', '[data-kind]', (el) => { kind = el.dataset.kind; ctx.refresh(); });
};
export default news;
