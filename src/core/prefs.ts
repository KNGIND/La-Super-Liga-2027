/* Preferencias del dispositivo: tema, perfil de rendimiento, notificaciones.
   Se guardan en localStorage (síncrono: el tema tiene que aplicarse antes de pintar). */
import { DEFAULTS, STORAGE_KEYS } from './config';
import { bus } from './events';
import { ls } from '@/services/storage/kv';

export type Theme = 'system' | 'dark' | 'light';
export type PerfChoice = 'auto' | 'eco' | 'balanced' | 'ultra';
export type PerfProfile = 'eco' | 'balanced' | 'ultra';

export interface Prefs {
  theme: Theme;
  perf: PerfChoice;
  swipeNavigation: boolean;
  notifyMatches: boolean;
  notifyNews: boolean;
  notifyResults: boolean;
  lastSeenNotifications: string;
}

let prefs: Prefs = { ...DEFAULTS, lastSeenNotifications: '', ...ls.get<Partial<Prefs>>(STORAGE_KEYS.prefs, {}) };

export const getPrefs = (): Prefs => prefs;

export function setPrefs(patch: Partial<Prefs>): void {
  prefs = { ...prefs, ...patch };
  ls.set(STORAGE_KEYS.prefs, prefs);
  applyPrefs();
  bus.emit('prefs', undefined);
}

/** Elige un perfil según el hardware. Conservador: ante la duda, BALANCED o ECO. */
export function detectPerf(): PerfProfile {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mem = nav.deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  if (saveData || mem <= 2 || cores <= 4) return 'eco';
  if (mem >= 6 && cores >= 8) return 'ultra';
  return 'balanced';
}

export const reducedMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function effectivePerf(): PerfProfile {
  const p = prefs.perf === 'auto' ? detectPerf() : prefs.perf;
  return reducedMotion() && p === 'ultra' ? 'balanced' : p;
}

export function effectiveTheme(): 'dark' | 'light' {
  if (prefs.theme === 'system') return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  return prefs.theme;
}

/** Pone data-theme y data-perf en <html>. Los estilos hacen el resto. */
export function applyPrefs(): void {
  const root = document.documentElement;
  const theme = effectiveTheme();
  root.dataset.theme = theme;
  root.dataset.perf = effectivePerf();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#09090B' : '#F4F4F5');
}

matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => prefs.theme === 'system' && applyPrefs());
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', applyPrefs);
