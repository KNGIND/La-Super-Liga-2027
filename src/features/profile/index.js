/* PERFIL: cuenta (si hay nube), nombre, favoritos, preferencias y actividad. */
import { crest } from '../../components/cards/crest.js';
import { icon } from '../../components/icons.js';
import { textField, toggle } from '../../components/inputs/index.js';
import { notice } from '../../components/loaders/index.js';
import { toast } from '../../components/modals/index.js';
import { BACKEND } from '../../core/config.js';
import { getPrefs, setPrefs } from '../../core/prefs.js';
import { getData, getStatus, resetLocal } from '../../services/data/index.js';
import { team } from '../../services/data/selectors.js';
import { requestSystemPermission, systemPermission } from '../../services/notifications/index.js';
import { currentProfile, signIn, signOut, signUp } from '../../services/supabase/auth.js';
import { SbError, getSession } from '../../services/supabase/client.js';
import { avatarUrl, favoritePlayers, favoriteTeams, getActivity, initialOf, logActivity, setAvatar, setName, userName } from '../../services/user.js';
import { cropSquare, pickImageFile } from '../../utils/image.js';
import { confirmDialog } from '../../components/modals/index.js';
import { esc } from '../../utils/dom.js';
import { timeAgo } from '../../utils/format.js';
const profile = (ctx) => {
    let mode = 'in';
    let err = '';
    ctx.view(() => {
        const d = getData(), p = getPrefs(), st = getStatus();
        const cloud = BACKEND.enabled && st.mode !== 'local';
        const logged = !!getSession();
        const prof = currentProfile();
        const perm = systemPermission();
        const favT = favoriteTeams().map((id) => team(d, id)).filter(Boolean);
        const account = cloud && !logged ? `
      <section class="section"><div class="card card--pad">
        <h3>${mode === 'in' ? 'Iniciar sesión' : 'Crear cuenta'}</h3>
        <p class="muted mb-3">Con tu cuenta tus pronósticos y favoritos se guardan en la nube y entrás al ranking.</p>
        <form data-auth novalidate>
          ${mode === 'up' ? textField({ name: 'name', label: 'Nombre visible', required: true, autocomplete: 'nickname' }) : ''}
          ${textField({ name: 'email', label: 'Email', type: 'email', required: true, autocomplete: 'email' })}
          ${textField({ name: 'password', label: 'Contraseña', type: 'password', required: true, autocomplete: mode === 'in' ? 'current-password' : 'new-password', hint: mode === 'up' ? 'Mínimo 6 caracteres.' : '' })}
          ${err ? `<p class="form-error" role="alert">${esc(err)}</p>` : ''}
          <button class="btn btn--primary btn--block" type="submit">${mode === 'in' ? 'Entrar' : 'Registrarme'}</button>
        </form>
        <button class="btn btn--ghost btn--block mt-2" data-switch>${mode === 'in' ? '¿No tenés cuenta? Registrate' : 'Ya tengo cuenta'}</button>
      </div></section>`
            : logged ? `<section class="section"><div class="card card--pad row row--between"><div><b>${esc(prof?.email ?? getSession().email)}</b><br><small>Rol: ${esc(prof?.role ?? 'sin perfil cargado')}</small></div><button class="btn btn--sm" data-logout>${icon('log-out', 16)} Salir</button></div>
        ${!prof ? notice('Sesión iniciada, pero no se pudo leer tu perfil (¿falta correr la migración?).', 'warn') : ''}</section>`
                : `<section class="section">${notice('Estás en modo local: tu perfil y pronósticos se guardan solo en este dispositivo. Para cuentas y ranking, configurá Supabase (docs/supabase.md).', 'info')}</section>`;
        return `
      <section class="card profile-head"><button class="avatar avatar--lg" data-photo aria-label="Cambiar foto de perfil">${avatarUrl() ? `<img class="avatar__img" src="${esc(avatarUrl())}" alt="">` : esc(initialOf())}<span class="avatar__cam">${icon('image', 14)}</span></button><div class="grow"><h2>${esc(userName() || 'Invitado')}</h2><small>${logged ? esc(prof?.email ?? '') : 'Sin cuenta'}</small>
        <div class="row row--wrap mt-2"><button class="btn btn--sm" data-photo>${icon('image', 16)} ${avatarUrl() ? 'Cambiar foto' : 'Agregar foto'}</button>${avatarUrl() ? '<button class="btn btn--sm btn--ghost" data-photo-del>Quitar</button>' : ''}</div></div></section>
      ${account}
      <section class="section"><div class="section__head"><h3>Tu nombre</h3></div><div class="card card--pad"><form data-name class="row" style="align-items:flex-end"><div class="grow">${textField({ name: 'name', label: 'Nombre visible', value: userName() })}</div><button class="btn" type="submit" style="margin-bottom:12px">Guardar</button></form></div></section>
      <section class="section"><div class="section__head"><h3>Favoritos</h3></div><div class="card card--pad">
        ${favT.length ? `<div class="row row--wrap">${favT.map((t) => `<a class="chip chip--accent" href="#/team/${esc(t.id)}">${crest(t, 18)} ${esc(t.name)}</a>`).join('')}</div>` : '<p class="muted">Tocá la ★ en un equipo o jugador para marcarlo como favorito.</p>'}
        <p class="muted mt-3"><small>${favoritePlayers().length} jugador(es) favorito(s)</small></p></div></section>
      <section class="section"><div class="section__head"><h3>Preferencias</h3></div><div class="card card--pad" data-prefs>
        <div class="field"><span class="field__label">Tema</span><div class="seg seg--full">${[['light', 'Claro'], ['dark', 'Oscuro'], ['system', 'Sistema']].map(([v, l]) => `<button class="seg__btn ${p.theme === v ? 'is-on' : ''}" data-theme="${v}">${l}</button>`).join('')}</div></div>
        <div class="field"><span class="field__label">Rendimiento</span><div class="seg seg--full">${[['auto', 'Auto'], ['eco', 'ECO'], ['balanced', 'BALANCED'], ['ultra', 'ULTRA']].map(([v, l]) => `<button class="seg__btn ${p.perf === v ? 'is-on' : ''}" data-perf="${v}">${l}</button>`).join('')}</div></div>
        ${toggle('swipeNavigation', 'Gestos horizontales', p.swipeNavigation, 'Deslizá para cambiar de pestaña')}
        ${toggle('notifyMatches', 'Avisos de partidos', p.notifyMatches, 'Cuando empieza un partido')}
        ${toggle('notifyResults', 'Avisos de resultados y goles', p.notifyResults)}
        ${toggle('notifyNews', 'Avisos de noticias y comunicados', p.notifyNews)}
        ${perm === 'default' ? `<button class="btn btn--block mt-3" data-perm>${icon('bell', 18)} Permitir avisos del sistema</button>` : `<p class="muted mt-3"><small>Avisos del sistema: ${perm === 'granted' ? 'permitidos' : perm === 'denied' ? 'bloqueados en el navegador' : 'no disponibles en este navegador'}. Los avisos con la app cerrada requieren push (pendiente de integración).</small></p>`}
      </div></section>
      <section class="section"><div class="section__head"><h3>Actividad reciente</h3></div><div class="card card--pad list">${getActivity().slice(0, 8).map((a) => `<div class="list__row"><span class="grow">${esc(a.text)}</span><small>${esc(timeAgo(a.at))}</small></div>`).join('') || '<p class="muted">Todavía no hay actividad.</p>'}</div></section>
      <section class="section"><a class="btn btn--block" href="#/admin">${icon('database', 18)} Panel de administración</a>${st.mode === 'local' ? '<button class="btn btn--ghost btn--block mt-2" data-reset>Volver a los datos de ejemplo</button>' : ''}</section>`;
    }, { on: ['data', 'session', 'prefs'] });
    ctx.on('submit', '[data-auth]', async (form, ev) => {
        ev.preventDefault();
        const f = new FormData(form);
        const email = String(f.get('email') ?? '').trim(), pass = String(f.get('password') ?? ''), name = String(f.get('name') ?? '').trim();
        err = '';
        if (!/^\S+@\S+\.\S+$/.test(email))
            err = 'Escribí un email válido.';
        else if (pass.length < 6)
            err = 'La contraseña necesita al menos 6 caracteres.';
        else if (mode === 'up' && name.length < 2)
            err = 'Escribí tu nombre (mínimo 2 letras).';
        if (err)
            return ctx.refresh();
        try {
            if (mode === 'in') {
                await signIn(email, pass);
                logActivity('Iniciaste sesión');
                toast('Sesión iniciada', 'success');
            }
            else if (await signUp(email, pass, name)) {
                logActivity('Creaste tu cuenta');
                toast('¡Cuenta creada!', 'success');
            }
            else {
                toast('Revisá tu email para confirmar la cuenta', 'info', 6000);
                mode = 'in';
            }
        }
        catch (e) {
            err = e instanceof SbError ? e.friendly : 'No se pudo completar la operación.';
        }
        ctx.refresh();
    });
    ctx.on('submit', '[data-name]', async (form, ev) => {
        ev.preventDefault();
        const v = String(new FormData(form).get('name') ?? '');
        try {
            await setName(v);
            toast('Nombre guardado', 'success');
        }
        catch {
            toast('No se pudo guardar', 'error');
        }
    });
    ctx.on('click', '[data-switch]', () => { mode = mode === 'in' ? 'up' : 'in'; err = ''; ctx.refresh(); });
    ctx.on('click', '[data-logout]', async () => { await signOut(); toast('Sesión cerrada'); ctx.refresh(); });
    ctx.on('click', '[data-theme]', (el) => setPrefs({ theme: el.dataset.theme }));
    ctx.on('click', '[data-perf]', (el) => setPrefs({ perf: el.dataset.perf }));
    ctx.on('change', '[data-pref]', (el) => setPrefs({ [el.name]: el.checked }));
    ctx.on('click', '[data-perm]', async () => { await requestSystemPermission(); ctx.refresh(); });
    ctx.on('click', '[data-reset]', async () => { if (await confirmDialog('Se borran tus cambios locales y vuelven los datos de ejemplo.', { danger: true, confirm: 'Borrar cambios' })) {
        await resetLocal();
        toast('Datos restaurados', 'success');
    } });
    ctx.on('click', '[data-photo]', async () => {
        const f = await pickImageFile();
        if (!f)
            return;
        try {
            await setAvatar(await cropSquare(f));
            toast('Foto actualizada', 'success');
        }
        catch (x) {
            toast(x.message, 'error');
        }
    });
    ctx.on('click', '[data-photo-del]', async () => { await setAvatar(''); toast('Foto quitada', 'info'); });
};
export default profile;
