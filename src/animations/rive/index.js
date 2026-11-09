/* RIVE (animaciones interactivas) — solo en perfil ULTRA y solo si existe el archivo .riv.
   - Usa @rive-app/canvas-lite desde el CDN de jsDelivr (liviana, ~170 KB; sin archivo .riv no se descarga nada). Se descarga SOLO cuando hace falta (import dinámico).
   - Archivos: poné tus animaciones en public/rive/ (por ejemplo public/rive/gol.riv).
     Este proyecto NO trae archivos .riv: hay que crearlos en https://rive.app y exportarlos.
   Uso desde una pantalla:  mountRive(el, 'gol.riv', { stateMachine: 'State Machine 1' })  */
import { EXPERIMENTAL } from '../../core/config.js';
import { effectivePerf, reducedMotion } from '../../core/prefs.js';
export async function mountRive(host, file, o = {}) {
    if (!EXPERIMENTAL.rive || effectivePerf() !== 'ultra' || reducedMotion())
        return null;
    const src = `./rive/${file}`;
    try {
        const head = await fetch(src, { method: 'HEAD' });
        if (!head.ok)
            return null; // no hay archivo: no mostramos nada
        const mod = (await import('https://cdn.jsdelivr.net/npm/@rive-app/canvas-lite@2.21.0/+esm'));
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 440;
        host.appendChild(canvas);
        const r = new mod.Rive({ src, canvas, autoplay: o.autoplay ?? true, stateMachines: o.stateMachine, onLoadError: () => canvas.remove() });
        return () => { r.cleanup(); canvas.remove(); };
    }
    catch {
        return null; // paquete no instalado o error de carga: la app sigue igual
    }
}
