# Desarrollo y pruebas

**No hay compilación.** No necesitás Node, npm ni terminal: el navegador ejecuta directamente los archivos `.js`, `.css` y `index.html`.

## Estructura de arranque
- `index.html` carga los CSS de `src/styles/` y el módulo `src/main.js`.
- Todos los `import` usan rutas relativas con extensión (`'../../core/config.js'`).
- Los datos de ejemplo están en `src/data/seed.js`.

## Publicar (Vercel, sin terminal)
1. Subí el contenido de esta carpeta a la **raíz** del repositorio de GitHub (el `index.html` tiene que quedar en la raíz, no dentro de otra carpeta).
2. En Vercel: tu proyecto → **Settings → Build and Development Settings** → **Framework Preset: Other**, y dejá **Build Command**, **Install Command** y **Output Directory** sin completar (o con "Override" apagado). El `vercel.json` ya lo indica.
3. Cada cambio que subas a GitHub se publica solo en un minuto.

## Probar en el celular
- **Acode**: abrí `index.html` y usá la vista previa. Si queda en negro, es porque algunos servidores de vista previa no sirven bien los módulos ES; en ese caso probá con la URL de Vercel.
- **Termux (opcional)**: `pkg install python` y, dentro de la carpeta, `python -m http.server 8080`; abrí `http://localhost:8080` en Chrome.
- No abras `index.html` con `file://`: los módulos ES no cargan desde archivos locales.

## Configuración de Supabase
En `src/core/config.js`, bloque `BACKEND`: `url` y `anonKey` (la clave **anon** es pública por diseño; la seguridad está en las políticas RLS). **Nunca** pongas la clave `service_role`. Con ambos valores en `''` la app funciona en **modo local** (datos de ejemplo + cambios guardados en el dispositivo).

## Modos de datos
| Modo | Cuándo | Qué permite |
|---|---|---|
| `cloud` | Hay Supabase y existen las tablas `lsl2_*` | Todo, con cuentas y roles |
| `legacy` | Hay Supabase pero aún no corriste las migraciones | Lectura de los datos de la app anterior (`lsl_state`) |
| `local` | Sin Supabase / sin conexión inicial | Datos de ejemplo + borrador local |

## Offline y actualizaciones
`sw.js` guarda los archivos para usar la app sin conexión. Usa "red primero": con internet ves siempre lo último. Si querés que los usuarios vean el aviso "Hay una versión nueva", cambiá `VERSION` en `sw.js`. Si agregás archivos nuevos, también podés sumarlos a la lista `PRECACHE` (si no, se guardan la primera vez que se usan).

## Regenerar los datos de ejemplo (opcional, requiere Node)
`node scripts/convert-legacy.mjs`

## Lista de pruebas manuales
- Abrir cada pestaña, el menú ☰, búsqueda, notificaciones y perfil.
- Botón "atrás" de Android con el menú abierto: debe cerrar el menú, no salir.
- Cambiar tema (claro/oscuro/sistema) y perfil (ECO/BALANCED/ULTRA) desde el menú.
- Deslizar horizontalmente entre pestañas; verificar que no interfiere con scroll vertical ni con carruseles.
- Modo avión: debe aparecer la franja "Sin conexión" y seguir viendo datos guardados.
- Pronósticos: guardar uno en un partido próximo (en los datos de ejemplo no hay partidos futuros: crealo desde Admin).
- Admin: crear/editar/borrar un partido, ver validaciones.
