# Panel de administración

Se abre desde el menú ☰ → *Panel de administración* (o tocando 7 veces el nombre de la liga, o yendo a `#/admin`).

## Quién puede entrar
| Modo | Acceso |
|---|---|
| **Nube** (Supabase) | Solo cuentas con rol `editor` o `admin`. Los permisos los hace cumplir el servidor (RLS), no solo esta pantalla. |
| **Local** (sin Supabase) | Contraseña de este dispositivo (cosmética: evita toques accidentales, **no** es seguridad). Los cambios quedan como borrador en el celular. |
| **Solo lectura** (datos de la app vieja) | Se puede mirar, no editar. Corré las migraciones para editar (`docs/supabase.md`). |

## Pestañas
Partidos · Equipos · Jugadores · Noticias y comunicados · Transmisiones · Sanciones · Competiciones · Temporadas · Avisos · La liga · Pronósticos · Usuarios y roles (solo nube, solo admin) · Respaldo.

- **Buscador:** cada lista tiene una caja de búsqueda (sin tildes ni mayúsculas). Filtra al instante y muestra "N de M".
- **Partidos en vivo:** botones rápidos "+1 local", "+1 visitante" y "Finalizar".
- **Eventos y alineaciones** (dentro del formulario del partido), un renglón por dato:
  - Evento: `minuto | gol/penal/autogol/amarilla/roja | local/visitante | jugador`
  - Alineación: `número | nombre | posición` (el primero es el arquero)
- **Pronósticos:** recalcular puntos y ver el **ranking de usuarios** (nube).
- **Usuarios y roles:** cambiar el rol de cada usuario (no el propio). Incluye un cuadro con lo que puede hacer cada rol.
- **Temporadas:** al marcar una como actual, las demás se desmarcan solas. Cada partido pertenece a una temporada, y Tabla, Partidos y Copas muestran un selector cuando hay más de una. Una temporada con partidos no se puede borrar.

## Importar y exportar
- **Respaldo completo (JSON):** pestaña *Respaldo* → Exportar / Importar (reemplaza todo).
- **CSV por pestaña:** botones **CSV** (exporta la lista) e **Importar CSV** (crea y actualiza varios registros de una vez; ideal para cargar plantel completo).

### Cómo armar un CSV
1. Exportá la pestaña para ver las columnas, o copiá la cabecera de esta tabla.
2. En una planilla (Excel / Google Sheets) completá las filas y guardá como **CSV** (separador coma o punto y coma).
3. En el panel: *Importar CSV*. Verás un resumen (cuántos se crean/actualizan y los problemas de cada fila) antes de confirmar. Las filas con error se saltean.

Reglas:
- En columnas de lista (equipo, competición, posición, estado…) escribí el **nombre** (ej. `Halcones FC`, `Delantero`) o el id.
- Fechas: `20/09/2026 21:30` o formato ISO. Sí/no: `sí`, `no`, `1`, `x`.
- Si la columna `id` coincide con un registro existente, **se actualiza**; si no hay `id`, se crea uno nuevo.
- Las columnas que no incluyas no se tocan en los registros que se actualizan.
- Eventos y alineaciones de partidos **no** van en el CSV.

| Pestaña | Roles | Columnas |
|---|---|---|
| Partidos | admin, editor | `id`, `seasonId`, `competitionId`, `round`, `leg`, `firstLeg`, `homeId`, `awayId`, `kickoff`, `status`, `minute`, `homeScore`, `awayScore`, `pens`, `stadium`, `channelId`, `room`, `homeFormation`, `awayFormation`, `notes` |
| Equipos | admin | `id`, `name`, `short`, `color`, `color2`, `logo`, `adjust` |
| Jugadores | admin | `id`, `teamId`, `number`, `name`, `pos` |
| Noticias y comunicados | admin, editor | `id`, `kind`, `title`, `category`, `summary`, `body`, `image`, `publishedAt`, `pinned` |
| Transmisiones | admin, editor | `id`, `name`, `logo`, `url` |
| Sanciones | admin, editor | `id`, `player`, `teamId`, `type`, `duration`, `notes` |
| Competiciones | admin | `id`, `name`, `kind` |
| Temporadas | admin | `id`, `name`, `status`, `current` |
| Avisos | admin, editor | `id`, `kind`, `title`, `body`, `link` |

## Agregar o cambiar un campo del panel
Todo sale de `src/features/admin/schemas.js` (una entidad = un bloque con `fields`, `blank`, `summary`, `validate`). El formulario, el buscador y el CSV se actualizan solos. La lógica de CSV está en `src/features/admin/csv.js`.

## Menú del panel y zonas de la tabla (v2027.3.0)
- En celular, Administración abre primero un menú de módulos agrupados (Competición, Equipos, Contenido, Comunidad, Sistema); tocás uno y se abre, con el botón **Panel** para volver. En pantallas grandes el menú queda a la izquierda.
- **Zonas de la tabla**: cada zona tiene nombre (leyenda), posición *desde/hasta*, "contar desde el último" (para descenso), color, ícono (trofeo/medalla/estrella) y un interruptor para activarla o desactivarla. Se pueden crear, editar y borrar todas las que quieras. Por defecto: 1.º Campeón (dorado) y 3.º Tercer puesto (bronce).
