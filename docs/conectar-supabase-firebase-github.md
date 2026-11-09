# Conectar Supabase, Firebase y GitHub (paso a paso)

Pensada para hacerla desde el celular. Orden recomendado: **1) Supabase → 2) primer admin → 3) GitHub → 4) APK → 5) Firebase (push)**.

---

## 1. Supabase

### 1.1 Qué ya está configurado
- La app apunta al proyecto `https://jzeyankmecxazxmycvdz.supabase.co` (en `src/core/config.js`, bloque `BACKEND`).
- La clave que está en la app es la **anon / publishable**: es pública por diseño. La seguridad la dan las políticas RLS.
- **Nunca** pegues en el código, en GitHub ni en la app la clave **service_role** (ni la contraseña de la base). Si alguna vez se filtró, rotala en Settings → API.

### 1.2 Correr las migraciones (SQL Editor)
Supabase → **SQL Editor** → *New query* → pegá el archivo → **Run**.

| Archivo | Qué hace | Si ya lo corriste |
|---|---|---|
| `001_core.sql` | Tablas, roles, RLS, puntos | No lo vuelvas a correr si ya funciona; si dudás, es seguro repetirlo |
| `002_import_legacy.sql` | Importa datos de la app anterior | Igual |
| `003_zones.sql` | Zonas de la tabla (campeón, descenso…) | Igual |
| `004_site_mods.sql` | Editor en vivo y proyectos del Creador | Igual |
| **`005_auditoria_roles_realtime.sql`** | **Registro de cambios, roles protegidos y tiempo real** | **Correlo ahora** |

Todas se pueden repetir sin romper nada. Están en `supabase/migrations/`.

### 1.3 Configuración de Auth (botones, no SQL)
Supabase → **Authentication**:
- **URL Configuration** → *Site URL*: `https://la-super-liga-2027-02.vercel.app`
  En *Redirect URLs* agregá la misma URL y `https://la-super-liga-2027-02.vercel.app/**`.
- **Providers → Email**: dejá activado. Si querés que el registro entre directo sin confirmar el correo, desactivá *Confirm email* (más cómodo; menos seguro).
- Para el APK (Capacitor) en la lista de *Redirect URLs* agregá `com.lasuperliga.app://callback` si después usás confirmación por enlace.

### 1.4 Cómo ser admin (solo el primero por SQL; después desde la app)
1. Registrate **en la app** con tu correo (se crea tu perfil con rol `user`).
2. En el **SQL Editor** corré (cambiá el correo):
```sql
update lsl2_profiles set role = 'admin' where email = 'tu-correo@ejemplo.com';
```
3. Cerrá sesión y volvé a entrar en la app. Ya ves el panel.

**Para dar admin a otras personas (desde la app):** Admin → **Usuarios** → elegí el rol (`user`, `editor` o `admin`). Por defecto **todos son `user`**; nadie puede subirse de rol solo: la base lo impide (migración 005). Siempre queda al menos un admin.

Roles:
| Rol | Puede |
|---|---|
| `user` | Ver todo, pronosticar, editar su perfil y favoritos |
| `editor` | Además cargar partidos, resultados, noticias, etc. |
| `admin` | Todo, incluidos roles, editor en vivo y creador de proyectos |

### 1.5 Registro de cambios (quién hizo qué)
- Todo lo que se crea, edita o borra en partidos, noticias, equipos, jugadores, competiciones, temporadas, liga, canales, sanciones, avisos y zonas queda en la tabla **`lsl2_audit`** (quién, cuándo, qué, antes y después).
- Los cambios de **rol** también quedan registrados.
- Solo los admins pueden leerla. Nadie la puede editar a mano.
- Para ver las últimas 50 acciones (SQL Editor o desde la API):
```sql
select at, actor_email, action, table_name, summary from lsl2_audit order by at desc limit 50;
```
- Para limpiar lo viejo (más de 180 días), solo admin: `select lsl2_audit_prune(180);`

### 1.6 Tiempo real
La migración 005 agrega a Supabase Realtime las tablas de **partidos, noticias, equipos, jugadores y el registro de cambios**. Esto significa que el panel (y la app abierta) pueden recibir los cambios al instante, sin recargar.
> **Pendiente en el código:** hoy la app se actualiza al volver a abrirla o cada cierto tiempo. El cliente de Realtime (la conexión por WebSocket) y la pestaña **Registro de cambios** dentro del panel se agregan en la próxima versión, una vez que confirmes que la migración 005 corrió bien.

### 1.7 Verificar que todo funciona
- SQL Editor: `select * from lsl2_profiles;` → tu fila debe tener `role = 'admin'`.
- SQL Editor: `select count(*) from lsl2_audit;` → debe funcionar sin error (puede dar 0).
- Probá en la app: crear un partido como admin → debe aparecer una fila nueva en `lsl2_audit`.
- Probá con una cuenta común: intentar cambiar su propio rol desde la consola del navegador **debe fallar** con "Solo un admin puede cambiar roles".

---

## 2. GitHub (subir el proyecto)

