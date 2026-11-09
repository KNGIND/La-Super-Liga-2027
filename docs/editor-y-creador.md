# Editor en vivo y Creador de proyectos (v2027.4.0)

Dos herramientas dentro del panel de administración (**Admin → Personalizar**) para cambiar la app **sin tocar archivos**.

> Solo las usa un **admin**. En modo nube el servidor lo hace cumplir (política RLS de `lsl2_site_mods`); en modo local protege la contraseña del panel.

---

## 1. Editor en vivo

**Para qué sirve:** cambiar *cualquier elemento* de la app mirándolo en vivo: tamaño, rotación, posición, colores, textos, qué hace al tocarlo, mostrarlo/ocultarlo, y el orden de las secciones.

### Cómo se usa
1. Admin → **Editor en vivo** → **Abrir editor**.
2. Navegá normal: tocar, deslizar y hacer scroll siguen funcionando.
3. Para **editar** algo, **mantené apretado** ese elemento (medio segundo). Aparece un recuadro azul con manijas y se abre el panel.
4. Ajustá. Todo se ve al instante.
5. **Publicar** para que lo vean todos (si no, queda como borrador).

### Qué podés tocar
| Pestaña del panel | Qué hace |
|---|---|
| **Posición** | Mover ←→ ↑↓, rotación, escala, ancho y alto. También con el recuadro: arrastrá el cuerpo (mover), el círculo de arriba (rotar), el de la esquina (tamaño). |
| **Estilo** | Color del texto, fondo, borde (color y grosor), redondeo, sombra, opacidad, tamaño y grosor del texto, vidrio (desenfoque). |
| **Función** | **Ocultar**, **Desactivar** (se ve pero no responde), **cambiar el texto**, y **Al tocar**: ir a otra pantalla, abrir un enlace o no hacer nada. |
| **Avanzado** | Aplicar a *solo este* o a *todos los parecidos* (ej.: todas las tarjetas), solo en esta pantalla o en todas, CSS libre, y “Elegir el contenedor” (subir al elemento padre). |
| **Global** (arriba) | Colores y formas de **toda la app** (los de `design-tokens.css`), por tema oscuro / claro / ambos, y tamaño de textos. |
| **Cambios** | Lista de todo lo que modificaste: activar/desactivar cada cambio, ir a él, borrarlo, exportar/importar, restablecer todo. |
| **Secciones** | Prender/apagar secciones, cambiar su orden y moverlas entre la barra inferior y el menú ☰. |

Detalles útiles:
- El punto azul junto a una opción significa “esto lo cambiaste”; la flechita ↶ la vuelve al valor original.
- **Deshacer / rehacer** arriba (hasta 60 pasos).
- El panel se pone solo arriba si lo elegido está en la mitad de abajo (y al revés), y se puede plegar con la flecha.
- Mientras editás, lo “oculto” se ve fantasma para que puedas volver a elegirlo.
- El borrador se guarda solo en tu dispositivo; si salís sin publicar, la app para el resto sigue igual.
- Los cambios de **Al tocar** y de **Ocultar** se ven de verdad al **salir** del editor.

### Cómo funciona por dentro (para que lo puedas tocar)
- Un cambio = *selector CSS + propiedades*. Todo se compila a **una sola hoja** `<style id="lsl-overrides">` (`src/services/mods/overrides.js`), por eso sobrevive cuando una pantalla se vuelve a dibujar.
- El selector se arma solo (`src/features/editor/selector.js`). Si querés que un elemento sea fácil de editar de forma estable, dale una clase fija o un `id` en su componente.
- Si el texto de un elemento viene de los datos (nombres, marcadores), se vuelve a pisar con el texto que pusiste cada vez que se redibuja.
- Archivos: `src/features/editor/index.js` (gestos y lógica), `sheet.js` (el panel), `src/styles/editor.css`.

### Limitaciones honestas
- Si los datos cambian el **orden** de una lista, un selector “solo este” con posición (`:nth-child`) puede apuntar a otra tarjeta. Para listas, usá **“todos los parecidos”**.
- El texto editado de algo que cambia solo (minuto del partido, marcador) queda fijo en lo que escribiste.
- Elementos dentro de un `svg` se eligen por su `svg` completo.

---

## 2. Creador de proyectos

**Para qué sirve:** sumar cosas nuevas (una **isla dinámica**, un cartel, una sección entera) pegando código. La consola entiende por el **nombre** si es algo nuevo o si reemplaza algo que ya existe.

### Flujo
1. Admin → **Creador** → **Nuevo proyecto** (se abre una pantalla completa de código).
2. **Datos:** nombre, *dónde va* y si está activo. Mientras escribís el nombre, te dice **“Proyecto nuevo”** o **“Reemplaza «X» (v3)”**.
3. Pegá tu código en **JS**, **CSS** y/o **HTML** (o usá **Pegar un HTML completo** y lo reparte solo, o **Usar una plantilla**).
4. **Probar ▶**: lo ejecuta de verdad en la app *sin guardar*. El estudio se pliega en una barrita para que veas el resultado; “Detener prueba” lo saca.
5. **Guardar**: vuelve a probarlo automáticamente. Si falla, te avisa y lo guarda **apagado** para que lo corrijas (no se activa roto para todos).

### Nuevo vs. reemplazo
- El **nombre** define el proyecto (`Isla dinámica` → id `isla-dinamica`; ignora tildes y mayúsculas).
- Si ya existe, te pide confirmar el **reemplazo** y la versión anterior queda en **Versiones** (las últimas 8; podés cargarlas de nuevo).

