-- ============================================================
-- La Súper Liga 2027 · Migración 001: esquema nuevo (tablas lsl2_*)
-- ------------------------------------------------------------
-- • NO toca las tablas de la app anterior (lsl_state, lsl_code, lsl_snippets, …).
-- • Es seguro ejecutarla más de una vez (usa IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS).
-- • Cómo usarla: Supabase → SQL Editor → pegar todo → Run.
-- • Después: 002_import_legacy.sql (copia tus datos viejos) y docs/supabase.md (hacerte admin).
-- ============================================================

-- ---------- PERFILES Y ROLES ----------
create table if not exists lsl2_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  name text not null default '',
  role text not null default 'user' check (role in ('user','editor','admin')),
  favorite_teams text[] not null default '{}',
  favorite_players text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Al registrarse alguien en Supabase Auth se crea su perfil (siempre con rol 'user').
create or replace function lsl2_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into lsl2_profiles (id, email, name)
  values (new.id, coalesce(new.email,''), coalesce(nullif(new.raw_user_meta_data->>'name',''), split_part(coalesce(new.email,''),'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists lsl2_on_auth_user_created on auth.users;
create trigger lsl2_on_auth_user_created after insert on auth.users
  for each row execute function lsl2_handle_new_user();

-- Perfiles para los usuarios que YA existían (por ejemplo tu admin de la app vieja). Rol 'user': promovete con docs/supabase.md.
insert into lsl2_profiles (id, email, name)
select u.id, coalesce(u.email,''), coalesce(nullif(u.raw_user_meta_data->>'name',''), split_part(coalesce(u.email,''),'@',1))
from auth.users u on conflict (id) do nothing;

-- Funciones de rol (las usan las políticas). SECURITY DEFINER para no caer en recursión de RLS.
create or replace function lsl2_role() returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role from lsl2_profiles where id = auth.uid()), 'anon') $$;
create or replace function lsl2_is_admin() returns boolean language sql stable as $$ select lsl2_role() = 'admin' $$;
create or replace function lsl2_is_editor() returns boolean language sql stable as $$ select lsl2_role() in ('admin','editor') $$;

-- Solo un admin puede cambiar roles (y no el propio, para no quedarse sin admins por error).
create or replace function lsl2_set_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not lsl2_is_admin() then raise exception 'Solo un admin puede cambiar roles' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'No podés cambiar tu propio rol' using errcode = '42501'; end if;
  if p_role not in ('user','editor','admin') then raise exception 'Rol inválido'; end if;
  update lsl2_profiles set role = p_role where id = p_user;
end $$;

-- ---------- CONTENIDO DE LA LIGA ----------
create table if not exists lsl2_league (
  id int primary key default 1 check (id = 1),
  name text not null default 'La Súper Liga', short text not null default 'LSL',
  season text not null default '', season_status text not null default '', tagline text not null default '',
  info text not null default '', rules text not null default '',
  points_win int not null default 3, points_draw int not null default 1, points_loss int not null default 0,
  zone_top int not null default 0, zone_bottom int not null default 0, logo text not null default ''
);
insert into lsl2_league (id) values (1) on conflict do nothing;

create table if not exists lsl2_seasons (id text primary key, name text not null, status text not null default '', current boolean not null default false);
create table if not exists lsl2_competitions (id text primary key, name text not null, kind text not null default 'liga' check (kind in ('liga','copa','amistoso')));
create table if not exists lsl2_teams (
  id text primary key, name text not null, short text not null default '', color text not null default '#3B82F6', color2 text not null default '#FFFFFF',
  logo text not null default '', adjust int not null default 0
);
create table if not exists lsl2_players (
  id text primary key, team_id text not null references lsl2_teams(id) on delete cascade,
  number int not null, name text not null, pos text not null default '' check (pos in ('POR','DEF','MED','DEL',''))
);
create index if not exists lsl2_players_team on lsl2_players(team_id);
create table if not exists lsl2_channels (id text primary key, name text not null, logo text not null default '', url text not null default '');
create table if not exists lsl2_matches (
  id text primary key,
  season_id text not null references lsl2_seasons(id), competition_id text not null references lsl2_competitions(id),
  round text not null default '', leg text check (leg in ('ida','vuelta')), first_leg text not null default '',
  home_id text not null references lsl2_teams(id), away_id text not null references lsl2_teams(id),
  kickoff timestamptz not null,
  status text not null default 'upcoming' check (status in ('upcoming','live','paused','finished')),
  minute int not null default 0, home_score int, away_score int, pens text not null default '',
  stadium text not null default '', channel_id text not null default '', room text not null default '',
  home_formation text not null default '', away_formation text not null default '',
  home_lineup jsonb not null default '[]', away_lineup jsonb not null default '[]', events jsonb not null default '[]',
  notes text not null default '', updated_at timestamptz not null default now(),
  check (home_id <> away_id)
);
create index if not exists lsl2_matches_kickoff on lsl2_matches(kickoff);
create table if not exists lsl2_news (
  id text primary key, kind text not null default 'news' check (kind in ('news','announcement')),
  title text not null, category text not null default 'Noticias', summary text not null default '', body text not null default '',
  image text not null default '', published_at timestamptz not null default now(), pinned boolean not null default false
);
create table if not exists lsl2_sanctions (
  id text primary key, player text not null, team_id text not null default '', type text not null default 'yellow',
  duration text not null default '', notes text not null default ''
);
create table if not exists lsl2_notifications (
  id text primary key, kind text not null default 'announcement', title text not null, body text not null default '',
  link text not null default '', created_at timestamptz not null default now()
);

-- ---------- PRONÓSTICOS ----------
create table if not exists lsl2_predictions (
  user_id uuid not null references lsl2_profiles(id) on delete cascade,
  match_id text not null references lsl2_matches(id) on delete cascade,
  home int not null check (home between 0 and 30), away int not null check (away between 0 and 30),
  points int, created_at timestamptz not null default now(),
  primary key (user_id, match_id)
);

-- REGLAS DE PUNTUACIÓN (única fuente de verdad en modo nube). Si las cambiás, cambiá también SCORING en src/core/config.ts.
--   resultado exacto = 5 · mismo ganador/empate y misma diferencia = 3 · solo ganador/empate = 2 · nada = 0
create or replace function lsl2_points(ph int, pa int, rh int, ra int) returns int language sql immutable as $$
  select case
    when ph = rh and pa = ra then 5
    when sign(ph - pa) = sign(rh - ra) then (case when ph - pa = rh - ra then 3 else 2 end)
    else 0 end $$;

create or replace function lsl2_settle_match(p_match text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update lsl2_predictions p set points = lsl2_points(p.home, p.away, m.home_score, m.away_score)
  from lsl2_matches m
  where m.id = p_match and p.match_id = m.id and m.status = 'finished' and m.home_score is not null and m.away_score is not null;
  -- si el partido dejó de estar finalizado (se corrigió), se anulan los puntos
  update lsl2_predictions p set points = null
  from lsl2_matches m where m.id = p_match and p.match_id = m.id and m.status <> 'finished';
end $$;

create or replace function lsl2_on_match_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;
drop trigger if exists lsl2_match_touch on lsl2_matches;
create trigger lsl2_match_touch before update on lsl2_matches for each row execute function lsl2_on_match_change();

create or replace function lsl2_after_match_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform lsl2_settle_match(new.id);
  return null;
end $$;
drop trigger if exists lsl2_match_settle on lsl2_matches;
create trigger lsl2_match_settle after insert or update of status, home_score, away_score on lsl2_matches
  for each row execute function lsl2_after_match_change();

create or replace function lsl2_settle_all() returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not lsl2_is_admin() then raise exception 'Solo un admin puede recalcular' using errcode = '42501'; end if;
  for r in select id from lsl2_matches loop perform lsl2_settle_match(r.id); end loop;
end $$;

-- Ranking público (solo nombre y puntos; no expone emails ni pronósticos individuales).
create or replace view lsl2_leaderboard as
select p.id as user_id, p.name,
       coalesce(sum(pr.points),0)::int as points,
       (count(*) filter (where pr.points = 5))::int as exact,
       count(pr.match_id)::int as predictions
from lsl2_profiles p join lsl2_predictions pr on pr.user_id = p.id
group by p.id, p.name having count(*) filter (where pr.points is not null) > 0;

-- ---------- SEGURIDAD (RLS) ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','league','seasons','competitions','teams','players','channels','matches','news','sanctions','notifications','predictions'] loop
    execute format('alter table lsl2_%I enable row level security', t);
  end loop;
end $$;

-- Lectura pública del contenido de la liga
do $$
declare t text;
begin
  foreach t in array array['league','seasons','competitions','teams','players','channels','matches','sanctions','notifications'] loop
    execute format('drop policy if exists "lsl2_read_%1$s" on lsl2_%1$s', t);
    execute format('create policy "lsl2_read_%1$s" on lsl2_%1$s for select to anon, authenticated using (true)', t);
  end loop;
end $$;
drop policy if exists "lsl2_read_news" on lsl2_news;
create policy "lsl2_read_news" on lsl2_news for select to anon, authenticated using (published_at <= now() or lsl2_is_editor());

-- Escritura: ADMIN → liga, temporadas, competiciones, equipos, jugadores
do $$
declare t text;
begin
  foreach t in array array['league','seasons','competitions','teams','players'] loop
    execute format('drop policy if exists "lsl2_admin_write_%1$s" on lsl2_%1$s', t);
    execute format('create policy "lsl2_admin_write_%1$s" on lsl2_%1$s for all to authenticated using (lsl2_is_admin()) with check (lsl2_is_admin())', t);
  end loop;
end $$;
-- Escritura: ADMIN o EDITOR → partidos, noticias, canales, sanciones, avisos
do $$
declare t text;
begin
  foreach t in array array['matches','news','channels','sanctions','notifications'] loop
    execute format('drop policy if exists "lsl2_editor_write_%1$s" on lsl2_%1$s', t);
    execute format('create policy "lsl2_editor_write_%1$s" on lsl2_%1$s for all to authenticated using (lsl2_is_editor()) with check (lsl2_is_editor())', t);
  end loop;
end $$;

-- Perfiles: cada uno ve y edita el suyo (nunca el rol); el admin ve todos.
drop policy if exists "lsl2_profiles_select" on lsl2_profiles;
create policy "lsl2_profiles_select" on lsl2_profiles for select to authenticated using (id = auth.uid() or lsl2_is_admin());
drop policy if exists "lsl2_profiles_update_own" on lsl2_profiles;
create policy "lsl2_profiles_update_own" on lsl2_profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on lsl2_profiles from authenticated;
grant update (name, favorite_teams, favorite_players) on lsl2_profiles to authenticated;

-- Pronósticos: solo los propios, y solo mientras el partido NO empezó. Los puntos los pone el servidor.
drop policy if exists "lsl2_pred_select" on lsl2_predictions;
create policy "lsl2_pred_select" on lsl2_predictions for select to authenticated using (user_id = auth.uid() or lsl2_is_admin());
drop policy if exists "lsl2_pred_insert" on lsl2_predictions;
create policy "lsl2_pred_insert" on lsl2_predictions for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from lsl2_matches m where m.id = match_id and m.status = 'upcoming' and m.kickoff > now()));
drop policy if exists "lsl2_pred_update" on lsl2_predictions;
create policy "lsl2_pred_update" on lsl2_predictions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and exists (select 1 from lsl2_matches m where m.id = match_id and m.status = 'upcoming' and m.kickoff > now()));
revoke insert, update on lsl2_predictions from authenticated;
grant insert (user_id, match_id, home, away) on lsl2_predictions to authenticated;
grant update (home, away) on lsl2_predictions to authenticated;

grant select on lsl2_leaderboard to anon, authenticated;
grant execute on function lsl2_set_role(uuid, text), lsl2_settle_all() to authenticated;
revoke execute on function lsl2_settle_match(text) from public, anon, authenticated;