### 2.1 Subir los archivos desde el celular
Tu repo: `KNGIND/La-super-liga-2027-02`.
1. Descomprimí el ZIP (`LA-SUPER-LIGA-2027-JS.zip`). Vas a tener una carpeta `LA-SUPER-LIGA-2027-JS`.
2. Entrá a `github.com/KNGIND/La-super-liga-2027-02` → **Add file → Upload files**.
3. Subí **el contenido** de la carpeta (`index.html`, `src/`, `icons/`, `supabase/`, `docs/`, `.github/`, etc.), **no la carpeta en sí**.
   - Ojo: en Android, el explorador de archivos puede no mostrar carpetas que empiezan con punto (`.github`). Si pasa, usá **Acode** o el navegador de archivos con “mostrar ocultos”, o subí `.github/workflows/android-build.yml` en su carpeta desde la web: *Add file → Create new file* y escribí `.github/workflows/android-build.yml` como nombre.
4. Escribí un mensaje de commit (ej.: “v2027.4.0”) → **Commit changes**.
5. **Reemplazá** los archivos viejos: si el repo ya tenía archivos con el mismo nombre (`index.html`, `sw.js`…), GitHub los sobrescribe. Los que sobran de la versión vieja (`css/`, `js/`, `data/` de la app anterior) los podés borrar desde la web (abrí el archivo → ⋯ → *Delete file*), si ya no los usás.

### 2.2 Verificar la publicación
- Vercel se actualiza solo al detectar el commit (Vercel → Deployments). Probá la URL y recargá con el service worker nuevo (la app avisa “Hay una versión nueva”).

### 2.3 Secretos del APK (ya los tenés; solo verificá)
En **Settings → Secrets and variables → Actions** deben existir:
`ANDROID_KEYSTORE_PART_1` … `ANDROID_KEYSTORE_PART_8`, `ANDROID_KEYSTORE_PASSWORD` y opcional `ANDROID_KEY_PASSWORD`.
El `release.jks` **nunca** se sube al repo: queda en esos secretos.

---

## 3. APK (Capacitor en la nube)
El workflow `.github/workflows/android-build.yml` ya está adaptado a esta versión:
- Empaqueta **toda la app** (`index.html`, `src/`, `icons/`, `sw.js`, `manifest`), no las carpetas viejas `css/ js/ data/`.
- Se arma en una carpeta temporal (no ensucia el repo).
- Se ejecuta **a mano**: pestaña **Actions → Build Android APK → Run workflow**. También corre solo cuando cambia `src/`, `index.html` o los íconos en `main`.
- El APK aparece en la ejecución, en **Artifacts** (`SuperLiga-APK-N`).
- `versionName` = `2027.4.N` (N = número de ejecución). Cada build tiene un número mayor, así Android lo instala por encima del anterior.

> **Importante:** el `appId` es `com.lasuperliga.app`. Tiene que ser **el mismo** del APK que ya tenés instalado, si querés actualizarlo sin desinstalar. Si el anterior tenía otro id, avisame y lo cambiamos.

Sin Android Studio en tu celular: todo se compila en GitHub.

---

## 4. Firebase (notificaciones push con la app cerrada)

Hoy la app muestra avisos **solo con la app abierta** o recién usada. Para push real hace falta Firebase Cloud Messaging (FCM). Esto requiere 3 cosas que tenés que crear vos (no las puedo inventar):

### 4.1 Crear el proyecto
1. `console.firebase.google.com` → **Agregar proyecto** → nombre `la-super-liga`.
2. **Configuración del proyecto → Tus apps → Web (`</>`)** → registrá la app → copiá el objeto `firebaseConfig`. Esos valores **son públicos** (van en el cliente), no son secretos.
3. **Cloud Messaging → Certificados web (Push)** → *Generar par de claves* → copiá la **clave VAPID pública**.

Me pasás: el `firebaseConfig` (apiKey, projectId, messagingSenderId, appId) y la clave VAPID pública. Con eso armo la integración web.

### 4.2 Clave de servicio (SECRETA)
- **Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada** → se descarga un `.json`.
- **Ese archivo no va al repo ni al chat.** Se guarda como secreto de Supabase para la función que envía los avisos:
```
supabase secrets set FIREBASE_SERVICE_ACCOUNT='<contenido del json en una sola línea>'
```
(o desde Supabase → Edge Functions → Secrets, si no tenés la CLI).

### 4.3 Qué falta en el código (próxima etapa)
- `firebase-messaging-sw.js` y el registro del token del dispositivo en una tabla `lsl2_push_tokens` (con RLS: cada usuario solo escribe su token).
- Una **Edge Function** de Supabase que envía el aviso cuando se carga un partido, un gol o una noticia. Lee la clave de servicio de los secretos.
- Para el APK: `@capacitor/push-notifications` y el archivo `google-services.json`. Ese archivo se pone como secreto de GitHub (`GOOGLE_SERVICES_JSON`) y el workflow lo copia al build; no se sube al repo.

---

## 5. Checklist rápida
- [ ] Migraciones 001–005 corridas en Supabase
- [ ] Site URL y Redirect URLs configuradas
- [ ] Mi usuario con `role = 'admin'`
- [ ] Carpeta subida a GitHub (sin `release.jks`)
- [ ] Vercel desplegado y la URL responde
- [ ] Workflow de APK ejecutado con éxito (Actions → Run workflow)
- [ ] Firebase: `firebaseConfig` + clave VAPID enviados; clave de servicio solo en secretos
