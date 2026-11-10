/* Emisor de eventos mínimo y tipado. Lo usan el store, la conexión y el router. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class Emitter {
    constructor() {
        this.map = new Map();
    }
    on(ev, fn) {
        let set = this.map.get(ev);
        if (!set)
            this.map.set(ev, (set = new Set()));
        set.add(fn);
        return () => set.delete(fn);
    }
    emit(ev, payload) {
        this.map.get(ev)?.forEach((fn) => {
            try {
                fn(payload);
            }
            catch (e) {
                console.error(`[events] error en "${String(ev)}"`, e);
            }
        });
    }
}
export const bus = new Emitter();
