# Componentes compartidos

Todos devuelven **strings HTML** (sin framework) y se estilizan desde `src/styles/components.css`. Cambiás el componente → cambia en todas las pantallas que lo usan.

| Componente | Archivo | Se usa en |
|---|---|---|
| `matchCard` | `components/cards/match-card.js` | Inicio, Partidos, Equipo, Búsqueda |
| `teamCard` | `components/cards/team-card.js` | Equipos, Búsqueda |
| `playerCard` | `components/cards/player-card.js` | Jugadores, Equipo, Búsqueda |
| `newsCard` | `components/cards/news-card.js` | Inicio, Noticias, Búsqueda |
| `crest` | `components/cards/crest.js` | Escudo circular de equipo |
| Botones | `components/buttons/index.js` | Todas |
| Modales | `components/modals/index.js` → `openModal`, `confirmDialog`, `toast` | Admin, Perfil, Pronósticos |
| Inputs | `components/inputs/index.js` | Formularios (admin, login) |
| Cargas/estados | `components/loaders/index.js` → esqueletos, `emptyState`, error | Todas |
| Encabezado | `components/header/index.js` | Global |
| Navegación | `components/navigation/index.js` | Barra inferior (celular) / lateral (tablet, PC) |
| Menú lateral | `components/sidebar/index.js` | Global |
| Íconos | `components/icons.js` → `icon('nombre', tamaño)` | Todas |

## Convenciones
- Escapá siempre texto de usuario con `esc()` (`utils/dom.js`).
- No pongas colores fijos: usá variables (`var(--card)`, `var(--accent)`…).
- Usá `data-*` para enganchar eventos (`data-act="back"`), no clases de estilo.
- Estados: toda pantalla que carga datos debe contemplar vacío (`emptyState`), error y carga.
