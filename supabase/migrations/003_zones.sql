-- 003 · Zonas de la tabla de posiciones (campeón, tercer puesto, descenso…), editables desde Admin.
-- Es seguro correrla más de una vez. No toca datos existentes.
create table if not exists lsl2_zones (
  id          text primary key,
  label       text not null,
  position    int  not null check (position >= 1),
  to_position int  not null default 1 check (to_position >= 1),
  from_bottom boolean not null default false,
  color       text not null default '#f5c542',
  icon        text not null default '',
  enabled     boolean not null default true
);
alter table lsl2_zones enable row level security;
drop policy if exists "lsl2_read_zones" on lsl2_zones;
create policy "lsl2_read_zones" on lsl2_zones for select to anon, authenticated using (true);
drop policy if exists "lsl2_admin_write_zones" on lsl2_zones;
create policy "lsl2_admin_write_zones" on lsl2_zones for all to authenticated using (lsl2_is_admin()) with check (lsl2_is_admin());
-- Zonas iniciales (solo si la tabla está vacía)
insert into lsl2_zones (id, label, position, to_position, color, icon)
select * from (values
  ('z-campeon', 'Campeón',       1, 1, '#f5c542', 'trophy'),
  ('z-tercero', 'Tercer puesto', 3, 3, '#cd7f32', 'award')
) v(id, label, position, to_position, color, icon)
where not exists (select 1 from lsl2_zones);
