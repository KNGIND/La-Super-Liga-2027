/* ============================================================
   CONFIGURACIÓN GENERAL · La Súper Liga 2027
   Casi todo lo que querés cambiar "de comportamiento" está acá.
   (Colores y tamaños → src/styles/design-tokens.css)
   ============================================================ */
export const APP = {
    /** Nombre que se muestra en el encabezado y en el menú. */
    name: 'La Súper Liga',
    /** Texto corto (ej.: logo en pantallas angostas). */
    shortName: 'LSL',
    /** Versión (se muestra en "La liga"). Subila cuando publiques cambios. */
    version: '2027.4.0',
    /** Año/edición que aparece como subtítulo. */
    edition: '2027',
    /** Lema opcional debajo del nombre en el menú lateral. */
    tagline: 'Liga ficticia · hecha por y para jugadores',
};
/* ---------- NAVEGACIÓN ----------
   Cada sección está definida en src/features/registry.ts.
   Acá solo decidís cuáles se ven, en qué orden y dónde.

   tabs:    barra inferior (celular) / barra lateral (tablet y PC). Máximo 5 recomendado.
   drawer:  menú lateral (☰). Todo lo que no entra en las tabs.
   disabled: secciones apagadas (no aparecen ni se pueden abrir). */
export const NAV = {
    tabs: ['home', 'matches', 'standings', 'predictions', 'news'],
    drawer: ['tournaments', 'teams', 'players', 'squads', 'about'],
    disabled: [],
};
/* ---------- PREFERENCIAS PREDETERMINADAS ---------- */
export const DEFAULTS = {
    /** 'system' | 'dark' | 'light' */
    theme: 'dark',
    /** 'auto' elige según el celular. Otros: 'eco' | 'balanced' | 'ultra' */
    perf: 'auto',
    /** Gestos horizontales para cambiar de pestaña. */
    swipeNavigation: true,
    /** Mostrar solo notificaciones dentro de la app (el push real requiere OneSignal/FCM). */
    notifyMatches: true,
    notifyNews: true,
    notifyResults: true,
};
/* ---------- DATOS ---------- */
export const DATA = {
    /** Cada cuántos segundos se revisan novedades cuando hay un partido en vivo. */
    pollLiveSeconds: 20,
    /** Cada cuántos segundos se revisan novedades en el resto de los casos. */
    pollIdleSeconds: 90,
    /** Cuánto tiempo (minutos) se considera "reciente" un dato guardado sin conexión. */
    staleAfterMinutes: 10,
};
/* ---------- PRONÓSTICOS ----------
   Estas reglas también están en supabase/migrations/001_core.sql (función lsl2_points).
   Si las cambiás acá, cambialas también allá. El servidor es quien manda en modo nube. */
export const SCORING = {
    exact: 5, // resultado exacto
    goalDiff: 3, // ganador/empate correcto + misma diferencia de goles
    outcome: 2, // solo ganador/empate correcto
    /** Minutos antes del inicio en que se cierra el pronóstico. */
    closeMinutesBefore: 0,
};
/* ---------- FUNCIONES EXPERIMENTALES ---------- */
export const EXPERIMENTAL = {
    /** Animaciones Rive (solo en perfil ULTRA y si existe el archivo en public/rive/). */
    rive: true,
    /** Navegación con flechas/control remoto (TV). Se activa sola en pantallas grandes. */
    tvNavigation: true,
    /** Acceso al panel admin tocando 7 veces el nombre de la liga (además de #/admin). */
    secretAdminTap: true,
};
/* ---------- BACKEND ---------- */
export const BACKEND = {
    /* Conexión a Supabase. La clave "anon" es PÚBLICA por diseño (la seguridad la dan las políticas RLS).
       NUNCA pongas acá la clave service_role. Dejá ambas vacías ('') para usar solo el modo local. */
    url: 'https://jzeyankmecxazxmycvdz.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6ZXlhbmttZWN4YXp4bXljdmR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5OTc2OTgsImV4cCI6MjEwNTU3MzY5OH0.6hGYSlqr_7aSz2inG9rnD15QJwPwWU9Z808kZ5N3MLs',
    /** Prefijo de las tablas nuevas. Las tablas viejas (lsl_state, etc.) NO se tocan. */
    tablePrefix: 'lsl2_',
    get enabled() {
        return !!(this.url && this.anonKey);
    },
};
/* ---------- CLAVES DE ALMACENAMIENTO LOCAL ---------- */
export const STORAGE_KEYS = {
    prefs: 'lsl27:prefs',
    session: 'lsl27:session',
};
