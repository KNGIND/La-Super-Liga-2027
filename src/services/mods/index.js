/* PERSONALIZACIONES · punto de entrada.
   boot() llama a initMods() ANTES de dibujar la primera pantalla (así los cambios del Editor no "parpadean")
   y a startMods() cuando la app ya está lista (arranca los proyectos del Creador). */
import { bus } from '../../core/events.js';
import { getMods, loadMods, refreshMods } from './store.js';
import { applyOverrides, installOverrides, isEditingNow } from './overrides.js';
import { installRuntime, recoverFromCrash, syncProjects } from './runtime.js';
import { initSafeMode, safeMode } from './safe.js';

export { safeMode, safeReason } from './safe.js';

export function applyNow() {
    const s = getMods();
    if (!safeMode() && !isEditingNow()) applyOverrides(s.overrides);
    void syncProjects(s.projects);
}
export async function initMods() {
    initSafeMode();
    await loadMods();
    recoverFromCrash(getMods().projects);
    installOverrides();
    installRuntime();
    if (!safeMode()) applyOverrides(getMods().overrides);
}
export function startMods() {
    void syncProjects(getMods().projects);
    bus.on('mods', applyNow);
    void refreshMods(); // si trae algo distinto, emite 'mods' y se vuelve a aplicar
    document.addEventListener('visibilitychange', () => !document.hidden && void refreshMods());
}
