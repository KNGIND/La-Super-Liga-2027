/* Encabezado: ☰ a la izquierda · identidad al centro · búsqueda, avisos y perfil a la derecha.
   En pantallas "inmersivas" (detalle de partido, noticia) muestra una flecha de volver en lugar del ☰. */
import { APP } from '../../core/config.js';
import { icon } from '../icons.js';
import { esc } from '../../utils/dom.js';
export function renderHeader(s, immersive, title) {
    const left = immersive
        ? `<button class="icon-btn" data-act="back" aria-label="Volver">${icon('arrow-left', 22)}</button>`
        : `<button class="icon-btn" data-act="menu" aria-label="Abrir menú">${icon('menu', 22)}</button>`;
    const center = immersive
        ? `<div class="brand brand--title"><span class="brand__name">${esc(title)}</span></div>`
        : `<a class="brand" href="#/" data-act="brand" aria-label="${esc(s.name)}, ir al inicio">
         ${s.logo ? `<img class="brand__logo" src="${esc(s.logo)}" alt="" width="28" height="28">` : `<span class="brand__mark">${icon('zap', 16)}</span>`}
         <span class="brand__name">${esc(s.name || APP.name)}</span><span class="brand__ed">${esc(APP.edition)}</span></a>`;
    if (immersive) // pantalla completa (detalle de partido, noticia): solo volver, título y compartir
        return `<div class="appbar__side">${left}</div>${center}<div class="appbar__side appbar__side--end"><button class="icon-btn" data-act="share" aria-label="Compartir">${icon('share', 22)}</button></div>`;
    return `
    <div class="appbar__side">${left}</div>
    ${center}
    <div class="appbar__side appbar__side--end">
      <a class="icon-btn" href="#/search" aria-label="Buscar">${icon('search', 22)}</a>
      <a class="icon-btn" href="#/notifications" aria-label="Notificaciones${s.unread ? `, ${s.unread} sin leer` : ''}">${icon('bell', 22)}${s.unread ? `<span class="dot-badge">${s.unread > 9 ? '9+' : s.unread}</span>` : ''}</a>
      <a class="avatar" href="#/profile" aria-label="Perfil">${s.avatar ? `<img class="avatar__img" src="${esc(s.avatar)}" alt="" width="32" height="32">` : s.initial === '·' ? icon('user', 18) : esc(s.initial)}</a>
    </div>`;
}
