/* Plantillas del Creador: proyectos de ejemplo que funcionan con datos reales de la app.
   Sirven para ver cómo se escribe un proyecto. Se cargan desde el Creador → Nuevo proyecto → "Usar una plantilla". */
export const TEMPLATES = [
    {
        key: 'isla', label: 'Isla dinámica', hint: 'Cápsula arriba que muestra el partido en vivo (o el próximo) y se expande al tocarla.',
        name: 'Isla dinámica', mount: 'global',
        html: '',
        css: `/* Isla dinámica: queda justo debajo de la barra superior */
.isla-wrap { position: fixed; z-index: 35; left: 50%; top: calc(var(--appbar-h) + var(--safe-t) + 8px); transform: translateX(-50%); display: grid; justify-items: center; gap: 8px; pointer-events: none; max-width: calc(100vw - 24px); }
.isla { pointer-events: auto; display: inline-flex; align-items: center; gap: 8px; max-width: 100%; padding: 8px 16px; border-radius: 999px; background: #000; color: #fff; font: 600 13px/1 var(--font); border: 1px solid rgba(255,255,255,.14); box-shadow: 0 6px 22px rgba(0,0,0,.45); transition: padding .25s var(--ease), transform .2s var(--ease); }
.isla:active { transform: scale(.96); }
.isla__dot { width: 8px; height: 8px; border-radius: 50%; background: #8a8f9c; flex: none; }
.isla.is-live .isla__dot { background: var(--live); animation: isla-pulse 1.4s infinite; }
.isla__txt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.isla-panel { pointer-events: auto; width: min(92vw, 380px); padding: 8px; border-radius: 22px; background: #000; color: #fff; border: 1px solid rgba(255,255,255,.14); box-shadow: 0 14px 40px rgba(0,0,0,.55); display: grid; gap: 2px; animation: isla-in .22s var(--ease); }
.isla-panel button { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px; border-radius: 14px; color: #fff; text-align: left; font-size: 14px; }
.isla-panel button:active { background: rgba(255,255,255,.1); }
.isla-panel small { color: #9aa0ad; }
@keyframes isla-in { from { opacity: 0; transform: translateY(-6px) scale(.97); } }
@keyframes isla-pulse { 50% { opacity: .35; } }
@media (prefers-reduced-motion: reduce) { .isla.is-live .isla__dot, .isla-panel { animation: none; } }`,
        js: `// ISLA DINÁMICA · usa los datos reales de la app (api.data()).
// Se actualiza sola cuando cambian los datos y al cambiar de pantalla.
const wrap = document.createElement('div');
wrap.className = 'isla-wrap';
api.host.appendChild(wrap);
let open = false;

const D = () => api.data();
const team = (id) => D().teams.find((t) => t.id === id);
const short = (id) => team(id)?.short ?? '?';
const liveList = () => D().matches.filter((m) => m.status === 'live' || m.status === 'paused');
const nextList = () => D().matches.filter((m) => m.status === 'upcoming').sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
const when = (m) => new Date(m.kickoff).toLocaleString('es-AR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
const line = (m) => (m.status === 'upcoming' ? \`\${short(m.homeId)} vs \${short(m.awayId)} · \${when(m)}\` : \`\${short(m.homeId)} \${m.homeScore ?? 0}-\${m.awayScore ?? 0} \${short(m.awayId)}\${m.minute ? " · " + m.minute + "'" : ''}\`);

function paint() {
  const live = liveList();
  const items = live.length ? live : nextList().slice(0, 3);
  const head = items[0];
  const text = head ? (live.length ? line(head) : 'Próximo · ' + line(head)) : D().league.name;
  wrap.innerHTML =
    \`<button class="isla \${live.length ? 'is-live' : ''}" aria-expanded="\${open}" aria-label="Partidos"><span class="isla__dot"></span><span class="isla__txt">\${api.esc(text)}</span></button>\` +
    (open && items.length ? \`<div class="isla-panel">\${items.map((m) => \`<button data-go="\${api.esc(m.id)}"><span>\${api.esc(team(m.homeId)?.name ?? '')} - \${api.esc(team(m.awayId)?.name ?? '')}</span><small>\${api.esc(line(m))}</small></button>\`).join('')}</div>\` : '');
}
api.listen(wrap, 'click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) { open = false; paint(); api.navigate('/match/' + go.dataset.go); return; }
  if (e.target.closest('.isla')) { open = !open; paint(); }
});
api.listen(document, 'click', (e) => { if (open && !e.composedPath().includes(wrap)) { open = false; paint(); } });
api.on('data', paint);
api.on('route', () => { open = false; paint(); });
api.interval(paint, 30000);
paint();
`,
    },
    {
        key: 'cartel', label: 'Cartel en Inicio', hint: 'Un cartel dentro de la pantalla de Inicio (ejemplo de proyecto "en una pantalla").',
        name: 'Cartel en Inicio', mount: 'screen', screen: 'home', position: 'start',
        html: '<div class="cartel"><b>📣 Aviso de la liga</b><span>Editá este texto desde el Creador (pestaña HTML).</span></div>',
        css: '.cartel { display: grid; gap: 4px; padding: 14px 16px; margin: 12px 0; border-radius: var(--r-lg); background: var(--accent-soft); color: var(--text); border: 1px solid var(--accent); }\n.cartel span { color: var(--text-2); font-size: var(--fs-sm); }',
        js: '',
    },
    {
        key: 'seccion', label: 'Sección nueva', hint: 'Una pantalla nueva con su botón en el menú (ejemplo: resumen de la liga).',
        name: 'Resumen de la liga', mount: 'section', section: { title: 'Resumen', icon: 'bar-chart', nav: 'drawer' },
        html: '<div class="resumen"></div>',
        css: '.resumen { display: grid; gap: 12px; padding-top: 8px; }\n.resumen__k { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }\n.resumen__k div { background: var(--card); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 14px; text-align: center; }\n.resumen__k b { display: block; font-size: var(--fs-xl); }\n.resumen__k small { color: var(--text-2); }',
        js: `// Sección nueva: api.host es la pantalla. Se redibuja cuando cambian los datos.
const box = api.host.querySelector('.resumen');
function paint() {
  const d = api.data();
  const goles = d.matches.reduce((s, m) => s + (m.homeScore ?? 0) + (m.awayScore ?? 0), 0);
  box.innerHTML = \`<h1>\${api.esc(d.league.name)}</h1><div class="resumen__k"><div><b>\${d.teams.length}</b><small>Equipos</small></div><div><b>\${d.matches.length}</b><small>Partidos</small></div><div><b>\${goles}</b><small>Goles</small></div></div>\`;
}
api.on('data', paint);
paint();
`,
    },
];
