-- ============================================================================
-- LUIS OS — SKILLS / SKILL TREE
-- APRENDER → PRACTICAR → CREAR → PUBLICAR → ANALIZAR
-- Ejecutar DESPUÉS de 0001 y 0002, en el SQL Editor de Supabase.
--
-- Niveles (0–5): No iniciado · Fundamentos · Aprendiendo · Practicando · Competente · Avanzado
-- Un nivel solo puede subir si existe evidencia suficiente (lo verifica la base de datos).
-- ============================================================================

begin;

create table public.skill_categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  key         text not null,
  name        text not null,
  sort_order  smallint not null default 0,
  unique (user_id, key)
);

create table public.skills (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  category_id  uuid not null references public.skill_categories (id) on delete cascade,
  key          text not null,
  name         text not null check (length(trim(name)) between 1 and 80),
  level        smallint not null default 0 check (level between 0 and 5),
  next_goal    text,
  notes        text,
  sort_order   smallint not null default 100,
  archived     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (category_id, key)
);
create index skills_user_idx on public.skills (user_id, category_id);
create trigger skills_touch before update on public.skills
  for each row execute function public.touch_updated_at();

-- Evidencia: learn (aprendí) · practice (practiqué) · apply (apliqué en algo real) · reflect (reflexión)
create table public.skill_evidence (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  skill_id       uuid not null references public.skills (id) on delete cascade,
  kind           text not null check (kind in ('learn','practice','apply','reflect')),
  occurred_on    date not null default current_date,
  minutes        smallint check (minutes is null or minutes between 1 and 1440),
  title          text,
  notes          text,
  url            text check (url is null or url ~* '^https?://'),
  content_id     uuid references public.content_items (id) on delete set null,
  production_id  uuid references public.productions (id) on delete set null,
  project_id     uuid,   -- FK agregada abajo (skill_projects)
  created_at     timestamptz not null default now(),
  -- Reglas mínimas por tipo: sin esto no cuenta como evidencia
  check (kind <> 'learn'    or length(trim(coalesce(title, notes, ''))) > 0),
  check (kind <> 'practice' or coalesce(minutes, 0) > 0),
  check (kind <> 'apply'    or url is not null or content_id is not null or production_id is not null or project_id is not null),
  check (kind <> 'reflect'  or length(trim(coalesce(notes, ''))) >= 10),
  -- Una sola evidencia de cada tipo por skill y pieza / producción (evita duplicados automáticos)
  unique (skill_id, kind, content_id),
  unique (skill_id, kind, production_id)
);
create index skill_evidence_skill_idx on public.skill_evidence (skill_id, kind);
create index skill_evidence_user_date_idx on public.skill_evidence (user_id, occurred_on);

create table public.skill_level_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  skill_id    uuid not null references public.skills (id) on delete cascade,
  from_level  smallint not null,
  to_level    smallint not null,
  changed_at  timestamptz not null default now()
);
create index skill_level_log_user_idx on public.skill_level_log (user_id, changed_at);

