/* Autenticación y perfil del usuario (Supabase Auth por REST). */
import { BACKEND } from '../../core/config.js';
import { bus } from '../../core/events.js';
import { SbError, getSession, onSessionChange, request, rpc, select, setSession, toSession, } from './client.js';
let profile = null;
export const authEnabled = () => BACKEND.enabled;
export const currentProfile = () => profile;
export const isLoggedIn = () => !!getSession();
export const isAdmin = () => profile?.role === 'admin';
export const canEdit = () => profile?.role === 'admin' || profile?.role === 'editor';
const fromRow = (r) => ({
    id: r.id, email: r.email, name: r.name || r.email.split('@')[0], role: r.role,
    favoriteTeams: r.favorite_teams ?? [], favoritePlayers: r.favorite_players ?? [],
});
export async function loadProfile() {
    const s = getSession();
    if (!s || !BACKEND.enabled) {
        profile = null;
        return null;
    }
    try {
        const rows = await select('profiles', `select=*&id=eq.${s.userId}`);
        profile = rows[0] ? fromRow(rows[0]) : null;
    }
    catch {
        profile = null; // sin red o sin tabla: la sesión sigue, pero sin rol
    }
    bus.emit('session', undefined);
    return profile;
}
export async function signIn(email, password) {
    const r = (await request('/auth/v1/token?grant_type=password', {
        method: 'POST', auth: false, body: JSON.stringify({ email, password }),
    }).catch((e) => {
        if (e instanceof SbError && e.status === 400)
            throw new SbError(400, 'bad_credentials', 'Email o contraseña incorrectos.');
        throw e;
    }));
    setSession(toSession(r));
    await loadProfile();
}
/** Devuelve true si quedó con sesión iniciada; false si Supabase pide confirmar el email primero. */
export async function signUp(email, password, name) {
    const r = (await request('/auth/v1/signup', {
        method: 'POST', auth: false, body: JSON.stringify({ email, password, data: { name } }),
    }));
    if (!r.access_token)
        return false;
    setSession(toSession(r));
    await loadProfile();
    return true;
}
export async function signOut() {
    const s = getSession();
    setSession(null);
    profile = null;
    bus.emit('session', undefined);
    if (s)
        request('/auth/v1/logout', { method: 'POST', headers: { Authorization: `Bearer ${s.access}` }, auth: false }).catch(() => { });
}
export async function updateProfile(patch) {
    if (!profile)
        return;
    const next = { ...profile, ...patch };
    // PATCH (no upsert): el servidor solo deja cambiar nombre y favoritos, nunca el rol.
    await request(`/rest/v1/${BACKEND.tablePrefix}profiles?id=eq.${profile.id}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ name: next.name, favorite_teams: next.favoriteTeams, favorite_players: next.favoritePlayers }),
    });
    profile = next;
    bus.emit('session', undefined);
}
export async function listUsers() {
    return (await select('profiles', 'select=*&order=created_at.desc')).map(fromRow);
}
export async function setUserRole(id, role) {
    await rpc('set_role', { p_user: id, p_role: role }); // función SQL: solo admins, y no sobre uno mismo
}
onSessionChange(() => bus.emit('session', undefined));
