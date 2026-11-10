-- 005 · Registro de cambios del panel, roles protegidos y tiempo real.
-- Seguro de correr más de una vez. No borra ni modifica datos existentes.
-- Requisito: haber corrido 001 a 004.

-- ============================================================
-- 1) REGISTRO DE CAMBIOS (quién creó / editó / borró qué y cuándo)
-- ============================================================
create table if not exists lsl2_audit (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor_id    uuid,
  actor_email text not null default '',
  action      text not null check (action in ('insert','update','delete')),
  table_name  text not null,
  row_id      text not null default '',
  summary     text not null default '',
  before      jsonb,
  after       jsonb
);
create index if not exists lsl2_audit_at_idx on lsl2_audit (at desc);
alter table lsl2_audit enable row level security;

drop policy if exists "lsl2_audit_admin_read" on lsl2_audit;
create policy "lsl2_audit_admin_read" on lsl2_audit for select to authenticated using (lsl2_is_admin());
-- Sin políticas de escritura: nadie inserta, edita ni borra el registro a mano. Solo lo escriben los triggers.

create or replace function lsl2_audit_row() returns trigger language plpgsql security definer set search_path = public as $$
declare
  j_old jsonb;
  j_new jsonb;
  j     jsonb;
  uid   uuid := auth.uid();
  mail  text;
begin
  j_old := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  j_new := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  j     := coalesce(j_new, j_old);
  begin
    select email into mail from lsl2_profiles where id = uid;
    insert into lsl2_audit (actor_id, actor_email, action, table_name, row_id, summary, before, after)
    values (uid,
            coalesce(nullif(mail, ''), case when uid is null then 'SQL / sistema' else '' end),
            lower(tg_op), tg_table_name,
            coalesce(j->>'id', ''),
            left(coalesce(nullif(j->>'name', ''), nullif(j->>'title', ''), nullif(j->>'home_id', ''), j->>'id', ''), 200),
            j_old, j_new);
  exception when others then
    -- el registro nunca debe impedir que se guarde el cambio original
    raise warning 'registro de cambios: %', sqlerrm;
  end;
  return coalesce(new, old);
end $$;

-- Triggers en las tablas que edita el panel (solo las que existan)
do $$
declare t text;
begin
  foreach t in array array['league','seasons','competitions','teams','players','channels','matches','sanctions','notifications','news','zones'] loop
    if to_regclass('public.lsl2_' || t) is not null then
      execute format('drop trigger if exists lsl2_audit_t on lsl2_%s', t);
      execute format('create trigger lsl2_audit_t after insert or update or delete on lsl2_%s for each row execute function lsl2_audit_row()', t);
    end if;
  end loop;
end $$;
-- Nota: los pronósticos no se registran (son muchos y no son "cambios del panel").

-- Limpieza opcional (solo admin): borra registros más viejos que N días.
create or replace function lsl2_audit_prune(p_days int default 180) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is not null and not lsl2_is_admin() then
    raise exception 'Solo un admin puede limpiar el registro' using errcode = '42501';
  end if;
  delete from lsl2_audit where at < now() - make_interval(days => p_days);
  get diagnostics n = row_count;
  return n;
end $$;

-- ============================================================
-- 2) ROLES PROTEGIDOS
--    · Nadie se puede subir de rol desde la app (ni a sí mismo): solo un admin, con lsl2_set_role.
--    · Siempre tiene que quedar al menos un admin.
--    · Cada cambio de rol queda en el registro.
--    · Desde el SQL Editor (sin sesión) sí se pueden cambiar roles, para el primer admin.
-- ============================================================
create or replace function lsl2_guard_role() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is not null and not lsl2_is_admin() then
      raise exception 'Solo un admin puede cambiar roles' using errcode = '42501';
    end if;
    if old.role = 'admin' and not exists (select 1 from lsl2_profiles where role = 'admin' and id <> old.id) then
      raise exception 'Tiene que quedar al menos un admin';
    end if;
    insert into lsl2_audit (actor_id, actor_email, action, table_name, row_id, summary, before, after)
    values (auth.uid(),
            coalesce((select email from lsl2_profiles where id = auth.uid()), case when auth.uid() is null then 'SQL / sistema' else '' end),
            'update', 'lsl2_profiles', new.id::text,
            'Rol de ' || new.email || ': ' || old.role || ' → ' || new.role,
            jsonb_build_object('role', old.role), jsonb_build_object('role', new.role));
  end if;
  return new;
end $$;
drop trigger if exists lsl2_guard_role on lsl2_profiles;
create trigger lsl2_guard_role before update on lsl2_profiles
  for each row execute function lsl2_guard_role();

-- ============================================================
-- 3) TIEMPO REAL: el panel y la app reciben los cambios al instante
--    (partidos, noticias, equipos, jugadores y el registro de cambios)
-- ============================================================
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['lsl2_matches','lsl2_news','lsl2_teams','lsl2_players','lsl2_audit'] loop
    if to_regclass('public.' || t) is not null
       and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
