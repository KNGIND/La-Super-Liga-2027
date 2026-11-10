/* LA LIGA: información, reglamento, sanciones y canales de transmisión. */
import { APP } from '../../core/config.js';
import { crest } from '../../components/cards/crest.js';
import { icon } from '../../components/icons.js';
import { getData, getStatus } from '../../services/data/index.js';
import { team } from '../../services/data/selectors.js';
import { esc } from '../../utils/dom.js';
import { relativeTime } from '../../core/status.js';
const TYPE = { red: 'Roja', yellow: 'Amarillas', injury: 'Lesión' };
const about = (ctx) => {
    ctx.view(() => {
        const d = getData(), st = getStatus();
        const L = d.league;
        return `
      <div class="page-head"><h1>${esc(L.name)}</h1><p>${esc(L.season)} · ${esc(L.seasonStatus)}</p></div>
      ${L.info ? `<section class="card card--pad pre">${esc(L.info)}</section>` : ''}
      ${L.rules ? `<section class="section"><div class="section__head"><h3>Reglamento</h3></div><div class="card card--pad pre">${esc(L.rules)}</div></section>` : ''}
      <section class="section"><div class="section__head"><h3>Sanciones y lesiones</h3></div>
        ${d.sanctions.length ? `<div class="stack stack--sm">${d.sanctions.map((s) => `<div class="card adm-row">${crest(team(d, s.teamId), 32)}<div class="adm-row__main"><b>${esc(s.player)}</b><small>${esc(team(d, s.teamId)?.name)} · ${esc(s.duration)}${s.notes ? ` · ${esc(s.notes)}` : ''}</small></div><span class="chip ${s.type === 'red' ? 'chip--live' : 'chip--warn'}">${esc(TYPE[s.type] ?? s.type)}</span></div>`).join('')}</div>` : '<p class="muted">Sin sanciones vigentes.</p>'}</section>
      ${d.channels.length ? `<section class="section"><div class="section__head"><h3>Canales de transmisión</h3></div><div class="grid grid--2">${d.channels.map((c) => `<div class="card adm-row">${c.logo ? `<img src="${esc(c.logo)}" alt="" height="28" style="height:28px;width:auto">` : icon('tv', 20)}<b>${esc(c.name)}</b>${c.url ? `<a class="btn btn--sm" style="margin-left:auto" href="${esc(c.url)}" target="_blank" rel="noopener">Abrir</a>` : ''}</div>`).join('')}</div></section>` : ''}
      <section class="section"><div class="card card--pad"><small>Datos: ${st.mode === 'cloud' ? 'nube (Supabase)' : st.mode === 'legacy' ? 'app anterior (solo lectura)' : 'locales'} · ${st.syncedAt ? esc(relativeTime(st.syncedAt)) : 'sin sincronizar'} · versión ${esc(APP.version)}</small></div></section>`;
    });
};
export default about;
