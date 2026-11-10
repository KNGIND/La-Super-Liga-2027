/* BIENVENIDA (primer inicio): nombre de usuario y, si quiere, foto de perfil.
   Se muestra una sola vez (queda guardado en este dispositivo). La foto se puede agregar o cambiar después desde Perfil.
   No es una cuenta en la nube: para cuenta, ranking y sincronización está el registro en Perfil. */
import { esc } from '../../utils/dom.js';
import { cropSquare, pickImageFile } from '../../utils/image.js';
import { finishWelcome } from '../../services/user.js';
import { icon } from '../icons.js';
import { toast } from '../modals/index.js';
import { bus } from '../../core/events.js';
const NAME_RE = /^[\p{L}\p{N} ._-]{3,20}$/u;
export function showWelcome() {
    return new Promise((resolve) => {
        const el = document.createElement('div');
        el.className = 'welcome';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-label', 'Bienvenida');
        document.body.appendChild(el);
        document.documentElement.classList.add('has-welcome');
        let name = '';
        let photo = '';
        const stepName = () => {
            el.innerHTML = `<form class="welcome__card" data-name novalidate>
        <span class="welcome__logo">${icon('zap', 30)}</span>
        <h1>Bienvenido a La Súper Liga</h1>
        <p>Elegí tu nombre de usuario. Es el que van a ver en pronósticos y ranking.</p>
        <label class="field"><span class="field__label">Nombre de usuario</span>
          <input class="input" name="name" value="${esc(name)}" maxlength="20" autocomplete="nickname" autocapitalize="words" placeholder="Ej.: Tiziano10" required></label>
        <p class="form-error" data-err hidden></p>
        <button class="btn btn--primary btn--block" type="submit">Continuar</button>
        <small class="welcome__hint">Entre 3 y 20 caracteres: letras, números, espacios, punto, guion.</small>
      </form>`;
            el.querySelector('input')?.focus();
        };
        const stepPhoto = () => {
            const initial = esc((name.trim()[0] ?? '?').toUpperCase());
            el.innerHTML = `<div class="welcome__card">
        <button class="welcome__avatar" data-pick aria-label="Elegir foto">${photo ? `<img src="${esc(photo)}" alt="Tu foto de perfil">` : `<span>${initial}</span>`}<i>${icon('image', 18)}</i></button>
        <h1>${photo ? '¡Qué buena foto!' : `Hola, ${esc(name)}`}</h1>
        <p>${photo ? 'Así te van a ver los demás.' : '¿Querés poner una foto de perfil ahora?'}</p>
        ${photo
                ? `<button class="btn btn--primary btn--block" data-done>Listo, entrar</button><button class="btn btn--ghost btn--block" data-pick>Elegir otra</button>`
                : `<button class="btn btn--primary btn--block" data-pick>${icon('image', 18)} Sí, elegir foto</button><button class="btn btn--ghost btn--block" data-done>Ahora no</button>`}
        <small class="welcome__hint">Podés ${photo ? 'cambiarla' : 'agregarla'} cuando quieras desde tu perfil.</small>
      </div>`;
        };
        const close = async () => {
            await finishWelcome(name, photo);
            el.classList.add('is-out');
            document.documentElement.classList.remove('has-welcome');
            setTimeout(() => el.remove(), 280);
            bus.emit('session', undefined);
            resolve();
        };
        el.addEventListener('submit', (e) => {
            e.preventDefault();
            const v = String(new FormData(e.target).get('name') ?? '').trim().replace(/\s+/g, ' ');
            const err = el.querySelector('[data-err]');
            if (!NAME_RE.test(v)) {
                err.hidden = false;
                err.textContent = 'Usá entre 3 y 20 caracteres (letras, números, espacios, punto o guion).';
                return;
            }
            name = v;
            stepPhoto();
        });
        el.addEventListener('click', async (e) => {
            const t = e.target;
            if (t.closest('[data-done]'))
                return void close();
            if (t.closest('[data-pick]')) {
                const f = await pickImageFile();
                if (!f)
                    return;
                try {
                    photo = await cropSquare(f);
                    stepPhoto();
                }
                catch (x) {
                    toast(x.message, 'error');
                }
            }
        });
        stepName();
    });
}
