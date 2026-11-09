# Guía "¿Dónde cambio X?"

| Quiero cambiar… | Archivo | Detalle |
|---|---|---|
| **Colores del tema oscuro** | `src/styles/design-tokens.css` | Sección 1: `--bg`, `--surface`, `--card`, `--border`, `--text`, `--accent`… |
| **Colores del tema claro** | `src/styles/themes.css` | Mismos nombres de variable, dentro de `:root[data-theme='light']` |
| **Color de acento (azul)** | `--accent`, `--accent-strong`, `--accent-soft` en ambos archivos | |
| **Degradés** (el diseño actual es plano: están desactivados) | `--grad`, `--grad-hero`, `--grad-card`, `--bg-glow` en ambos archivos: poné un `linear-gradient(...)` si querés volver a usarlos | |
| **Tipografía** | `design-tokens.css` | `--font` (Inter, se carga en `index.html`; si falla usa la del sistema), `--font-display`, tamaños `--fs-*`, pesos `--fw-*` |
| **Radios, espaciados, alturas** | `design-tokens.css` | `--r-*`, `--sp-*`, ancho de la barra lateral `--rail-w` |
| **Duración de animaciones** | `design-tokens.css` | `--dur-fast`, `--dur`, `--dur-slow` |
| **Efectos por perfil ECO/BALANCED/ULTRA** | `src/styles/animations.css` | Bloques `html[data-perf="eco"] (y balanced, ultra)` (blur, sombras, animaciones) |
| **Perfil predeterminado** | `src/core/config.js` → `DEFAULTS.perf` | `auto` elige según el dispositivo |
| **Nombre de la app / edición / lema** | `src/core/config.js` → `APP` | |
| **Pestañas de abajo y orden** | `src/core/config.js` → `NAV.tabs` | Máximo 5 recomendado |
| **Opciones del menú ☰** | `src/core/config.js` → `NAV.drawer` | |
| **Apagar una sección** | `src/core/config.js` → `NAV.disabled` | |
| **Íconos de las secciones** | `src/features/registry.js` (campo `icon`) y `src/components/icons.js` | Para un ícono nuevo, agregá su SVG a `icons.js` |
| **Reglas de puntos de pronósticos** | `config.js` → `SCORING` **y** `supabase/migrations/001_core.sql` (`lsl2_points`) | En modo nube manda el servidor |
| **Frecuencia de actualización** | `config.js` → `DATA` | |
| **Funciones experimentales** | `config.js` → `EXPERIMENTAL` | Navegación TV, toque secreto de admin |
| **Tarjeta de partido** | `src/components/cards/match-card.js` + estilos `.mc` en `components.css` | Cambia en Inicio, Partidos, Equipo, etc. |
| **Tarjeta de equipo / jugador / noticia** | `src/components/cards/*.js` | |
| **Escudos (círculos con siglas)** | `src/components/cards/crest.js` | |
| **Botones** | `src/components/buttons/index.js` + `.btn` en `components.css` | |
| **Modales, confirmaciones, avisos** | `src/components/modals/index.js` | `openModal`, `confirmDialog`, `toast` |
| **Formularios** | `src/components/inputs/index.js` | |
| **Encabezado** | `src/components/header/index.js` | |
| **Barra inferior / lateral** | `src/components/navigation/index.js` | |
| **Menú lateral** | `src/components/sidebar/index.js` | |
| **Diseño por tamaño de pantalla** | `src/styles/responsive.css` | Cortes en 600 / 840 / 1200 / 1600 px |
| **Textos de una pantalla** | `src/features/<pantalla>/index.js` | Los textos están en el propio archivo |
| **Datos de ejemplo** | `src/data/seed.js` (se regenera con `node scripts/convert-legacy.mjs`) | Solo se usan en modo local |
| **Conexión a Supabase** | `src/core/config.js` → `BACKEND` (url y anonKey) | Prefijo de tablas `lsl2_` |
| **Consultas a Supabase** | `src/services/data/` y `src/services/supabase/` | Nunca dentro de pantallas |
| **Columnas del CSV de importación** | `src/features/admin/schemas.js` (salen de los campos) y `csv.js` | Ver `docs/admin.md` |
| **Campos del panel admin** | `src/features/admin/schemas.js` | Una entidad = un bloque; agrega columnas y validaciones |
| **Ícono / nombre al instalar la PWA** | `public/manifest.webmanifest` y `public/icons/` | |
| **Caché offline** | `src/sw.js` | |
| **Animaciones Rive** | `public/rive/*.riv` + `src/animations/rive/index.js` | Solo se cargan en perfil ULTRA |

