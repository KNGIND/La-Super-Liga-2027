import { normalizeDataset } from './schema.js';
const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const iso = (s) => (s ? (/[zZ]|[+-]\d\d:?\d\d$/.test(s) && s.length > 16 ? s : `${s.slice(0, 16)}:00-03:00`) : '');
export function fromLegacy(old) {
    const seasonId = `s${(String(old.league?.season ?? '').match(/\d+/) ?? ['1'])[0]}`;
    const competitions = [{ id: 'liga', name: old.league?.name ?? 'Liga', kind: 'liga' }];
    const compId = (m) => {
        if (m.comp === 'liga')
            return 'liga';
        if (m.comp === 'copa') {
            const id = 'copa-' + slug(m.cup || 'copa');
            if (!competitions.some((c) => c.id === id))
                competitions.push({ id, name: m.cup || 'Copa', kind: 'copa' });
            return id;
        }
        if (!competitions.some((c) => c.id === 'amistosos'))
            competitions.push({ id: 'amistosos', name: 'Amistosos', kind: 'amistoso' });
        return 'amistosos';
    };
    const players = [];
    for (const t of old.teams ?? [])
        for (const p of t.squad ?? [])
            players.push({ id: `${t.id}-p${p.n}`, teamId: t.id, number: p.n, name: p.name, pos: p.pos || 'MED' });
    const matches = (old.matches ?? []).map((m) => ({
        id: m.id, seasonId, competitionId: compId(m), round: m.round || '',
        leg: /vuelta/i.test(m.round) || m.leg2 ? 'vuelta' : /ida/i.test(m.round) ? 'ida' : null,
        firstLeg: m.firstLeg || '', homeId: m.home, awayId: m.away, kickoff: iso(m.date),
        status: m.status === 'paused' ? 'paused' : m.status, minute: Number(m.minute) || 0,
        homeScore: m.status === 'upcoming' ? null : Number(m.hs) || 0,
        awayScore: m.status === 'upcoming' ? null : Number(m.as) || 0,
        pens: m.pens || '', stadium: m.stadium || '', channelId: m.channel || '', room: m.room || '',
        homeFormation: m.hf || '', awayFormation: m.af || '',
        homeLineup: (m.hl ?? []).map((p) => ({ number: p.n, name: p.name, pos: p.pos || '' })),
        awayLineup: (m.al ?? []).map((p) => ({ number: p.n, name: p.name, pos: p.pos || '' })),
        events: (m.events ?? []).map((e) => ({ minute: Number(e.min) || 0, type: e.type, side: e.side === 'h' ? 'home' : 'away', player: e.player || '' })),
        notes: m.notes || '',
    }));
    return normalizeDataset({
        league: { ...old.league, id: 1 },
        seasons: [{ id: seasonId, name: old.league?.season ?? '', status: old.league?.seasonStatus ?? '', current: true }],
        competitions,
        teams: (old.teams ?? []).map((t) => ({ id: t.id, name: t.name, short: t.short, color: t.color, color2: t.color2, logo: t.logo || '', adjust: Number(t.adj) || 0 })),
        players,
        matches,
        news: (old.news ?? []).map((n) => ({ id: n.id, kind: 'news', title: n.title, category: n.cat || 'Noticias', summary: n.summary || '', body: n.body || '', image: n.img || '', publishedAt: iso(n.date), pinned: false })),
        channels: (old.channels ?? []).map((c) => ({ id: c.id, name: c.name, logo: c.logo || '', url: '' })),
        sanctions: (old.sanctions ?? []).map((s) => ({ id: s.id, player: s.player, teamId: s.team, type: s.type, duration: s.duration || '', notes: s.notes || '' })),
    });
}
