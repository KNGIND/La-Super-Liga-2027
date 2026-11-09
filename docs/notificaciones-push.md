# Notificaciones

## Qué hay hoy (funciona)
- **Avisos dentro de la app** (pantalla Notificaciones + globo rojo en la campana). La app compara los datos nuevos con los últimos vistos y genera avisos por: partido que empieza, gol/cambio de resultado, partido finalizado, noticia nueva, comunicado.
- Se detectan mientras la app está abierta (revisión cada 20 s con partido en vivo, 90 s en reposo) y al volver a abrirla.
- **Avisos del sistema** (opcional): si el usuario concede el permiso, se muestran como notificación del navegador a través del service worker. Solo con la app abierta o en segundo plano reciente.
- Preferencias por tipo (partidos, resultados, noticias) en Perfil / Notificaciones.
- Los administradores pueden crear avisos manuales (Admin → Notificaciones).

## Qué NO hay
**Push real con la app cerrada.** Requiere un servidor que envíe los mensajes. No se implementó porque necesita credenciales que no existen en el proyecto.

## Cómo agregarlo después
1. **OneSignal** (más simple): crear cuenta, agregar el SDK web en `index.html` y en el service worker (`src/sw.js`), y disparar envíos desde el panel de OneSignal o su API.
2. **Firebase Cloud Messaging**: crear proyecto, `firebase-messaging-sw.js`, guardar el token del dispositivo en una tabla `lsl2_push_tokens` y enviar desde una Edge Function de Supabase.
3. Para el APK, usar `@capacitor/push-notifications` (FCM).

Las claves privadas (server key, REST API key) **nunca** deben ir en el cliente: usá una Edge Function de Supabase.
