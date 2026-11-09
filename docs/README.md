# La Súper Liga 2027 — Documentación

App web (PWA) hecha con **HTML + CSS + JavaScript (módulos nativos, sin frameworks y sin compilación)**. Se puede usar en el navegador, instalar como PWA y empaquetar como APK con Capacitor.

## Índice

| Documento | Para qué sirve |
|---|---|
| [development.md](development.md) | Cómo correr y probar la app (también desde Android) |
| [customization.md](customization.md) | **"¿Dónde cambio X?"** — colores, textos, navegación, tarjetas… |
| [architecture.md](architecture.md) | Cómo está organizado el código y cómo agregar una sección |
| [components.md](components.md) | Componentes compartidos (tarjetas, botones, modales…) |
| [editor-y-creador.md](editor-y-creador.md) | **Editor en vivo** (pulsación larga) y **Creador de proyectos** (pegar código), modo seguro |
| [conectar-supabase-firebase-github.md](conectar-supabase-firebase-github.md) | **Paso a paso**: Supabase (SQL 001–005, primer admin), GitHub, APK y Firebase |
| [admin.md](admin.md) | Panel de administración: pestañas, roles, importar/exportar CSV |
| [supabase.md](supabase.md) | Base de datos, migraciones, roles, cómo ser admin |
| [android-apk.md](android-apk.md) | Generar el APK con Capacitor + compilación en la nube |
| [notificaciones-push.md](notificaciones-push.md) | Qué notificaciones hay hoy y qué falta para push real |
| [limitaciones.md](limitaciones.md) | Estado real, pendientes y límites conocidos (TV, navegadores) |

## Resumen en 30 segundos

- `src/styles/design-tokens.css` → colores, tamaños, tipografía, duraciones.
- `src/core/config.js` → nombre, navegación, preferencias, reglas de puntos.
- `src/features/registry.js` → lista de pantallas. Agregar una = carpeta nueva + 1 línea.
- `src/services/` → todo lo que habla con el exterior (Supabase, IndexedDB, notificaciones). Las pantallas nunca hacen consultas directas.
- `supabase/migrations/` → SQL para crear/actualizar la base.