-- Recursos: máximo 3 activos por skill
create table public.skill_resources (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  skill_id    uuid not null references public.skills (id) on delete cascade,
  kind        text not null check (kind in ('youtube','curso','libro','articulo','notas','ejercicio')),
  title       text not null check (length(trim(title)) between 1 and 140),
  url         text check (url is null or url ~* '^https?://'),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index skill_resources_skill_idx on public.skill_resources (skill_id) where active;

-- Rutas de aprendizaje
create table public.learning_paths (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  key               text,
  title             text not null,
  goal              text,
  practice_project  text,
  expected_result   text,
  target_level      smallint not null default 3 check (target_level between 1 and 5),
  sort_order        smallint not null default 0,
  created_at        timestamptz not null default now(),
  unique (user_id, key)
);

create table public.learning_path_steps (
  path_id   uuid not null references public.learning_paths (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  skill_id  uuid not null references public.skills (id) on delete cascade,
  position  smallint not null,
  primary key (path_id, skill_id)
);

-- Proyectos reales (aprendizaje basado en proyectos)
create table public.skill_projects (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  key            text,
  title          text not null check (length(trim(title)) between 1 and 120),
  objective      text,
  sequence       smallint,           -- orden sugerido dentro de su ruta
  path_key       text,
  status         text not null default 'sugerido' check (status in ('sugerido','activo','terminado')),
  production_id  uuid references public.productions (id) on delete set null,
  started_on     date,
  completed_on   date,
  created_at     timestamptz not null default now(),
  unique (user_id, key)
);

create table public.skill_project_skills (
  project_id  uuid not null references public.skill_projects (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  skill_id    uuid not null references public.skills (id) on delete cascade,
  primary key (project_id, skill_id)
);

alter table public.skill_evidence
  add constraint skill_evidence_project_fk foreign key (project_id) references public.skill_projects (id) on delete set null;

-- Skills a practicar en una producción (Monse × DAZN)
create table public.production_skills (
  production_id  uuid not null references public.productions (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  skill_id       uuid not null references public.skills (id) on delete cascade,
  primary key (production_id, skill_id)
);

-- Skills demostradas en una pieza (portafolio)
create table public.content_skills (
  content_id  uuid not null references public.content_items (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  skill_id    uuid not null references public.skills (id) on delete cascade,
  primary key (content_id, skill_id)
);

-- Skill of the Week
create table public.skill_weeks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  week_start    date not null check (extract(dow from week_start) = 0),
  skill_id      uuid not null references public.skills (id) on delete cascade,
  objective     text,
  micro_lesson  text,
  exercise      text,
  apply_to      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, week_start)
);
create trigger skill_weeks_touch before update on public.skill_weeks
  for each row execute function public.touch_updated_at();

-- Revisión post-producción
alter table public.productions
  add column review_failed        text,
  add column review_missing_shot  text,
  add column review_repeat        text,
  add column review_differently   text,
  add column review_next_skill_id uuid references public.skills (id) on delete set null,
  add column reviewed_at          timestamptz;

-- Weekly Reset: aprendizaje
alter table public.weekly_reviews
  add column learned_text   text,
  add column next_skill_id  uuid references public.skills (id) on delete set null;

-- ============================================================================
-- REGLAS DE NIVEL (evidencia requerida)
-- ============================================================================
-- security invoker: desde la API, RLS limita la evidencia a la del propio usuario.
create or replace function public.skill_max_level(sid uuid)
returns smallint language sql stable security invoker set search_path = public as $$
  with c as (
    select
      count(*) filter (where kind = 'learn')                 as learn_n,
      count(*) filter (where kind = 'practice')              as practice_n,
      coalesce(sum(minutes) filter (where kind = 'practice'), 0) as practice_min,
      count(*) filter (where kind = 'apply')                 as apply_n,
      count(*) filter (where kind = 'reflect')               as reflect_n
    from public.skill_evidence where skill_id = sid
  )
  select (case
    when learn_n >= 1 and practice_n >= 3 and apply_n >= 6 and reflect_n >= 3 and practice_min >= 600 then 5
    when learn_n >= 1 and practice_n >= 3 and apply_n >= 3 and reflect_n >= 1 then 4
    when learn_n >= 1 and practice_n >= 3 and apply_n >= 1 then 3
    when learn_n >= 1 and practice_n >= 1 then 2
    when learn_n >= 1 then 1
    else 0 end)::smallint
  from c;
$$;

create or replace function public.enforce_skill_level()
returns trigger language plpgsql security definer set search_path = public as $$
declare allowed smallint;
begin
  if tg_op = 'INSERT' then
    if new.level > 0 then raise exception 'Una skill nueva empieza en No iniciado'; end if;
    return new;
  end if;
  if new.level > old.level then
    allowed := public.skill_max_level(new.id);
    if new.level > allowed then
      raise exception 'SKILL_LEVEL: falta evidencia para ese nivel (máximo permitido: %)', allowed;
    end if;
  end if;
  if new.level <> old.level then
    insert into public.skill_level_log (user_id, skill_id, from_level, to_level)
    values (new.user_id, new.id, old.level, new.level);
  end if;
  return new;
end $$;

create trigger skills_level_rule before insert or update of level on public.skills
  for each row execute function public.enforce_skill_level();

-- Máximo 3 recursos activos por skill
create or replace function public.enforce_resource_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.active and (
    select count(*) from public.skill_resources
    where skill_id = new.skill_id and active and id <> new.id
  ) >= 3 then
    raise exception 'SKILL_RESOURCES: máximo 3 recursos activos por skill';
  end if;
  return new;
end $$;
create trigger skill_resources_limit before insert or update on public.skill_resources
  for each row execute function public.enforce_resource_limit();

-- Todas las relaciones deben pertenecer al mismo usuario
create or replace function public.check_skill_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ok boolean := true;
  j jsonb := to_jsonb(new);
  uid uuid := new.user_id;
begin
  -- to_jsonb evita referenciar columnas que la tabla no tiene
  if j ? 'skill_id' and tg_table_name <> 'skills' then
    ok := ok and (select user_id from public.skills where id = (j->>'skill_id')::uuid) is not distinct from uid;
  end if;
  if tg_table_name = 'skills' then
    ok := ok and (select user_id from public.skill_categories where id = (j->>'category_id')::uuid) is not distinct from uid;
  end if;
  if j->>'content_id' is not null then
    ok := ok and (select user_id from public.content_items where id = (j->>'content_id')::uuid) is not distinct from uid;
  end if;
  if j->>'production_id' is not null then
    ok := ok and (select user_id from public.productions where id = (j->>'production_id')::uuid) is not distinct from uid;
  end if;
  if j->>'project_id' is not null then
    ok := ok and (select user_id from public.skill_projects where id = (j->>'project_id')::uuid) is not distinct from uid;
  end if;
  if j->>'path_id' is not null then
    ok := ok and (select user_id from public.learning_paths where id = (j->>'path_id')::uuid) is not distinct from uid;
  end if;
  if not ok then
    raise exception 'El registro relacionado no pertenece a este usuario';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['skills','skill_evidence','skill_resources','learning_path_steps','skill_project_skills','production_skills','content_skills','skill_weeks'] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.check_skill_owner()', t || '_owner', t);
  end loop;
end $$;

-- ============================================================================
-- RLS
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array['skill_categories','skills','skill_evidence','skill_level_log','skill_resources','learning_paths',
                           'learning_path_steps','skill_projects','skill_project_skills','production_skills','content_skills','skill_weeks'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- El historial de niveles solo lo escribe el trigger
revoke insert, update, delete on public.skill_level_log from anon, authenticated;

-- ============================================================================
-- SEEDS por usuario
-- ============================================================================
create or replace function public.seed_skills(uid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.skill_categories (user_id, key, name, sort_order) values
    (uid, 'filmmaking', 'Filmmaking', 0),
    (uid, 'postproduction', 'Postproduction', 1),
    (uid, 'photography', 'Photography', 2),
    (uid, 'content', 'Content Creation', 3),
    (uid, 'english', 'English', 4),
    (uid, 'mechatronics', 'Mechatronics', 5),
    (uid, 'business', 'Business / Creator', 6),
    (uid, 'leadership', 'Leadership', 7)
  on conflict do nothing;

  insert into public.skills (user_id, category_id, key, name, sort_order)
  select uid, c.id, v.skey, v.sname, v.sort
  from (values
    ('filmmaking', 'camera-fundamentals', 'Camera Fundamentals', 0),
    ('filmmaking', 'exposure-triangle', 'Exposure Triangle', 1),
    ('filmmaking', 'frame-rates', 'Frame Rates', 2),
    ('filmmaking', 'shutter-speed', 'Shutter Speed', 3),
    ('filmmaking', 'iso', 'ISO', 4),
    ('filmmaking', 'aperture', 'Aperture', 5),
    ('filmmaking', 'white-balance', 'White Balance', 6),
    ('filmmaking', 'lenses', 'Lenses', 7),
    ('filmmaking', 'focus', 'Focus', 8),
    ('filmmaking', 'composition', 'Composition', 9),
    ('filmmaking', 'camera-movement', 'Camera Movement', 10),
    ('filmmaking', 'lighting', 'Lighting', 11),
    ('filmmaking', 'audio', 'Audio', 12),
    ('filmmaking', 'directing', 'Directing', 13),
    ('filmmaking', 'storytelling', 'Storytelling', 14),
    ('filmmaking', 'shot-lists', 'Shot Lists', 15),
    ('filmmaking', 'b-roll', 'B-Roll', 16),
    ('filmmaking', 'sports-filmmaking', 'Sports Filmmaking', 17),
    ('filmmaking', 'documentary', 'Documentary', 18),
    ('filmmaking', 'cinematic-vlogging', 'Cinematic Vlogging', 19),
    ('postproduction', 'davinci-resolve', 'DaVinci Resolve', 0),
    ('postproduction', 'premiere-pro', 'Premiere Pro', 1),
    ('postproduction', 'capcut', 'CapCut', 2),
    ('postproduction', 'media-organization', 'Media Organization', 3),
    ('postproduction', 'editing-fundamentals', 'Editing Fundamentals', 4),
    ('postproduction', 'pacing', 'Pacing', 5),
    ('postproduction', 'story-editing', 'Story Editing', 6),
    ('postproduction', 'transitions', 'Transitions', 7),
    ('postproduction', 'sound-design', 'Sound Design', 8),
    ('postproduction', 'music-editing', 'Music Editing', 9),
    ('postproduction', 'color-correction', 'Color Correction', 10),
    ('postproduction', 'color-grading', 'Color Grading', 11),
    ('postproduction', 'skin-tones', 'Skin Tones', 12),
    ('postproduction', 'subtitles', 'Subtitles', 13),
    ('postproduction', 'motion-graphics', 'Motion Graphics', 14),
    ('postproduction', 'export-codecs', 'Export / Codecs', 15),
    ('photography', 'manual-mode', 'Manual Mode', 0),
    ('photography', 'composition', 'Composition', 1),
    ('photography', 'portrait', 'Portrait', 2),
    ('photography', 'sports-photography', 'Sports Photography', 3),
    ('photography', 'action-photography', 'Action Photography', 4),
    ('photography', 'shutter-techniques', 'Shutter Techniques', 5),
    ('photography', 'raw', 'RAW', 6),
    ('photography', 'lightroom', 'Lightroom', 7),
    ('photography', 'camera-raw', 'Camera Raw', 8),
    ('photography', 'color', 'Color', 9),
    ('photography', 'culling', 'Culling', 10),
    ('photography', 'photo-storytelling', 'Photo Storytelling', 11),
    ('content', 'hooks', 'Hooks', 0),
    ('content', 'short-form-storytelling', 'Short-form Storytelling', 1),
    ('content', 'scriptwriting', 'Scriptwriting', 2),
    ('content', 'reels', 'Reels', 3),
    ('content', 'tiktok', 'TikTok', 4),
    ('content', 'youtube-shorts', 'YouTube Shorts', 5),
    ('content', 'long-form-youtube', 'Long-form YouTube', 6),
    ('content', 'thumbnails', 'Thumbnails', 7),
    ('content', 'titles', 'Titles', 8),
    ('content', 'captions', 'Captions', 9),
    ('content', 'cta', 'CTA', 10),
    ('content', 'audience-retention', 'Audience Retention', 11),
    ('content', 'analytics', 'Analytics', 12),
    ('content', 'personal-branding', 'Personal Branding', 13),
    ('content', 'content-strategy', 'Content Strategy', 14),
    ('content', 'community', 'Community', 15),
    ('content', 'brand-collaborations', 'Brand Collaborations', 16),
    ('content', 'media-kits', 'Media Kits', 17),
    ('content', 'negotiation', 'Negotiation', 18),
    ('english', 'listening', 'Listening', 0),
    ('english', 'speaking', 'Speaking', 1),
    ('english', 'reading', 'Reading', 2),
    ('english', 'writing', 'Writing', 3),
    ('english', 'pronunciation', 'Pronunciation', 4),
    ('english', 'vocabulary', 'Vocabulary', 5),
    ('english', 'grammar', 'Grammar', 6),
    ('english', 'conversation', 'Conversation', 7),
    ('mechatronics', 'electricity', 'Electricity', 0),
    ('mechatronics', 'electronics', 'Electronics', 1),
    ('mechatronics', 'plc', 'PLC', 2),
    ('mechatronics', 'automation', 'Automation', 3),
    ('mechatronics', 'control', 'Control', 4),
    ('mechatronics', 'sensors', 'Sensors', 5),
    ('mechatronics', 'motors', 'Motors', 6),
    ('mechatronics', 'pneumatics', 'Pneumatics', 7),
    ('mechatronics', 'hydraulics', 'Hydraulics', 8),
    ('mechatronics', 'programming', 'Programming', 9),
    ('mechatronics', 'cad', 'CAD', 10),
    ('mechatronics', 'robotics', 'Robotics', 11),
    ('mechatronics', 'industrial-maintenance', 'Industrial Maintenance', 12),
    ('mechatronics', 'troubleshooting', 'Troubleshooting', 13),
    ('business', 'sales', 'Sales', 0),
    ('business', 'pricing', 'Pricing', 1),
    ('business', 'client-management', 'Client Management', 2),
    ('business', 'negotiation', 'Negotiation', 3),
    ('business', 'brand-deals', 'Brand Deals', 4),
    ('business', 'contracts', 'Contracts', 5),
    ('business', 'portfolio', 'Portfolio', 6),
    ('business', 'personal-branding', 'Personal Branding', 7),
    ('business', 'marketing', 'Marketing', 8),
    ('business', 'financial-basics', 'Financial Basics', 9),
    ('leadership', 'communication', 'Communication', 0),
    ('leadership', 'delegation', 'Delegation', 1),
    ('leadership', 'conflict-management', 'Conflict Management', 2),
    ('leadership', 'feedback', 'Feedback', 3),
    ('leadership', 'team-management', 'Team Management', 4),
    ('leadership', 'operations', 'Operations', 5),
    ('leadership', 'decision-making', 'Decision Making', 6),
    ('leadership', 'process-design', 'Process Design', 7)
  ) as v(ckey, skey, sname, sort)
  join public.skill_categories c on c.user_id = uid and c.key = v.ckey
  on conflict do nothing;

  insert into public.learning_paths (user_id, key, title, goal, practice_project, expected_result, sort_order) values
    (uid, 'reels-deportivos', 'Quiero producir Reels deportivos profesionales', 'Reels deportivos con calidad cinematográfica para Monse y para ti.', '30-second Sports Film', 'Un Reel deportivo de 30 s publicado, con movimiento, sonido y color intencionales.', 0),
    (uid, 'filmmaker', 'Quiero convertirme en filmmaker', 'Dominar la cámara y contar historias completas.', 'Mini Documentary', 'Un mini documental de 60–90 s dirigido, grabado y editado por ti.', 1),
    (uid, 'davinci', 'Quiero editar profesionalmente en DaVinci', 'Flujo completo de edición, sonido y color en DaVinci Resolve.', 'Re-editar un Reel de Monse en DaVinci con color completo', 'Un proyecto terminado en DaVinci: organización, edición, mezcla, color y exportación correcta.', 2),
    (uid, 'ingles', 'Quiero hablar inglés', 'Comunicarte con seguridad en conversaciones reales.', 'Video de 60 s hablando en inglés', 'Poder sostener una conversación de 10 minutos y grabarte hablando con naturalidad.', 3),
    (uid, 'mecatronica', 'Quiero volver a dominar Mecatrónica', 'Recuperar la base técnica para buscar empleo en ingeniería.', 'Diseñar y simular un circuito de control con PLC', 'Un proyecto documentado (esquema + programa + video) para tu portafolio técnico.', 4),
    (uid, 'creador', 'Quiero crecer como creador', 'Construir tu marca personal con contenido que funciona.', 'Serie de 5 videos con análisis de métricas', 'Una serie publicada, con aprendizajes claros de qué funcionó y por qué.', 5)
  on conflict do nothing;

  insert into public.learning_path_steps (path_id, user_id, skill_id, position)
  select p.id, uid, s.id, v.pos
  from (values
    ('reels-deportivos', 'filmmaking', 'camera-fundamentals', 1),
    ('reels-deportivos', 'filmmaking', 'exposure-triangle', 2),
    ('reels-deportivos', 'filmmaking', 'composition', 3),
    ('reels-deportivos', 'filmmaking', 'camera-movement', 4),
    ('reels-deportivos', 'filmmaking', 'sports-filmmaking', 5),
    ('reels-deportivos', 'postproduction', 'editing-fundamentals', 6),
    ('reels-deportivos', 'postproduction', 'sound-design', 7),
    ('reels-deportivos', 'postproduction', 'color-grading', 8),
    ('reels-deportivos', 'filmmaking', 'storytelling', 9),
    ('filmmaker', 'filmmaking', 'camera-fundamentals', 1),
    ('filmmaker', 'filmmaking', 'exposure-triangle', 2),
    ('filmmaker', 'filmmaking', 'lenses', 3),
    ('filmmaker', 'filmmaking', 'focus', 4),
    ('filmmaker', 'filmmaking', 'composition', 5),
    ('filmmaker', 'filmmaking', 'lighting', 6),
    ('filmmaker', 'filmmaking', 'audio', 7),
    ('filmmaker', 'filmmaking', 'camera-movement', 8),
    ('filmmaker', 'filmmaking', 'storytelling', 9),
    ('filmmaker', 'filmmaking', 'shot-lists', 10),
    ('filmmaker', 'filmmaking', 'directing', 11),
    ('filmmaker', 'filmmaking', 'documentary', 12),
    ('davinci', 'postproduction', 'media-organization', 1),
    ('davinci', 'postproduction', 'davinci-resolve', 2),
    ('davinci', 'postproduction', 'editing-fundamentals', 3),
    ('davinci', 'postproduction', 'pacing', 4),
    ('davinci', 'postproduction', 'story-editing', 5),
    ('davinci', 'postproduction', 'sound-design', 6),
    ('davinci', 'postproduction', 'color-correction', 7),
    ('davinci', 'postproduction', 'color-grading', 8),
    ('davinci', 'postproduction', 'skin-tones', 9),
    ('davinci', 'postproduction', 'export-codecs', 10),
    ('ingles', 'english', 'listening', 1),
    ('ingles', 'english', 'vocabulary', 2),
    ('ingles', 'english', 'pronunciation', 3),
    ('ingles', 'english', 'speaking', 4),
    ('ingles', 'english', 'grammar', 5),
    ('ingles', 'english', 'reading', 6),
    ('ingles', 'english', 'writing', 7),
    ('ingles', 'english', 'conversation', 8),
    ('mecatronica', 'mechatronics', 'electricity', 1),
    ('mecatronica', 'mechatronics', 'electronics', 2),
    ('mecatronica', 'mechatronics', 'sensors', 3),
    ('mecatronica', 'mechatronics', 'motors', 4),
    ('mecatronica', 'mechatronics', 'control', 5),
    ('mecatronica', 'mechatronics', 'plc', 6),
    ('mecatronica', 'mechatronics', 'automation', 7),
    ('mecatronica', 'mechatronics', 'pneumatics', 8),
    ('mecatronica', 'mechatronics', 'hydraulics', 9),
    ('mecatronica', 'mechatronics', 'programming', 10),
    ('mecatronica', 'mechatronics', 'troubleshooting', 11),
    ('mecatronica', 'mechatronics', 'industrial-maintenance', 12),
    ('creador', 'content', 'hooks', 1),
    ('creador', 'content', 'short-form-storytelling', 2),
    ('creador', 'content', 'scriptwriting', 3),
    ('creador', 'content', 'reels', 4),
    ('creador', 'content', 'captions', 5),
    ('creador', 'content', 'cta', 6),
    ('creador', 'content', 'audience-retention', 7),
    ('creador', 'content', 'analytics', 8),
    ('creador', 'content', 'content-strategy', 9),
    ('creador', 'content', 'personal-branding', 10),
    ('creador', 'content', 'community', 11),
    ('creador', 'content', 'brand-collaborations', 12),
    ('creador', 'content', 'media-kits', 13)
  ) as v(pkey, ckey, skey, pos)
  join public.learning_paths p on p.user_id = uid and p.key = v.pkey
  join public.skill_categories c on c.user_id = uid and c.key = v.ckey
  join public.skills s on s.category_id = c.id and s.key = v.skey
  on conflict do nothing;

  insert into public.skill_projects (user_id, key, title, objective, sequence, path_key) values
    (uid, 'sports-film-30', '30-second Sports Film', 'Crear una pieza deportiva cinematográfica de 30 segundos.', 1, 'reels-deportivos'),
    (uid, 'athlete-story-60', '60-second Athlete Story', 'Contar la historia de una atleta (Monse) en 60 segundos, con arco narrativo.', 2, 'reels-deportivos'),
    (uid, 'full-match-story', 'Full Match Story', 'Cubrir un partido completo y contarlo de principio a fin (fotos + video).', 3, 'reels-deportivos'),
    (uid, 'mini-documentary', 'Mini Documentary', 'Un mini documental de 60–90 s con entrevista, B-roll y subtítulos.', 4, 'reels-deportivos')
  on conflict do nothing;

  insert into public.skill_project_skills (project_id, user_id, skill_id)
  select p.id, uid, s.id
  from (values
    ('sports-film-30', 'filmmaking', 'composition'),
    ('sports-film-30', 'filmmaking', 'camera-movement'),
    ('sports-film-30', 'filmmaking', 'sports-filmmaking'),
    ('sports-film-30', 'postproduction', 'editing-fundamentals'),
    ('sports-film-30', 'postproduction', 'sound-design'),
    ('sports-film-30', 'postproduction', 'color-grading'),
    ('athlete-story-60', 'filmmaking', 'storytelling'),
    ('athlete-story-60', 'filmmaking', 'sports-filmmaking'),
    ('athlete-story-60', 'filmmaking', 'audio'),
    ('athlete-story-60', 'postproduction', 'story-editing'),
    ('athlete-story-60', 'postproduction', 'music-editing'),
    ('athlete-story-60', 'postproduction', 'color-grading'),
    ('full-match-story', 'filmmaking', 'shot-lists'),
    ('full-match-story', 'filmmaking', 'b-roll'),
    ('full-match-story', 'filmmaking', 'sports-filmmaking'),
    ('full-match-story', 'postproduction', 'pacing'),
    ('full-match-story', 'postproduction', 'sound-design'),
    ('full-match-story', 'photography', 'sports-photography'),
    ('mini-documentary', 'filmmaking', 'documentary'),
    ('mini-documentary', 'filmmaking', 'directing'),
    ('mini-documentary', 'filmmaking', 'storytelling'),
    ('mini-documentary', 'filmmaking', 'audio'),
    ('mini-documentary', 'postproduction', 'story-editing'),
    ('mini-documentary', 'postproduction', 'color-grading'),
    ('mini-documentary', 'postproduction', 'subtitles')
  ) as v(pkey, ckey, skey)
  join public.skill_projects p on p.user_id = uid and p.key = v.pkey
  join public.skill_categories c on c.user_id = uid and c.key = v.ckey
  join public.skills s on s.category_id = c.id and s.key = v.skey
  on conflict do nothing;

end $$;

create or replace function public.handle_new_user_skills()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_skills(new.id);
  return new;
end $$;

create trigger on_auth_user_created_skills
  after insert on auth.users
  for each row execute function public.handle_new_user_skills();

revoke execute on function public.seed_skills(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user_skills() from public, anon, authenticated;
revoke execute on function public.enforce_skill_level() from public, anon, authenticated;
revoke execute on function public.enforce_resource_limit() from public, anon, authenticated;
revoke execute on function public.check_skill_owner() from public, anon, authenticated;
do $$ begin perform public.seed_skills(id) from auth.users; end $$;

commit;

notify pgrst, 'reload schema';
