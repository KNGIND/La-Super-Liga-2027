/* Contrato de una pantalla (ScreenFn) y el contexto que recibe (ScreenCtx).

   Una pantalla es una función así:

     export default function mi(ctx: ScreenCtx) {
       ctx.view(() => `<h1>Hola</h1>`);                 // dibuja (y se redibuja cuando cambian los datos)
       ctx.on('click', '[data-go]', (el) => ctx.navigate('/matches'));   // eventos delegados
     }

   Todo lo que registres con ctx.on / ctx.listen se limpia solo al salir de la pantalla. */
import { bus } from './events.js';
import { delegate } from '../utils/dom.js';
export function createScreen(el, params, query, nav) {
    const cleanups = [];
    let renderFn = null;
    let opts = {};
    let raf = 0;
    let alive = true;
    const paint = () => {
        if (!alive || !renderFn)
            return;
        const active = document.activeElement;
        const keepFocus = active && el.contains(active) && active.id ? active.id : '';
        // Al redibujar se pierde el scroll de las listas horizontales (pestañas, fechas, carruseles):
        // lo guardamos y lo devolvemos, y nos aseguramos de que el elemento activo quede visible.
        const strips = [...el.querySelectorAll('.seg, .datestrip, .carousel, .adm-chips')].map((n) => n.scrollLeft);
        el.innerHTML = renderFn();
        el.querySelectorAll('.seg, .datestrip, .carousel, .adm-chips').forEach((n, i) => {
            if (strips[i] != null)
                n.scrollLeft = strips[i];
            const on = n.querySelector('.is-on');
            if (on && (on.offsetLeft < n.scrollLeft || on.offsetLeft + on.offsetWidth > n.scrollLeft + n.clientWidth))
                n.scrollLeft = on.offsetLeft - (n.clientWidth - on.offsetWidth) / 2;
        });
        if (keepFocus)
            document.getElementById(keepFocus)?.focus({ preventScroll: true });
        opts.after?.(el);
    };
    const schedule = () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(paint);
    };
    const ctx = {
        el, params, query,
        view(render, o = {}) {
            renderFn = render;
            opts = o;
            paint();
            for (const ev of o.on ?? ['data'])
                cleanups.push(bus.on(ev, schedule));
        },
        refresh: paint,
        on(type, selector, fn) {
            cleanups.push(delegate(el, type, selector, fn));
        },
        listen(fn) {
            cleanups.push(fn);
        },
        navigate: nav.navigate,
        back: nav.back,
    };
    return {
        ctx,
        destroy() {
            alive = false;
            cancelAnimationFrame(raf);
            cleanups.splice(0).forEach((f) => f());
        },
    };
}
