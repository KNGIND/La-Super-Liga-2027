/* NOTIFICACIONES: lista de avisos (del servidor + detectados en este dispositivo). */
import { icon } from '../../components/icons.js';
import { emptyState, notice } from '../../components/loaders/index.js';
import { getPrefs } from '../../core/prefs.js';
import { allNotifications, markAllRead } from '../../services/notifications/index.js';
import { esc } from '../../utils/dom.js';
import { timeAgo, ts } from '../../utils/format.js';
const ICON = { match: 'clock', result: 'ball', news: 'newspaper', announcement: 'megaphone', activity: 'star' };
const notifications = (ctx) => {
    const seen = ts(getPrefs().lastSeenNotifications); // lo "nuevo" es lo posterior a la visita anterior
    ctx.view(() => {
        const list = allNotifications();
        return `<div class="page-head"><div class="row row--between"><h1>Notificaciones</h1><a class="btn btn--sm btn--ghost" href="#/profile">${icon('sliders', 16)} Preferencias</a></div>
      ${notice('Los avisos se generan mientras la app está abierta. El push con la app cerrada está pendiente de integración (ver docs/notificaciones-push.md).', 'info')}</div>
      ${list.length ? `<div class="stack stack--sm">${list.map((n) => `<a class="card nt ${ts(n.createdAt) > seen ? 'is-new' : ''}" href="#${esc(n.link || '/')}"><span class="nt__ico">${icon(ICON[n.kind] ?? 'bell', 18)}</span><div class="nt__body"><b>${esc(n.title)}</b><span class="muted">${esc(n.body)}</span><small>${esc(timeAgo(n.createdAt))}</small></div></a>`).join('')}</div>` : emptyState('Sin notificaciones', 'Te avisamos cuando empiece un partido, haya goles o salga una noticia.', 'bell')}`;
    });
    ctx.listen(() => markAllRead());
    setTimeout(() => markAllRead(), 1500);
};
export default notifications;
