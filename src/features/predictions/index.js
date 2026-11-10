/* PRONÓSTICOS: elegís el resultado de los próximos partidos, ves tus puntos y el ranking.
   Los puntos de cuentas en la nube los calcula el SERVIDOR (trigger SQL). Acá solo se muestran. */
import { segmented } from '../../components/buttons/index.js';
import { crest } from '../../components/cards/crest.js';
import { icon } from '../../components/icons.js';
import { emptyState, notice } from '../../components/loaders/index.js';
import { openModal, toast } from '../../components/modals/index.js';
import { getData, getStatus } from '../../services/data/index.js';
import { flushPredictions, getPredictions, isCloudUser, isOpen, loadLeaderboard, savePrediction, totalPoints } from '../../services/data/predictions.js';
import { sortedMatches, team } from '../../services/data/selectors.js';
import { currentProfile } from '../../services/supabase/auth.js';
import { logActivity } from '../../services/user.js';
import { esc } from '../../utils/dom.js';
import { dayShort, timeOf } from '../../utils/format.js';
import { rulesText } from './scoring.js';
const predictions = (ctx) => {
    let tab = 'play';
    const draft = {};
    let board = null, boardErr = '';
    const loadBoard = () => loadLeaderboard().then((r) => { board = r; boardErr = ''; ctx.refresh(); }).catch((e) => { board = []; boardErr = e.message; ctx.refresh(); });
    ctx.view(() => {
        const d = getData();
        const mine = getPredictions();
        const cloud = isCloudUser();
        const mode = getStatus().mode;
        const open = sortedMatches(d).filter((m) => isOpen(m));
        const done = sortedMatches(d).filter((m) => mine[m.id] && !isOpen(m)).reverse();
        const pending = Object.values(mine).filter((p) => !p.synced).length;
        const play = open.length ? `<div class="stack">${open.map((m) => {
            const cur = draft[m.id] ?? (mine[m.id] ? [mine[m.id].home, mine[m.id].away] : [0, 0]);
            const saved = mine[m.id];
            const dirty = !saved || saved.home !== cur[0] || saved.away !== cur[1];
            const h = team(d, m.homeId), a = team(d, m.awayId);
            const step = (side, name) => `<div class="stepper"><button data-step="${m.id}|${side}|-1" aria-label="Menos goles ${name}">${icon('minus', 16)}</button><output>${cur[side]}</output><button data-step="${m.id}|${side}|1" aria-label="Más goles ${name}">${icon('plus', 16)}</button></div>`;
            return `<div class="card pred"><div class="row row--between"><small>${esc(dayShort(m.kickoff))} · ${esc(timeOf(m.kickoff))} hs</small>${saved ? `<span class="chip ${saved.synced ? 'chip--success' : 'chip--warn'}">${saved.synced ? 'Guardado' : 'Pendiente de enviar'}</span>` : ''}</div>
        <div class="pred__row"><div class="pred__team">${crest(h, 32)}<span>${esc(h?.name)}</span></div><div class="row" style="gap:6px">${step(0, h?.name ?? '')}<b>-</b>${step(1, a?.name ?? '')}</div><div class="pred__team">${crest(a, 32)}<span>${esc(a?.name)}</span></div></div>
        <div class="pred__foot"><span>${saved ? `Tu pronóstico: ${saved.home}-${saved.away}` : 'Sin pronóstico'}</span><button class="btn btn--sm ${dirty ? 'btn--primary' : ''}" data-save="${m.id}" ${dirty ? '' : 'disabled'}>Guardar</button></div></div>`;
        }).join('')}</div>` : emptyState('No hay partidos para pronosticar', 'Cuando se programen nuevos partidos, podés cargar tu resultado hasta que empiecen.', 'target');
        const history = done.length ? `<div class="stack">${done.map((m) => {
            const p = mine[m.id], h = team(d, m.homeId), a = team(d, m.awayId);
            const real = m.homeScore == null ? 'Pendiente' : `${m.homeScore}-${m.awayScore}`;
            const pts = p.points == null ? (m.status === 'finished' ? 'Calculando…' : 'En juego') : `+${p.points} pts`;
            return `<a class="card pred" href="#/match/${esc(m.id)}"><div class="row row--between"><b>${esc(h?.short)} vs ${esc(a?.short)}</b><span class="chip ${p.points ? 'chip--success' : ''}">${pts}</span></div><div class="pred__foot mt-2"><span>Tu pronóstico: <b>${p.home}-${p.away}</b></span><span>Resultado: <b>${real}</b></span></div></a>`;
        }).join('')}</div>` : emptyState('Todavía no tenés historial', 'Tus pronósticos de partidos ya jugados aparecen acá.', 'history');
        const me = currentProfile()?.id;
        const ranking = !cloud && mode !== 'cloud' ? emptyState('El ranking necesita la nube', 'En modo local solo ves tus puntos. Con Supabase configurado y una cuenta, competís contra los demás.', 'award')
            : board === null ? '<div class="center mt-6"><span class="spinner"></span></div>'
                : boardErr ? notice(`No se pudo cargar el ranking: ${boardErr}`, 'error')
                    : board.length ? `<div class="stack stack--sm">${board.map((r, i) => `<div class="card rank ${r.userId === me ? 'is-me' : ''}"><span class="rank__pos">${i + 1}</span><div class="grow"><b>${esc(r.name)}</b><br><small>${r.exact} exactos · ${r.predictions} pronósticos</small></div><b>${r.points} pts</b></div>`).join('')}</div>`
                        : emptyState('Aún no hay puntos', 'El ranking se arma cuando terminan los partidos pronosticados.', 'award');
        return `
      <div class="page-head"><div class="row row--between"><h1>Pronósticos</h1><button class="btn btn--sm btn--ghost" data-rules>${icon('info', 16)} Reglas</button></div>
        <div class="card card--pad row row--between"><div><small>Tus puntos${cloud ? '' : ' (locales)'}</small><h2 class="num">${totalPoints()}</h2></div><div class="center"><small>Pronósticos</small><h2 class="num">${Object.keys(mine).length}</h2></div></div>
        ${!cloud && getStatus().mode === 'cloud' ? notice('Iniciá sesión desde tu perfil para que tus pronósticos entren al ranking. Hasta entonces se guardan solo en este dispositivo.', 'warn') : ''}
        ${mode === 'local' ? notice('Modo local: los puntos se calculan en este dispositivo y no hay ranking compartido.', 'info') : ''}
        ${pending ? `<div class="notice notice--warn row row--between"><span>${pending} pronóstico(s) sin enviar al servidor.</span><button class="btn btn--sm" data-flush>Enviar ahora</button></div>` : ''}
        ${segmented([['play', 'Pronosticar'], ['history', 'Historial'], ['ranking', 'Ranking']], tab, 'data-tab')}
      </div>${tab === 'play' ? play : tab === 'history' ? history : ranking}`;
    }, { on: ['data', 'predictions', 'session'] });
    ctx.on('click', '[data-tab]', (el) => { tab = el.dataset.tab; if (tab === 'ranking' && board === null)
        void loadBoard(); ctx.refresh(); });
    ctx.on('click', '[data-step]', (el) => {
        const [id, side, delta] = el.dataset.step.split('|');
        const mine = getPredictions()[id];
        const cur = draft[id] ?? (mine ? [mine.home, mine.away] : [0, 0]);
        const next = [cur[0], cur[1]];
        next[Number(side)] = Math.max(0, Math.min(30, next[Number(side)] + Number(delta)));
        draft[id] = next;
        ctx.refresh();
    });
    ctx.on('click', '[data-save]', async (el) => {
        const id = el.dataset.save;
        const v = draft[id] ?? [0, 0];
        try {
            const r = await savePrediction(id, v[0], v[1]);
            delete draft[id];
            logActivity(`Pronóstico guardado: ${v[0]}-${v[1]}`);
            toast(r === 'saved' ? 'Pronóstico guardado' : 'Guardado. Se enviará cuando haya conexión.', r === 'saved' ? 'success' : 'info');
        }
        catch (e) {
            toast(e.message, 'error');
        }
    });
    ctx.on('click', '[data-flush]', async () => toast((await flushPredictions()) ? 'Enviados' : 'No se pudo enviar todavía', 'info'));
    ctx.on('click', '[data-rules]', () => openModal({ title: 'Reglas de puntuación', body: `<ul class="stack stack--sm">${rulesText().map((t) => `<li class="card card--pad">${esc(t)}</li>`).join('')}</ul>` }));
};
export default predictions;
