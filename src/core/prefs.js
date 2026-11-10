/* Preferencias del dispositivo: tema, perfil de rendimiento, notificaciones.
   Se guardan en localStorage (síncrono: el tema tiene que aplicarse antes de pintar). */
import { DEFAULTS, STORAGE_KEYS } from './config.js';
import { bus } from './events.js';
import { ls } from '../services/storage/kv.js';
let prefs = { ...DEFAULTS, lastSeenNotifications: '', ...ls.get(STORAGE_KEYS.prefs, {}) };
export const getPrefs = () => prefs;
export function setPrefs(patch) {
    prefs = { ...prefs, ...patch };
    ls.set(STORAGE_KEYS.prefs, prefs);
    applyPrefs();
    bus.emit('prefs', undefined);
}
/** Elige un perfil según el hardware. Conservador: ante la duda, BALANCED o ECO. */
export function detectPerf() {
    const nav = navigator;
    const mem = nav.deviceMemory ?? 4;
    const cores = navigator.hardwareConcurrency ?? 4;
    const saveData = navigator.connection?.saveData;
    if (saveData || mem <= 2 || cores <= 4)
        return 'eco';
    if (mem >= 6 && cores >= 8)
        return 'ultra';
    return 'balanced';
}
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export function effectivePerf() {
    const p = prefs.perf === 'auto' ? detectPerf() : prefs.perf;
    return reducedMotion() && p === 'ultra' ? 'balanced' : p;
}
export function effectiveTheme() {
    if (prefs.theme === 'system')
        return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    return prefs.theme;
}
/** Pone data-theme y data-perf en <html>. Los estilos hacen el resto. */
export function applyPrefs() {
    const root = document.documentElement;
    const theme = effectiveTheme();
    root.dataset.theme = theme;
    root.dataset.perf = effectivePerf();
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta)
        meta.setAttribute('content', theme === 'dark' ? '#0D0E12' : '#EEF0F4');
}
matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => prefs.theme === 'system' && applyPrefs());
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', applyPrefs);