### Dónde se coloca (lo hace la consola, sin que toques otros archivos)
| Opción | Qué hace |
|---|---|
| **Flotante (toda la app)** | Se agrega al `<body>`; ideal para islas, botones flotantes, avisos. `api.host` es su contenedor. |
| **Dentro de una pantalla** | Se pone dentro de la pantalla elegida (o en todas), arriba o abajo. Se vuelve a poner sola si la pantalla se redibuja. |
| **Sección nueva** | Crea una pantalla nueva en `#/x/<id>` y su botón en el menú ☰ o en la barra inferior (o solo por enlace). |

### Cómo se escribe un proyecto
Tu JS recibe `api`. Dos formas válidas:
```js
// A) Código suelto (lo más simple): se ejecuta con `api` disponible
api.host.innerHTML = '<b>Hola</b>';
api.on('data', () => { /* se actualiza cuando cambian los datos */ });

// B) Módulo: exportá una función (permite `import` con URL completa)
export default function (api) {
  return () => { /* limpieza opcional al apagar */ };
}
```
| `api.…` | Qué es |
|---|---|
| `host` | El contenedor DOM del proyecto (ya tiene tu HTML). |
| `data()` | Datos de la liga (equipos, partidos, noticias…). Solo lectura. |
| `status()`, `profile()`, `isAdmin()` | Estado de datos y usuario actual. |
| `on('route'\|'data'\|'session'\|'prefs'\|'connection', fn)` | Escucha eventos de la app. Se limpia sola. |
| `listen(el, 'click', fn)` · `interval(fn, ms)` · `timeout(fn, ms)` | Eventos y temporizadores que se limpian solos al apagar el proyecto. |
| `navigate('/matches')`, `back()`, `route()` | Navegación. |
| `toast(msg, 'success')`, `confirm(msg)`, `esc(texto)`, `icon('trophy')` | Utilidades. **Usá `esc()` con todo dato que metas en HTML.** |
| `css(texto)` | Suma estilos (se quitan al apagar). |
| `storage.get/set/del` | Memoria propia del proyecto en este dispositivo. |
| `log(...)` | Mensajes de depuración. |

Plantillas incluidas (Nuevo proyecto → *Usar una plantilla*): **Isla dinámica** (muestra el partido en vivo o el próximo, con datos reales), **Cartel en Inicio** y **Sección nueva**.

### Exportar como archivos
**Archivos** en la tarjeta del proyecto descarga un `.zip` con `index.js`, `style.css`, `proyecto.json` y un `LEEME.txt` con los pasos. Para dejarlo **permanente en el código**: copiá la carpeta a `src/mods/` y agregá una línea en `src/mods/registry.js` (el LEEME te da la línea exacta). **Importar** vuelve a cargar un `proyecto.json`.

---

## 3. Seguridad y “no romper la página”

| Protección | Cómo funciona |
|---|---|
| **Solo admins escriben** | Política RLS en `lsl2_site_mods`. Un usuario común o anónimo solo puede leer. |
| **Prueba antes de guardar** | Un proyecto que falla no se activa. |
| **Cuarentena** | Si un proyecto falla al iniciar, se apaga y no vuelve a ejecutarse **en ese dispositivo** hasta que se guarde una versión nueva (o toques *Reintentar acá*). Lo mismo si la app se cuelga durante su inicio o si da 5 errores seguidos. |
| **Modo seguro** | Abrí la app con `?safe=1` al final de la dirección (ej. `https://tu-app.vercel.app/?safe=1`): no se aplica ningún cambio del editor ni corre ningún proyecto. Salís con `?safe=0` o el botón *Salir* del aviso. Podés entrar al panel y apagar lo que falla. |
| **Modo seguro automático** | Si la app se reinicia 4 veces en 15 segundos, queda 10 minutos en modo seguro. |

**Importante — el código de un proyecto lo ejecuta cada persona que abre la app.**
- Solo pegá código que entiendas o de alguien en quien confíes.
- Protegé las cuentas admin (contraseña fuerte).
- **Nunca pongas claves secretas** en un proyecto: el código es público.
- Un bucle infinito (`while(true)`) puede congelar la pestaña: la cuarentena lo corta en el siguiente arranque, y el modo seguro te deja entrar a apagarlo.

---

## 4. Dónde se guarda

| Situación | Dónde |
|---|---|
| Supabase configurado **y** migración `004_site_mods.sql` ejecutada | **Nube**: lo ven todos los visitantes. |
| Sin Supabase, o falta la migración | **Solo este dispositivo** (IndexedDB). El panel lo avisa. |

Cuando después corras la migración 004, en Admin → Creador aparece **“Subir lo local a la nube”**.

**Migración:** Supabase → SQL Editor → pegá `supabase/migrations/004_site_mods.sql` → Run (se puede ejecutar más de una vez; no toca datos existentes).

---

## 5. Dónde está cada cosa
| Archivo | Responsabilidad |
|---|---|
| `src/services/mods/store.js` | Guardar/leer cambios y proyectos (nube o local). |
| `src/services/mods/overrides.js` | Convertir los cambios del editor en estilos, textos, acciones y secciones. |
| `src/services/mods/runtime.js` | Ejecutar proyectos con aislamiento, cuarentena y la `api`. |
| `src/services/mods/safe.js` | Modo seguro y cuarentena. |
| `src/features/editor/*` | Editor en vivo. |
| `src/features/admin/creator.js` + `templates.js` | Creador y plantillas. |
| `src/mods/registry.js` | Proyectos como archivos del código. |
| `src/styles/editor.css` | Estilos de ambas herramientas. |
