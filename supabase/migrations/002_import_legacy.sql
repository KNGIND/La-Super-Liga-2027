-- ============================================================
-- La Súper Liga 2027 · Migración 002: copiar los datos de la app anterior
-- ------------------------------------------------------------
-- Lee la fila id=1 de la tabla vieja lsl_state (JSON con toda la liga) y la reparte en las tablas lsl2_*.
-- • NO modifica ni borra lsl_state: queda intacta como respaldo.
-- • Es idempotente: si la corrés de nuevo, actualiza lo que ya existe (no duplica).
-- • Ejecutala DESPUÉS de 001_core.sql. Requiere que lsl_state exista y tenga datos.
-- NOTA: esta migración fue escrita a partir del formato de data.js del ZIP; probala primero en un
-- proyecto de pruebas o revisá los conteos del final (select de verificación).
-- ============================================================
do $$
declare s jsonb;
begin
  select data into s from lsl_state where id = 1;
  if s is null then raise exception 'lsl_state (id=1) está vacía: no hay nada que importar'; end if;

  -- Liga
  update lsl2_league set
    name = coalesce(s#>>'{league,name}', name), short = coalesce(s#>>'{league,short}', short),
    season = coalesce(s#>>'{league,season}', season), season_status = coalesce(s#>>'{league,seasonStatus}', season_status),
    tagline = coalesce(s#>>'{league,tagline}', ''), info = coalesce(s#>>'{league,info}', ''), rules = coalesce(s#>>'{league,rules}', ''),
    points_win = coalesce((s#>>'{league,pointsWin}')::int, 3), points_draw = coalesce((s#>>'{league,pointsDraw}')::int, 1),
    points_loss = coalesce((s#>>'{league,pointsLoss}')::int, 0), zone_top = coalesce((s#>>'{league,zoneTop}')::int, 0),
    zone_bottom = coalesce((s#>>'{league,zoneBottom}')::int, 0), logo = coalesce(s#>>'{league,logo}', '')
  where id = 1;

  -- Temporada actual
  insert into lsl2_seasons (id, name, status, current)
  values ('s' || coalesce((regexp_match(coalesce(s#>>'{league,season}',''), '\d+'))[1], '1'), coalesce(s#>>'{league,season}', 'Temporada 1'), coalesce(s#>>'{league,seasonStatus}', ''), true)
  on conflict (id) do update set name = excluded.name, status = excluded.status;

  -- Competiciones: la liga + una por cada copa distinta + amistosos
  insert into lsl2_competitions (id, name, kind) values ('liga', coalesce(s#>>'{league,name}', 'Liga'), 'liga')
    on conflict (id) do update set name = excluded.name;
  insert into lsl2_competitions (id, name, kind)
  select distinct 'copa-' || trim(both '-' from regexp_replace(translate(lower(m->>'cup'), 'áéíóúñü', 'aeiounu'), '[^a-z0-9]+', '-', 'g')),
         coalesce(nullif(m->>'cup',''), 'Copa'), 'copa'
  from jsonb_array_elements(s->'matches') m where m->>'comp' = 'copa'
  on conflict (id) do nothing;
  if exists (select 1 from jsonb_array_elements(s->'matches') m where coalesce(m->>'comp','') not in ('liga','copa')) then
    insert into lsl2_competitions (id, name, kind) values ('amistosos', 'Amistosos', 'amistoso') on conflict (id) do nothing;
  end if;

  -- Equipos y jugadores (plantel)
  insert into lsl2_teams (id, name, short, color, color2, logo, adjust)
  select t->>'id', t->>'name', coalesce(t->>'short',''), coalesce(t->>'color','#3B82F6'), coalesce(t->>'color2','#FFFFFF'), coalesce(t->>'logo',''), coalesce((t->>'adj')::int, 0)
  from jsonb_array_elements(s->'teams') t
  on conflict (id) do update set name = excluded.name, short = excluded.short, color = excluded.color, color2 = excluded.color2, logo = excluded.logo, adjust = excluded.adjust;

  insert into lsl2_players (id, team_id, number, name, pos)
  select (t->>'id') || '-p' || (p->>'n'), t->>'id', (p->>'n')::int, p->>'name',
         case when p->>'pos' in ('POR','DEF','MED','DEL') then p->>'pos' else '' end
  from jsonb_array_elements(s->'teams') t cross join lateral jsonb_array_elements(coalesce(t->'squad','[]'::jsonb)) p
  on conflict (id) do update set number = excluded.number, name = excluded.name, pos = excluded.pos;

  -- Canales
  insert into lsl2_channels (id, name, logo)
  select c->>'id', c->>'name', coalesce(c->>'logo','') from jsonb_array_elements(coalesce(s->'channels','[]'::jsonb)) c
  on conflict (id) do update set name = excluded.name, logo = excluded.logo;

  -- Partidos (las fechas viejas no tenían zona horaria: se toman como hora de Argentina)
  insert into lsl2_matches (id, season_id, competition_id, round, leg, first_leg, home_id, away_id, kickoff, status, minute, home_score, away_score, pens,
                            stadium, channel_id, room, home_formation, away_formation, home_lineup, away_lineup, events, notes)
  select m->>'id',
         's' || coalesce((regexp_match(coalesce(s#>>'{league,season}',''), '\d+'))[1], '1'),
         case when m->>'comp' = 'liga' then 'liga'
              when m->>'comp' = 'copa' then 'copa-' || trim(both '-' from regexp_replace(translate(lower(m->>'cup'), 'áéíóúñü', 'aeiounu'), '[^a-z0-9]+', '-', 'g'))
              else 'amistosos' end,
         coalesce(m->>'round',''),
         case when coalesce(m->>'round','') ~* 'vuelta' or coalesce((m->>'leg2')::boolean, false) then 'vuelta'
              when coalesce(m->>'round','') ~* '[·\-–]\s*ida\s*$' then 'ida' end,
         coalesce(m->>'firstLeg',''), m->>'home', m->>'away',
         ((m->>'date')::timestamp) at time zone 'America/Argentina/Buenos_Aires',
         coalesce(m->>'status','upcoming'), coalesce(nullif(m->>'minute','')::int, 0),
         case when m->>'status' = 'upcoming' then null else coalesce((m->>'hs')::int, 0) end,
         case when m->>'status' = 'upcoming' then null else coalesce((m->>'as')::int, 0) end,
         coalesce(m->>'pens',''), coalesce(m->>'stadium',''), coalesce(m->>'channel',''), coalesce(m->>'room',''),
         coalesce(m->>'hf',''), coalesce(m->>'af',''),
         coalesce((select jsonb_agg(jsonb_build_object('number', (x->>'n')::int, 'name', x->>'name', 'pos', coalesce(x->>'pos',''))) from jsonb_array_elements(coalesce(m->'hl','[]'::jsonb)) x), '[]'::jsonb),
         coalesce((select jsonb_agg(jsonb_build_object('number', (x->>'n')::int, 'name', x->>'name', 'pos', coalesce(x->>'pos',''))) from jsonb_array_elements(coalesce(m->'al','[]'::jsonb)) x), '[]'::jsonb),
         coalesce((select jsonb_agg(jsonb_build_object('minute', coalesce((e->>'min')::int, 0), 'type', e->>'type', 'side', case when e->>'side' = 'h' then 'home' else 'away' end, 'player', coalesce(e->>'player',''))) from jsonb_array_elements(coalesce(m->'events','[]'::jsonb)) e), '[]'::jsonb),
         coalesce(m->>'notes','')
  from jsonb_array_elements(s->'matches') m
  on conflict (id) do update set round = excluded.round, leg = excluded.leg, kickoff = excluded.kickoff, status = excluded.status, minute = excluded.minute,
    home_score = excluded.home_score, away_score = excluded.away_score, pens = excluded.pens, home_lineup = excluded.home_lineup,
    away_lineup = excluded.away_lineup, events = excluded.events, notes = excluded.notes;

  -- Noticias
  insert into lsl2_news (id, kind, title, category, summary, body, image, published_at)
  select n->>'id', 'news', n->>'title', coalesce(n->>'cat','Noticias'), coalesce(n->>'summary',''), coalesce(n->>'body',''), coalesce(n->>'img',''),
         coalesce(((n->>'date')::timestamp) at time zone 'America/Argentina/Buenos_Aires', now())
  from jsonb_array_elements(coalesce(s->'news','[]'::jsonb)) n
  on conflict (id) do update set title = excluded.title, category = excluded.category, summary = excluded.summary, body = excluded.body, image = excluded.image;

  -- Sanciones
  insert into lsl2_sanctions (id, player, team_id, type, duration, notes)
  select x->>'id', x->>'player', coalesce(x->>'team',''), coalesce(x->>'type','yellow'), coalesce(x->>'duration',''), coalesce(x->>'notes','')
  from jsonb_array_elements(coalesce(s->'sanctions','[]'::jsonb)) x
  on conflict (id) do update set player = excluded.player, team_id = excluded.team_id, type = excluded.type, duration = excluded.duration, notes = excluded.notes;
end $$;

-- Verificación: comparar con lo que tenías (8 equipos, 112 jugadores, 41 partidos, 5 noticias en el ZIP de referencia)
select (select count(*) from lsl2_teams) as equipos, (select count(*) from lsl2_players) as jugadores,
       (select count(*) from lsl2_matches) as partidos, (select count(*) from lsl2_news) as noticias,
       (select count(*) from lsl2_competitions) as competiciones;
