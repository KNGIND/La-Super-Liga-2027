/* ROUTER por hash (#/ruta). Funciona igual en navegador, PWA, Capacitor y hosting estático.
   Carga cada pantalla bajo demanda y se encarga de transiciones y de recordar el scroll. */
import { NAV } from './config.js';
import { bus } from './events.js';
import { closeAllLayers, hasLayers } from './layers.js';
import { createScreen } from './screen.js';
import { FEATURES } from '../features/registry.js';
const routes = FEATURES.map((feature) => {
    const keys = [];
    const src = feature.path.replace(/:([a-z]+)/gi, (_, k) => (keys.push(k), '([^/]+)'));
    return { feature, keys, re: new RegExp(`^${src}$`) };
});
/** Registro en caliente: el Creador usa esto para sumar una sección nueva sin tocar el registro de archivos. */
export function registerFeature(feature) {
    if (routes.some((r) => r.feature.id === feature.id))
        return;
    FEATURES.push(feature);
    const keys = [];
    const src = feature.path.replace(/:([a-z]+)/gi, (_, k) => (keys.push(k), '([^/]+)'));
    routes.push({ feature, keys, re: new RegExp(`^${src}$`) });
}
export function unregisterFeature(id) {
    const i = routes.findIndex((r) => r.feature.id === id);
    if (i >= 0)
        routes.splice(i, 1);
    const j = FEATURES.findIndex((f) => f.id === id);
    if (j >= 0)
        FEATURES.splice(j, 1);
}
let tabIndexOf = () => -1;
/** navigation.js registra cómo saber a qué pestaña pertenece una ruta (para animar el sentido del cambio). */
export const setTabResolver = (fn) => { tabIndexOf = fn; };
let current = null;
let currentPath = '';
let token = 0;
const scrollMemo = new Map();
const visits = [];
export const currentRoute = () => currentPath;
export const pathOf = (hash = location.hash) => {
    const raw = hash.replace(/^#/, '') || '/';
    return raw.startsWith('/') ? raw : '/' + raw;
};
export function resolve(path) {
    const [p, q = ''] = path.split('?');
    for (const r of routes) {
        const m = r.re.exec(p);
        if (!m)
            continue;
        const params = {};
        r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
        return { feature: r.feature, params, query: new URLSearchParams(q) };
    }
    return null;
}
export function navigate(path, opts = {}) {
    const go = () => {
        if (opts.replace)
            location.replace('#' + path);
        else
            location.hash = path;
    };
    if (hasLayers())
        void closeAllLayers().then(go);
    else
        go();
}
export const back = () => {
    if (visits.length > 1)
        history.back();
    else
        navigate('/');
};
export function isDisabled(f) {
    return NAV.disabled.includes(f.id);
}
export function canOpen(f) {
    if (isDisabled(f))
        return false;
    // El panel de administración SIEMPRE se puede abrir: la propia pantalla decide qué mostrar
    // (contraseña local, "iniciá sesión", "acceso restringido" o solo lectura). El permiso real lo
    // hace cumplir el servidor (RLS), no esta función.
    return true;
}
async function render() {
    const path = pathOf();
    const view = document.getElementById('view');
    const my = ++token;
    // recordar scroll de la pantalla que dejamos
    if (currentPath)
        scrollMemo.set(currentPath, scrollY);
    const isBack = visits.length > 1 && visits[visits.length - 2] === path;
    if (isBack)
        visits.pop();
    else if (visits[visits.length - 1] !== path)
        visits.push(path);
    const hit = resolve(path);
    // sentido de la animación al cambiar de pestaña: 1 = viene desde la derecha, -1 = desde la izquierda
    const from = currentPath ? tabIndexOf(currentPath) : -1, to = tabIndexOf(path);
    const wasFull = !!resolve(currentPath || '/')?.feature.immersive, isFull = !!hit?.feature.immersive;
    // entrar a una pantalla completa: entra desde la derecha; salir: vuelve desde la izquierda
    view.dataset.dir = wasFull !== isFull && currentPath ? (isFull ? '1' : '-1') : from >= 0 && to >= 0 && from !== to ? String(Math.sign(to - from)) : '0';
    current?.destroy();
    current = null;
    currentPath = path;
    document.documentElement.dataset.route = hit?.feature.id ?? 'notfound';
    document.documentElement.dataset.immersive = hit?.feature.immersive ? '1' : '0';
    if (!hit || !canOpen(hit.feature)) {
        view.innerHTML = `<div class="empty"><h2>No encontramos esa pantalla</h2><p>La sección no existe o está desactivada.</p><a class="btn btn--primary" href="#/">Ir al inicio</a></div>`;
        bus.emit('route', path);
        return;
    }
    view.classList.remove('view--in');
    view.innerHTML = `<div class="skeleton-screen" aria-busy="true"><div class="sk sk--title"></div><div class="sk sk--card"></div><div class="sk sk--card"></div><div class="sk sk--card"></div></div>`;
    document.title = `${hit.feature.title} · La Súper Liga`;
    try {
        const mod = await hit.feature.load();
        if (my !== token)
            return; // el usuario ya se fue a otra pantalla
        view.innerHTML = '';
        const handle = createScreen(view, hit.params, hit.query, { navigate, back });
        current = handle;
        await mod.default(handle.ctx);
        if (my !== token)
            return;
        void view.offsetWidth;
        view.classList.add('view--in');
        scrollTo(0, isBack ? scrollMemo.get(path) ?? 0 : 0);
    }
    catch (e) {
        console.error('[router]', e);
        if (my !== token)
            return;
        view.innerHTML = `<div class="empty"><h2>No se pudo abrir la pantalla</h2><p>Revisá tu conexión e intentá de nuevo.</p><button class="btn btn--primary" onclick="location.reload()">Reintentar</button></div>`;
    }
    bus.emit('route', path);
}
let adoptedPath = null;
/** Cambio de pantalla "ya dibujada": el gesto de deslizar arma la pantalla vecina por adelantado, y acá
    la ADOPTAMOS tal cual (sin volver a dibujarla), así no hay parpadeo. `el` es su contenedor ya renderizado. */
export function adopt(path, handle, el) {
    const hit = resolve(path);
    if (!hit)
        return false;
    token++; // cancela cualquier dibujo en curso
    if (currentPath)
        scrollMemo.set(currentPath, scrollY);
    if (visits[visits.length - 1] !== path)
        visits.push(path);
    adoptedPath = path;
    location.hash = path;
    current?.destroy();
    current = handle;
    currentPath = path;
    document.documentElement.dataset.route = hit.feature.id;
    document.documentElement.dataset.immersive = hit.feature.immersive ? '1' : '0';
    document.title = `${hit.feature.title} · La Súper Liga`;
    const old = document.getElementById('view');
    el.id = 'view';
    el.className = 'view';
    el.removeAttribute('style');
    el.removeAttribute('aria-hidden');
    el.inert = false;
    el.tabIndex = -1;
    old.replaceWith(el);
    scrollTo(0, 0);
    bus.emit('route', path);
    return true;
}
export function startRouter() {
    addEventListener('hashchange', () => {
        if (adoptedPath && pathOf() === adoptedPath) { // lo provocó adopt(): ya está dibujado
            adoptedPath = null;
            return;
        }
        adoptedPath = null;
        void render();
    });
    if (!location.hash)
        history.replaceState(null, '', '#/');
    void render();
}
