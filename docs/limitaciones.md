# Estado real, pendientes y límites

## Verificado
- Las pantallas se escribieron en TypeScript estricto (sin errores) y luego se convirtieron a JavaScript; el código JS es el que se probó.
- Recorrido automatizado con Chromium (Playwright) sobre el proyecto servido como archivos estáticos (sin compilar): todas las rutas sin errores de consola en celular oscuro/claro y escritorio; menú + botón atrás; cambio de tema y perfil; deslizar entre pestañas; panel admin local (crear/validar/editar partidos, goles rápidos); pronóstico exacto = +5 puntos y persistencia al recargar; búsqueda sin acentos; alineaciones; banner offline.

## NO verificado (no se pudo en el entorno de construcción)
- El comportamiento exacto en el preview de Acode (depende de su servidor interno; ver `development.md`).
- El service worker (offline) en un dispositivo real: se probó la lógica, no una instalación PWA en Android.
- Migraciones SQL contra una base real y el modo `cloud` (registro, login, roles, ranking).
- Rive: el código está listo pero **no hay archivos `.riv`** (hay que crearlos en rive.app y ponerlos en `public/rive/`).
- Empaquetado APK.

## Pendiente / decisiones
- Push con la app cerrada (ver `notificaciones-push.md`).
- Cuentas y pronósticos viejos no migrados (falta su SQL).
- Datos de ejemplo: los partidos de `seed.json` están en el pasado; para probar pronósticos creá un partido futuro en Admin.
- Importación/exportación: JSON del dataset completo y CSV por pestaña (no incluye eventos ni alineaciones de partidos). Probado en modo local; el modo nube sube fila por fila (puede tardar con archivos grandes).
- Con un archivo CSV hecho a mano conviene probar primero con pocas filas: la vista previa muestra los errores antes de guardar.
- Transmisiones: se gestionan como "canales" por partido; no hay reproductor integrado.

## Televisores
- Con pantallas ≥1600 px se activa la navegación con flechas (foco espacial), foco visible y textos más grandes.
- Los navegadores de Smart TV (Tizen, webOS, Android TV) varían mucho: algunos no soportan *container queries*, `backdrop-filter` ni service workers. En ECO/auto la app evita el blur. No se prometió compatibilidad total: probá en tu TV real.
- El control remoto debe enviar eventos de flechas y Enter estándar.

## Navegadores
Pensado para navegadores modernos (Chrome/Edge/Firefox/Safari de los últimos ~3 años). En Android con Chrome 100+ funciona todo; en navegadores más viejos pueden fallar las container queries o IndexedDB en modo privado (la app sigue con datos en memoria).

## Editor en vivo y Creador (v2027.4.0)
- Los cambios del editor se guardan como reglas CSS por selector: si una lista cambia de orden, “solo este elemento” puede apuntar a otra tarjeta (usá “todos los parecidos”).
- Los proyectos del Creador son código real que corre en el navegador de cada visitante: la prueba previa y la cuarentena evitan la mayoría de roturas, pero **no pueden frenar un bucle infinito** en el momento (se corta en el siguiente arranque; el modo seguro `?safe=1` siempre te deja entrar).
- La consola “entiende” si es nuevo o reemplazo por el **nombre** del proyecto (no analiza el código con inteligencia artificial).
- Sin la migración 004 todo se guarda solo en el dispositivo del admin.
- No probado en un iPhone/Android real todavía: la pulsación larga está probada con mouse y con toques emulados.
