/* Textos de estado de datos: "actualizado hace 5 min" y si un dato es reciente o viejo. */
import { DATA } from './config';

export function relativeTime(at: number, now = Date.now()): string {
  const m = Math.round((now - at) / 60000);
  if (m < 1) return 'actualizado recién';
  if (m < 60) return `actualizado hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `actualizado hace ${h} h`;
  return `actualizado hace ${Math.round(h / 24)} d`;
}

export const isStale = (at: number | null): boolean => !at || Date.now() - at > DATA.staleAfterMinutes * 60000;
