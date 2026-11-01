/* Emisor de eventos mínimo y tipado. Lo usan el store, la conexión y el router. */

export type Handler<T> = (payload: T) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class Emitter<Events extends object> {
  private map = new Map<keyof Events, Set<Handler<never>>>();

  on<K extends keyof Events>(ev: K, fn: Handler<Events[K]>): () => void {
    let set = this.map.get(ev);
    if (!set) this.map.set(ev, (set = new Set()));
    set.add(fn as Handler<never>);
    return () => set!.delete(fn as Handler<never>);
  }

  emit<K extends keyof Events>(ev: K, payload: Events[K]): void {
    this.map.get(ev)?.forEach((fn) => {
      try {
        (fn as Handler<Events[K]>)(payload);
      } catch (e) {
        console.error(`[events] error en "${String(ev)}"`, e);
      }
    });
  }
}

/** Eventos globales de la app. Agregá los tuyos acá. */
export interface AppEvents {
  data: void;            // cambió el dataset (partidos, noticias…)
  prefs: void;           // cambió una preferencia (tema, perfil de rendimiento…)
  session: void;         // inicio / cierre de sesión
  connection: void;      // cambió el estado de conexión o de sincronización
  route: string;         // cambió la pantalla
  predictions: void;     // cambiaron los pronósticos del usuario
}

export const bus = new Emitter<AppEvents>();
