-- 004 · Personalización en vivo: cambios del Editor en vivo y proyectos del Creador.
-- Es seguro correrla más de una vez. No toca ninguna tabla existente.
--
-- Quién puede qué:
--   · LEER:    todos (la app necesita estos datos para verse igual para todos). Los proyectos DESACTIVADOS solo los ve un admin.
--   · ESCRIBIR: SOLO admin (política RLS en el servidor; ocultar botones no alcanza y acá no se confía en eso).
-- ⚠ Los proyectos del Creador contienen CÓDIGO que ejecutan todos los visitantes. Por eso solo un admin puede escribir.
--   Cuidá las cuentas admin (contraseña fuerte) y no pongas claves secretas dentro de un proyecto: el código es público.
create table if not exists lsl2_site_mods (
  id          text primary key,                       -- 'overrides' | 'proj:<id-del-proyecto>'
  kind        text not null check (kind in ('overrides', 'project')),
  name        text not null default '',
  enabled     boolean not null default true,
  version     int  not null default 1,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid()
);
alter table lsl2_site_mods enable row level security;

drop policy if exists "lsl2_read_site_mods" on lsl2_site_mods;
create policy "lsl2_read_site_mods" on lsl2_site_mods for select to anon, authenticated
  using (enabled or lsl2_is_admin());

drop policy if exists "lsl2_admin_write_site_mods" on lsl2_site_mods;
create policy "lsl2_admin_write_site_mods" on lsl2_site_mods for all to authenticated
  using (lsl2_is_admin()) with check (lsl2_is_admin());

-- Tope de tamaño por fila (1 MB) para que nadie sature la base por error.
alter table lsl2_site_mods drop constraint if exists lsl2_site_mods_size;
alter table lsl2_site_mods add constraint lsl2_site_mods_size check (pg_column_size(data) < 1048576);

-- Sello de tiempo automático
create or replace function lsl2_site_mods_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end $$;
drop trigger if exists lsl2_site_mods_touch on lsl2_site_mods;
create trigger lsl2_site_mods_touch before insert or update on lsl2_site_mods
  for each row execute function lsl2_site_mods_touch();
