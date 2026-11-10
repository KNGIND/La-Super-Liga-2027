/* PROYECTOS EN ARCHIVOS (opcional).
   Los proyectos del Creador (panel → Creador) se guardan en la base de datos y se activan solos.
   Si preferís que un proyecto viva como ARCHIVO dentro del código (versionado en GitHub), ponelo así:

     1) Creá la carpeta  src/mods/mi-proyecto/  con  index.js  (y opcional  style.css ).
        index.js exporta una función por defecto que recibe `api` (igual que en el Creador):
            export default function (api) { api.host.innerHTML = '<b>Hola</b>'; }
     2) Agregá UNA línea acá abajo.
     3) Agregá los archivos nuevos a PRECACHE en sw.js (para que funcionen sin conexión) y subí la versión.

   Desde el Creador podés tocar "Descargar archivos" en un proyecto y te baja justo estos archivos listos para copiar.
   mount: 'global' (flota sobre toda la app) | 'screen' (dentro de una pantalla; poné screen: 'home') | 'section' (pantalla nueva). */
export const FILE_MODS = [
    // { id: 'mi-proyecto', name: 'Mi proyecto', mount: 'global', css: 'mi-proyecto/style.css', load: () => import('./mi-proyecto/index.js') },
];
