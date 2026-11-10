/* USUARIO: perfil, favoritos e historial de actividad.
   Con sesión en la nube se guarda en Supabase (lsl2_profiles). Sin sesión, en este dispositivo.
   Las pantallas solo usan esto: no saben dónde se guarda. */
import { bus } from '../core/events.js';
import { kvGet, kvSet } from './storage/kv.js';
import { currentProfile, isLoggedIn, updateProfile } from './supabase/auth.js';
import { BACKEND } from '../core/config.js';
const K_PROFILE = 'user:local';
const K_ACT = 'user:activity';
let local = { name: '', avatar: '', welcomed: false, favoriteTeams: [], favoritePlayers: [] };
let activity = [];
export async function initUser() {
    local = { ...local, ...(await kvGet(K_PROFILE, {})) };
    activity = await kvGet(K_ACT, []);
    bus.emit('session', undefined);
}
const cloud = () => BACKEND.enabled && isLoggedIn() && !!currentProfile();
export const userName = () => (cloud() ? currentProfile().name : local.name) || '';
export const favoriteTeams = () => (cloud() ? currentProfile().favoriteTeams : local.favoriteTeams);
export const favoritePlayers = () => (cloud() ? currentProfile().favoritePlayers : local.favoritePlayers);
export const getActivity = () => activity;
/** Foto de perfil (se guarda en este dispositivo). Vacía = se muestra la inicial del nombre. */
export const avatarUrl = () => local.avatar || '';
/** ¿Es la primera vez? (sin nombre guardado, sin sesión y sin haber pasado por la bienvenida) */
export const needsWelcome = () => !local.welcomed && !local.name && !isLoggedIn();
export async function setAvatar(url) {
    local = { ...local, avatar: url };
    await kvSet(K_PROFILE, local);
    bus.emit('session', undefined);
}
export async function finishWelcome(name, avatar) {
    local = { ...local, name: name.trim().slice(0, 20), avatar: avatar || local.avatar || '', welcomed: true };
    await kvSet(K_PROFILE, local);
    logActivity('Creaste tu perfil');
}
export const initialOf = () => (userName().trim()[0] ?? '·').toUpperCase();
export function logActivity(text) {
    activity = [{ at: new Date().toISOString(), text }, ...activity].slice(0, 50);
    void kvSet(K_ACT, activity);
    bus.emit('session', undefined);
}
async function save(patch) {
    if (cloud())
        await updateProfile(patch);
    else {
        local = { ...local, ...patch };
        await kvSet(K_PROFILE, local);
        bus.emit('session', undefined);
    }
}
export const setName = (name) => save({ name: name.trim().slice(0, 30) });
export async function toggleFavoriteTeam(id, label) {
    const list = favoriteTeams();
    const on = !list.includes(id);
    await save({ favoriteTeams: on ? [...list, id] : list.filter((x) => x !== id) });
    logActivity(`${on ? 'Agregaste a favoritos' : 'Quitaste de favoritos'}: ${label}`);
    return on;
}
export async function toggleFavoritePlayer(id, label) {
    const list = favoritePlayers();
    const on = !list.includes(id);
    await save({ favoritePlayers: on ? [...list, id] : list.filter((x) => x !== id) });
    logActivity(`${on ? 'Agregaste a favoritos' : 'Quitaste de favoritos'}: ${label}`);
    return on;
}
