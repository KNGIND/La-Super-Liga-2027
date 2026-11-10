export const TABLE_NAMES = [
    'seasons', 'competitions', 'teams', 'players', 'matches', 'news', 'channels', 'sanctions', 'notifications',
];
/** Orden en que se piden las tablas. */
export const ORDER = {
    matches: 'kickoff.asc',
    news: 'published_at.desc',
    notifications: 'created_at.desc',
};
/** Zonas de la tabla de posiciones por defecto: campeón (1.º) y tercer puesto. Se editan desde Admin → Zonas de la tabla. */
export const defaultZones = () => [
    { id: 'z-campeon', label: 'Campeón', position: 1, toPosition: 1, fromBottom: false, color: '#f5c542', icon: 'trophy', enabled: true },
    { id: 'z-tercero', label: 'Tercer puesto', position: 3, toPosition: 3, fromBottom: false, color: '#cd7f32', icon: 'award', enabled: true },
];
export const snake = (s) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
export const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
export function toRow(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj))
        out[snake(k)] = v;
    return out;
}
export function fromRow(row) {
    const out = {};
    for (const [k, v] of Object.entries(row))
        out[camel(k)] = v;
    return out;
}
export function emptyDataset() {
    return {
        league: {
            id: 1, name: 'La Súper Liga', short: 'LSL', season: 'Temporada 1', seasonStatus: 'En curso', tagline: '',
            info: '', rules: '', pointsWin: 3, pointsDraw: 1, pointsLoss: 0, zoneTop: 0, zoneBottom: 0, logo: '',
        },
        seasons: [], competitions: [], teams: [], players: [], matches: [], news: [], channels: [], sanctions: [], notifications: [], zones: defaultZones(),
    };
}
/** Rellena campos faltantes (datos viejos, imports incompletos) para que la UI nunca reciba undefined. */
export function normalizeDataset(raw) {
    const base = emptyDataset();
    const d = raw ?? {};
    return {
        league: { ...base.league, ...(d.league ?? {}) },
        seasons: d.seasons ?? [],
        competitions: d.competitions ?? [],
        teams: (d.teams ?? []).map((t) => ({ ...t, logo: t.logo ?? '', color: t.color ?? '#3b82f6', color2: t.color2 ?? '#ffffff', adjust: t.adjust ?? 0, short: t.short ?? (t.name ?? '').slice(0, 3).toUpperCase() })),
        players: d.players ?? [],
        matches: (d.matches ?? []).map((m) => ({
            ...m, round: m.round ?? '', leg: m.leg ?? null, firstLeg: m.firstLeg ?? '', minute: m.minute ?? 0, homeScore: m.homeScore ?? null,
            awayScore: m.awayScore ?? null, pens: m.pens ?? '', stadium: m.stadium ?? '', channelId: m.channelId ?? '', room: m.room ?? '',
            homeFormation: m.homeFormation ?? '', awayFormation: m.awayFormation ?? '', homeLineup: m.homeLineup ?? [], awayLineup: m.awayLineup ?? [],
            events: m.events ?? [], notes: m.notes ?? '',
        })),
        news: (d.news ?? []).map((n) => ({ ...n, kind: n.kind ?? 'news', category: n.category ?? 'Noticias', summary: n.summary ?? '', body: n.body ?? '', image: n.image ?? '', pinned: n.pinned ?? false })),
        channels: d.channels ?? [],
        sanctions: d.sanctions ?? [],
        notifications: d.notifications ?? [],
        zones: (d.zones ?? defaultZones()).map((z) => ({ ...z, toPosition: z.toPosition || z.position, fromBottom: !!z.fromBottom, icon: z.icon ?? '', enabled: z.enabled !== false })),
    };
}
