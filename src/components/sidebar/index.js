/* MENÚ LATERAL (☰): secciones secundarias, apariencia, rendimiento e instalación. */
import { APP } from '../../core/config.js';
import { closeLayer, openLayer } from '../../core/layers.js';
import { drawerFeatures, isActive } from '../../core/navigation.js';
import { navigate } from '../../core/router.js';
import { effectivePerf, getPrefs, setPrefs } from '../../core/prefs.js';
import { canInstall, isStandalone, promptInstall } from '../../core/lifecycle.js';
import { FEATURES } from '../../features/registry.js';
import { getData } from '../../services/data/index.js';
import { isLive } from '../../services/data/selectors.js';
import { esc } from '../../utils/dom.js';
import { icon } from '../icons.js';
import { toast } from '../modals/index.js';
const THEMES = [['light', 'Claro', 'sun'], ['dark', 'Oscuro', 'moon'], ['system', 'Sistema', 'monitor']];
const PERFS = [['auto', 'Auto'], ['eco', 'ECO'], ['balanced', 'BALANCED'], ['ultra', 'ULTRA']];
const PERF_HINT = {
    eco: 'Sin desenfoque, animaciones mínimas. Ideal para celulares de gama baja.',
    balanced: 'Transiciones suaves y desenfoque solo donde aporta.',
    ultra: 'Efectos avanzados y animaciones Rive. Para equipos potentes.',
};
export function openDrawer() {
    const d = getData();
    const p = getPrefs();
    const live = d.matches.filter(isLive).length;
    const admin = FEATURES.find((f) => f.id === 'admin');
    const adminLink = `<a class="drawer__link" href="#${admin.path}">${icon(admin.icon, 20)}<span>${esc(admin.title)}</span>${icon('chevron-right', 16, 'drawer__chev')}</a>`;
    const links = drawerFeatures()
        .map((f) => `<a class="drawer__link ${isActive(f) ? 'is-active' : ''}" href="#${f.path}">${icon(f.icon, 20)}<span>${esc(f.title)}</span>${icon('chevron-right', 16, 'drawer__chev')}</a>`)
        .join('');
    const el = document.createElement('div');
    el.className = 'layer drawer';
    el.innerHTML = `
    <div class="layer__backdrop" data-close></div>
    <aside class="drawer__panel" role="dialog" aria-modal="true" aria-label="Menú">
      <div class="drawer__head">
        <div class="drawer__brand">
          ${d.league.logo ? `<img src="${esc(d.league.logo)}" alt="" width="40" height="40">` : `<span class="brand__mark brand__mark--lg">${icon('zap', 22)}</span>`}
          <div><b data-secret>${esc(d.league.name || APP.name)}</b><small>${esc(d.league.season)} · ${esc(APP.edition)}</small></div>
        </div>
        <button class="icon-btn" data-close aria-label="Cerrar menú">${icon('x', 22)}</button>
      </div>
      ${live ? `<a class="drawer__live" href="#/matches">${icon('zap', 16)} ${live} partido${live > 1 ? 's' : ''} en vivo ahora</a>` : ''}
      <nav class="drawer__links">${links}${adminLink}</nav>
      <div class="drawer__sec">
        <h4>Apariencia</h4>
        <div class="seg seg--full">${THEMES.map(([v, t, ic]) => `<button class="seg__btn ${p.theme === v ? 'is-on' : ''}" data-theme-set="${v}">${icon(ic, 16)} ${t}</button>`).join('')}</div>
        <h4>Rendimiento <small>${p.perf === 'auto' ? `(auto: ${effectivePerf().toUpperCase()})` : ''}</small></h4>
        <div class="seg seg--full">${PERFS.map(([v, t]) => `<button class="seg__btn ${p.perf === v ? 'is-on' : ''}" data-perf-set="${v}">${t}</button>`).join('')}</div>
        <p class="drawer__hint" data-perf-hint>${esc(PERF_HINT[effectivePerf()])}</p>
      </div>
      <div class="drawer__foot">
        ${!isStandalone() && canInstall() ? `<button class="btn btn--secondary btn--block" data-install>${icon('download', 18)}<span>Instalar la app</span></button>` : ''}
        <small>${esc(APP.tagline)}</small>
      </div>
    </aside>`;
    const layer = openLayer(el);
    const close = () => closeLayer(layer);
    let taps = 0, tapTimer;
    el.addEventListener('click', async (e) => {
        const t = e.target;
        if (t.closest('[data-close]'))
            return close();
        const th = t.closest('[data-theme-set]');
        if (th) {
            setPrefs({ theme: th.dataset.themeSet });
            return syncSeg(el);
        }
        const pf = t.closest('[data-perf-set]');
        if (pf) {
            setPrefs({ perf: pf.dataset.perfSet });
            return syncSeg(el);
        }
        if (t.closest('[data-install]')) {
            if (await promptInstall())
                toast('¡Instalada!', 'success');
            return close();
        }
        if (t.closest('[data-secret]')) {
            // Acceso al panel de administración: 7 toques seguidos al nombre de la liga.
            taps++;
            clearTimeout(tapTimer);
            tapTimer = setTimeout(() => (taps = 0), 1500);
            if (taps >= 7) {
                taps = 0;
                navigate('/admin');
            }
            return;
        }
    });
}
function syncSeg(el) {
    const p = getPrefs();
    el.querySelectorAll('[data-theme-set]').forEach((b) => b.classList.toggle('is-on', b.dataset.themeSet === p.theme));
    el.querySelectorAll('[data-perf-set]').forEach((b) => b.classList.toggle('is-on', b.dataset.perfSet === p.perf));
    const hint = el.querySelector('[data-perf-hint]');
    if (hint)
        hint.textContent = PERF_HINT[effectivePerf()];
}
