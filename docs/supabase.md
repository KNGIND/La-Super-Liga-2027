# Supabase

La app usa el **mismo proyecto Supabase** de la versión anterior (URL y clave *anon* en `src/core/config.js`). Las tablas nuevas llevan prefijo `lsl2_` y **no tocan** las viejas (`lsl_state` queda como respaldo).

## Paso a paso (una sola vez)
1. Entrá a Supabase → tu proyecto → **SQL Editor**.
2. (Recomendado) Probá primero en un proyecto de pruebas.
3. Pegá y ejecutá `supabase/migrations/001_core.sql`. Crea tablas, políticas RLS, roles, funciones de puntos, triggers y ranking.
4. Pegá y ejecutá `supabase/migrations/002_import_legacy.sql`. Copia los datos de `lsl_state` (id=1) a las tablas `lsl2_*`. Es idempotente (no duplica). Revisá los conteos que muestra al final.
5. Abrí la app: la franja "Leyendo los datos de la app anterior" desaparece y pasa a modo **nube**.

> ⚠️ Ambos archivos fueron escritos a partir del ZIP y **no pudieron probarse contra una base real** en el entorno donde se construyó la app. Ejecutalos en un proyecto de pruebas antes que en el de producción y avisá cualquier error de SQL para corregirlo.

## Hacerte administrador
1. Registrate o iniciá sesión en la app con tu email (Perfil).
2. En el SQL Editor ejecutá (con tu email):
   ```sql
   update lsl2_profiles set role = 'admin' where email = 'tu@email.com';
   ```
   (Esto lo puede hacer el SQL Editor porque corre con privilegios del proyecto; desde la app nadie puede cambiar su propio rol.)
3. Cerrá sesión y volvé a entrar. El acceso "Administración" está siempre en el menú lateral y en Perfil (también tocando 7 veces el nombre de la liga); si no sos admin, la pantalla te explica cómo serlo.
4. Desde ahí, otros usuarios se promueven en Admin → Usuarios (función `lsl2_set_role`: solo admins, nunca sobre uno mismo).

## Migraciones (en orden, todas se pueden repetir sin romper nada)
1. `001_core.sql` — tablas, roles, RLS, puntos.
2. `002_import_legacy.sql` — copia los datos de la app anterior.
3. `003_zones.sql` — zonas de la tabla de posiciones.
4. `004_site_mods.sql` — cambios del Editor en vivo y proyectos del Creador (**solo admin escribe**, todos leen). Detalles en [editor-y-creador.md](editor-y-creador.md).
5. `005_auditoria_roles_realtime.sql` — registro de cambios (`lsl2_audit`), roles protegidos (nadie se sube de rol) y tiempo real. Guía completa en [conectar-supabase-firebase-github.md](conectar-supabase-firebase-github.md).

## Roles
| Rol | Puede |
|---|---|
| `user` | Ver todo, guardar pronósticos propios, editar su nombre y favoritos |
| `editor` | Lo anterior + cargar/editar partidos, resultados, noticias, etc. |
| `admin` | Todo, incluida la gestión de roles y el recálculo de puntos |

**La seguridad real está en las políticas RLS del servidor**, no en esconder botones. Un usuario que modifique el JavaScript del navegador sigue sin poder escribir donde no debe.

## Pronósticos y puntos
- 5 puntos resultado exacto · 3 mismo ganador/empate y misma diferencia · 2 solo ganador/empate · 0 el resto.
- Los puntos los calcula el **servidor** (función `lsl2_points` + triggers) cuando el partido pasa a "finalizado". El cliente solo los muestra.
- El servidor rechaza pronósticos de partidos que ya empezaron.
- Para recalcular todo: `select lsl2_settle_all();` (solo admin).
- Si cambiás reglas, hacelo en `lsl2_points` (SQL) y en `SCORING` (`config.js`, solo para el modo local).

## Qué falta / no se migró
El ZIP no incluía el SQL de la app vieja para sus tablas de ranking y funciones (`lsl_register`, `lsl_predict`, etc.) ni la definición de `lsl_state`. Por eso **no se migraron cuentas ni pronósticos viejos**: el ranking nuevo arranca desde cero. Si querés conservarlos, enviá ese SQL (o un export CSV de esas tablas) y se agrega una migración 003.

## Seguridad
- Solo la clave **anon** va en el cliente. Nunca uses `service_role` en `config.js` ni en ningún archivo de la app.
- Las columnas sensibles tienen permisos por columna (p. ej., en perfiles solo se puede escribir nombre y favoritos).
- El panel admin local (modo sin Supabase) tiene una contraseña **solo cosmética** (se ve en el código): sirve para evitar toques accidentales, no para seguridad. La seguridad real exige modo nube.
- El código de sala (`room`) de un partido es público: no lo uses como secreto.

## Verificado
Las migraciones `001_core.sql` y `002_import_legacy.sql` se probaron contra un PostgreSQL 16 real (con los permisos por defecto de Supabase): son repetibles, la importación da 8 equipos / 112 jugadores / 41 partidos / 5 noticias / 4 competiciones, y las políticas RLS cumplen: anónimo solo lee; un usuario no puede subirse el rol ni tocar puntos; solo admin cambia roles (nunca el propio) y recalcula; el editor edita partidos/noticias pero no equipos; los pronósticos se rechazan después del inicio del partido; al finalizar un partido un pronóstico exacto da 5 puntos.
**Sigue sin probarse** contra tu proyecto real de Supabase (registro/login por internet).