## Cambiar un color paso a paso
1. Abrí `src/styles/design-tokens.css`.
2. Buscá `--accent` y poné el color nuevo.
3. Para el tema claro, hacé lo mismo en `src/styles/themes.css`.
4. Guardá: se actualiza toda la app. No hay colores fijos en los demás CSS.

## Agregar un tema nuevo
Copiá el bloque `[data-theme='light']` de `themes.css`, cambiá el nombre y los valores, y agregá la opción en `src/components/sidebar/index.js` y en el tipo de `src/core/prefs.js`.


## Diseño de partidos y navegación (estilo Sofascore / OneFootball)
| Quiero cambiar… | Archivo |
|---|---|
| La fila compacta de partido (hora · equipos · marcador) | `src/components/cards/match-card.js` (`matchCard`) y `.mc--row` en `styles/components.css` |
| El agrupado por competición | `matchList` en `match-card.js`, clases `.mgroup` |
| La barra inferior (iconos + nombre, línea de color arriba) | `.dock__item` en `styles/layout.css`; qué pestañas hay: `core/navigation.js` / `features/registry.js` |
| Pestañas subrayadas vs. chips de filtro | `segmented(items, activo, attr, 'tabs' \| 'chips')` en `components/buttons/index.js` |

## Novedades de la v2027.3.0
| Quiero cambiar… | Dónde |
|---|---|
| **Zonas de la tabla** (campeón, 3.º, descenso…): crear, color, activar/desactivar, borrar | App → Administración → *Zonas de la tabla*. Las de fábrica están en `defaultZones()` de `services/data/schema.js`. En la nube hace falta correr `supabase/migrations/003_zones.sql` (si no, se usan las de fábrica y no se pueden guardar cambios) |
| **Pantalla de bienvenida** (nombre + foto, primer inicio) | `src/components/welcome/index.js`; el estilo está en `styles/screens.css` (sección "bienvenida") |
| **Foto de perfil** | Se guarda en el dispositivo (`services/user.js`, `setAvatar`); se cambia desde Perfil |
| **Menú del panel de admin** (módulos y grupos) | `GROUPS` y `MODS` al principio de `features/admin/index.js` |
| **Deslizar entre pestañas** (umbral, velocidad, duración) | `installSwipe` en `core/navigation.js`: `W * 0.33` es la distancia para completar, `0.45` la velocidad del "flick", `320` ms la animación |
| **Liquid glass (ULTRA)** | `styles/liquid-glass.css`: `--lg-blur` (desenfoque), `--lg-fill` (transparencia), `--lg-spec` (brillo del borde). Solo actúa con el perfil ULTRA |

Notas: la foto de perfil queda en el dispositivo (todavía no se sube a Supabase Storage). El nombre de la bienvenida es local; la cuenta en la nube se crea desde Perfil.

## Correcciones de la v2027.3.1 (navegación)
- **Secciones independientes**: `index.html`/`app.js` ahora envuelve el aviso (`#banner`) y la pantalla (`#view`) en `#pager`. Al deslizar, se mueven juntos como una sola pieza y la sección vecina trae su propio aviso (`.peek`).
- **Sin parpadeo**: al completar el deslizamiento, `router.adopt()` reutiliza la pantalla ya dibujada en vez de volver a armarla. Además `renderChrome()` (en `src/core/app.js`) solo reescribe encabezado/barra si cambiaron.
- **Barra inferior fija**: `html { overflow-x: clip }` y `.pager { overflow-x: clip }` (en `src/styles/layout.css`) impiden que las animaciones ensanchen la página y desplacen la barra.
- **Pantalla completa (detalle de partido / noticia)**: encabezado propio con solo Volver · título · Compartir (`src/components/header/index.js`), sin buscador/avisos/perfil, sin barra inferior, sin aviso y sin gesto de cambio de pestaña. Entra deslizando desde la derecha.

## Novedades de la v2027.4.0 · Editor en vivo y Creador
- **Admin → Personalizar → Editor en vivo**: mantené apretado cualquier elemento para moverlo, rotarlo, cambiarle tamaño/color/texto/función, y cambiá colores globales y el orden de las secciones.
- **Admin → Personalizar → Creador**: pegá código (JS/CSS/HTML) y se suma a la app como proyecto nuevo o reemplaza uno existente, sin tocar archivos.
- Si algo se rompe: abrí la app con `?safe=1`.
- Guía completa: [editor-y-creador.md](editor-y-creador.md). Requiere correr `supabase/migrations/004_site_mods.sql` para que los cambios se guarden en la nube.
