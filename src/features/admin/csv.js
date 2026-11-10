/* IMPORTAR Y EXPORTAR CSV desde el panel de administración.
   Sirve para cargar muchos registros de una vez (por ejemplo, todos los jugadores de un equipo)
   desde una planilla (Excel / Google Sheets → "Guardar como CSV").

   Reglas:
   - La primera fila son los nombres de las columnas (los mismos que el formulario: ver COLUMNAS en cada entidad).
   - En las columnas de tipo lista (equipo, competición, posición…) podés escribir el NOMBRE o el id.
   - Fechas: "20/09/2026 21:30" o formato ISO.
   - Si la columna "id" coincide con un registro existente, se ACTUALIZA; si no, se crea uno nuevo.
   - Los eventos y las alineaciones de los partidos no van en el CSV (se cargan en el formulario del partido). */
import { norm, uid } from '../../utils/dom.js';
import { formToValue } from './schemas.js';

const SKIP = ['events', 'lineup']; // tipos que no entran en el CSV

/** Columnas del CSV de una entidad. */
export const csvColumns = (e) => ['id', ...e.fields.filter((f) => !SKIP.includes(f.type)).map((f) => f.name)];

/* ---------- CSV ↔ texto ---------- */
const cell = (v) => {
  const s = String(v ?? '');
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function parseCsv(text) {
  const src = text.replace(/^﻿/, '');
  const first = src.split(/\r?\n/, 1)[0] ?? '';
  const delim = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

/* ---------- exportar ---------- */
export function entityToCsv(e, d) {
  const cols = csvColumns(e);
  const out = [cols.join(',')];
  const sorted = d[e.table].slice();
  if (e.sort) sorted.sort(e.sort);
  for (const r of sorted) {
    out.push(cols.map((c) => {
      if (c === 'id') return cell(r.id);
      const f = e.fields.find((x) => x.name === c);
      const raw = r[c];
      if (f.type === 'select') {
        const hit = f.options(d).find(([v]) => v === raw);
        return cell(hit ? hit[1] : (raw ?? ''));
      }
      if (f.type === 'datetime') return cell(raw ?? '');
      if (f.type === 'check') return cell(raw ? 'sí' : 'no');
      return cell(raw ?? '');
    }).join(','));
  }
  return '﻿' + out.join('\r\n');
}

/* ---------- importar ---------- */
function parseDate(s) {
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/);
  const dt = m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] ?? 0), Number(m[5] ?? 0)) : new Date(s);
  return isNaN(dt.getTime()) ? null : dt.toISOString();
}

/** Convierte el texto CSV en registros listos para guardar. Devuelve { rows, created, updated, errors }. */
export function csvToRows(e, d, text) {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], created: 0, updated: 0, errors: ['El archivo está vacío o no tiene filas de datos.'] };
  const header = table[0].map((h) => h.trim());
  const known = csvColumns(e);
  const unknown = header.filter((h) => h && !known.includes(h));
  const errors = unknown.length ? [`Columnas desconocidas (se ignoran): ${unknown.join(', ')}.`] : [];
  const work = { ...d, [e.table]: d[e.table].slice() }; // copia para validar duplicados entre filas del mismo archivo
  const rows = [];
  let created = 0, updated = 0;

  table.slice(1).forEach((line, i) => {
    const n = i + 2; // número de fila como la ve la persona en la planilla
    const get = (c) => { const k = header.indexOf(c); return k < 0 ? undefined : (line[k] ?? '').trim(); };
    const givenId = get('id');
    const existing = givenId ? work[e.table].find((x) => x.id === givenId) : undefined;
    const row = existing ? { ...existing } : { ...e.blank(d), id: givenId || uid(e.table[0]) };
    let bad = '';
    for (const f of e.fields) {
      if (SKIP.includes(f.type)) continue;
      const raw = get(f.name);
      if (raw === undefined) continue; // la columna no está en el archivo: se deja el valor que había
      if (raw === '' && f.required) { bad = `Falta "${f.label}".`; break; }
      if (f.type === 'select') {
        const opts = f.options(d);
        const hit = raw === '' ? opts.find(([v]) => v === '') : opts.find(([v, l]) => v === raw || norm(l) === norm(raw));
        if (!hit) { bad = `"${raw}" no es un valor válido para "${f.label}".`; break; }
        row[f.name] = formToValue(f, hit[0]);
      } else if (f.type === 'number') {
        if (raw !== '' && isNaN(Number(raw))) { bad = `"${raw}" no es un número (${f.label}).`; break; }
        row[f.name] = formToValue(f, raw);
      } else if (f.type === 'datetime') {
        const iso = raw === '' ? '' : parseDate(raw);
        if (raw !== '' && !iso) { bad = `Fecha inválida "${raw}" (usá 20/09/2026 21:30).`; break; }
        row[f.name] = iso || row[f.name];
      } else if (f.type === 'check') {
        row[f.name] = /^(1|si|sí|true|x|yes)$/i.test(raw);
      } else {
        row[f.name] = raw;
      }
    }
    if (!bad) bad = e.validate?.(row, work) ?? '';
    if (bad) { errors.push(`Fila ${n}: ${bad}`); return; }
    const at = work[e.table].findIndex((x) => x.id === row.id);
    if (at >= 0) { work[e.table][at] = row; updated++; } else { work[e.table].push(row); created++; }
    rows.push(row);
  });
  return { rows, created, updated, errors };
}

