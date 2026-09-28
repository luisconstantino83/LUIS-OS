-- ============================================================================
-- LUIS OS — CARRERA PROFESIONAL
-- Servicio social → Titulación → Repaso Mecatrónica → CV → LinkedIn →
-- Portafolio → Búsqueda de empleo (+ Interview Lab).
--
-- Reutiliza: hábito "carrera", Skills / Knowledge Map, Lab (portafolio) y Weekly Reset.
-- Incluye el bucket privado de archivos (documentos) con acceso solo a tu carpeta.
-- Ejecutar después de 0001–0005.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- ARCHIVOS PRIVADOS (Supabase Storage): cada usuario solo accede a su carpeta
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('private', 'private', false, 10485760,
        array['application/pdf','image/jpeg','image/png','image/webp','image/heic',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword'])
on conflict (id) do nothing;

create policy "private: own folder select" on storage.objects for select to authenticated
  using (bucket_id = 'private' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "private: own folder insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'private' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "private: own folder update" on storage.objects for update to authenticated
  using (bucket_id = 'private' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "private: own folder delete" on storage.objects for delete to authenticated
  using (bucket_id = 'private' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- CONFIGURACIÓN Y ETAPAS
-- ---------------------------------------------------------------------------
create table public.career_settings (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  required_hours    numeric(6,1) not null default 480 check (required_hours > 0),
  prior_hours       numeric(6,1) not null default 0 check (prior_hours >= 0),  -- horas hechas antes de usar la app
  institution       text,
  program           text,
  supervisor        text,
  service_start     date,
  target_end        date,
  updated_at        timestamptz not null default now()
);
create trigger career_settings_touch before update on public.career_settings
  for each row execute function public.touch_updated_at();

create table public.career_stages (
  user_id       uuid not null references auth.users (id) on delete cascade,
  key           text not null check (key in ('servicio','titulacion','repaso','cv','linkedin','portafolio','empleo')),
  status        text not null default 'pendiente' check (status in ('pendiente','en_curso','completado')),
  target_date   date,
  completed_on  date,
  notes         text,
  primary key (user_id, key)
);

-- ---------------------------------------------------------------------------
-- SERVICIO SOCIAL: registro de horas
-- ---------------------------------------------------------------------------
create table public.service_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  log_date    date not null,
  hours       numeric(4,1) not null check (hours > 0 and hours <= 24),
  activity    text,
  validated   boolean not null default false,   -- firmado / reconocido por la institución
  created_at  timestamptz not null default now()
);
create index service_logs_user_date_idx on public.service_logs (user_id, log_date);

-- ---------------------------------------------------------------------------
-- PENDIENTES / CHECKLIST, DOCUMENTOS, CONTACTOS
-- ---------------------------------------------------------------------------
create table public.career_tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  stage_key   text not null check (stage_key in ('servicio','titulacion','repaso','cv','linkedin','portafolio','empleo')),
  title       text not null check (length(trim(title)) between 1 and 160),
  done        boolean not null default false,
  due_date    date,
  notes       text,
  sort_order  smallint not null default 100,
  created_at  timestamptz not null default now()
);
create index career_tasks_user_idx on public.career_tasks (user_id, stage_key, sort_order);

create table public.career_documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  stage_key   text not null check (stage_key in ('servicio','titulacion','repaso','cv','linkedin','portafolio','empleo')),
  name        text not null check (length(trim(name)) between 1 and 120),
  status      text not null default 'pendiente' check (status in ('pendiente','en_tramite','listo')),
  due_date    date,
  file_path   text check (file_path is null or file_path ~ ('^' || user_id::text || '/')),
  file_name   text,
  url         text check (url is null or url ~* '^https?://'),
  notes       text,
  created_at  timestamptz not null default now()
);

create table public.career_contacts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null check (length(trim(name)) between 1 and 100),
  role          text,
  organization  text,
  email         text,
  phone         text,
  stage_key     text check (stage_key in ('servicio','titulacion','repaso','cv','linkedin','portafolio','empleo')),
  last_contact  date,
  notes         text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- BÚSQUEDA DE EMPLEO
-- ---------------------------------------------------------------------------
create table public.job_applications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  company       text not null check (length(trim(company)) between 1 and 100),
  position      text not null check (length(trim(position)) between 1 and 120),
  location      text,
  url           text check (url is null or url ~* '^https?://'),
  status        text not null default 'guardada' check (status in
                  ('guardada','aplicada','entrevista','prueba_tecnica','oferta','aceptada','rechazada','descartada')),
  applied_on    date,
  next_step     text,
  next_date     date,
  contact       text,
  salary_range  text,
  language      text check (language in ('es','en','de','otro')),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger job_applications_touch before update on public.job_applications
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- INTERVIEW LAB (no memorizar respuestas robóticas: tu versión → versión mejorada)
-- ---------------------------------------------------------------------------
create table public.interview_questions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  category         text not null check (category in ('tecnica','conductual','troubleshooting','ingles')),
  question         text not null check (length(trim(question)) between 1 and 500),
  my_answer        text,
  improved_answer  text,
  skill_id         uuid references public.skills (id) on delete set null,
  difficulty       smallint not null default 2 check (difficulty between 1 and 3),
  practiced_count  smallint not null default 0,
  last_practiced   date,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Integridad y RLS
-- ---------------------------------------------------------------------------
create or replace function public.check_career_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare j jsonb := to_jsonb(new);
begin
  if j->>'skill_id' is not null
     and (select user_id from public.skills where id = (j->>'skill_id')::uuid) is distinct from new.user_id then
    raise exception 'El registro relacionado no pertenece a este usuario';
  end if;
  return new;
end $$;
create trigger interview_questions_owner before insert or update on public.interview_questions
  for each row execute function public.check_career_owner();

do $$
declare t text;
begin
  foreach t in array array['career_settings','career_stages','service_logs','career_tasks','career_documents',
                           'career_contacts','job_applications','interview_questions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all to authenticated
                    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- SEEDS: etapas y checklist base (los requisitos exactos dependen de tu universidad)
-- ---------------------------------------------------------------------------
create or replace function public.seed_career(uid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.career_settings (user_id) values (uid) on conflict do nothing;
  insert into public.career_stages (user_id, key, status)
  select uid, k, case when k = 'servicio' then 'en_curso' else 'pendiente' end
  from unnest(array['servicio','titulacion','repaso','cv','linkedin','portafolio','empleo']) as k
  on conflict do nothing;

  if exists (select 1 from public.career_tasks where user_id = uid) then return; end if;
  insert into public.career_tasks (user_id, stage_key, title, sort_order) values
    (uid, 'servicio',   'Confirmar requisitos y formatos con tu universidad', 1),
    (uid, 'servicio',   'Carta de aceptación de la institución', 2),
    (uid, 'servicio',   'Plan / programa de trabajo', 3),
    (uid, 'servicio',   'Reportes periódicos (según tu universidad)', 4),
    (uid, 'servicio',   'Carta de terminación', 5),
    (uid, 'servicio',   'Constancia de liberación', 6),
    (uid, 'titulacion', 'Revisar modalidades de titulación disponibles', 1),
    (uid, 'titulacion', 'Lista oficial de requisitos (confirmar con servicios escolares)', 2),
    (uid, 'titulacion', 'Elegir modalidad', 3),
    (uid, 'titulacion', 'Reunir documentos', 4),
    (uid, 'titulacion', 'Pagos y trámites', 5),
    (uid, 'titulacion', 'Fecha de examen / acto / trámite final', 6),
    (uid, 'repaso',     'Seguir la ruta "Quiero volver a dominar Mecatrónica"', 1),
    (uid, 'repaso',     'Terminar 3 proyectos del Lab nivel 1', 2),
    (uid, 'repaso',     'Terminar 2 proyectos del Lab nivel 2', 3),
    (uid, 'cv',         'Estructura: perfil, experiencia, proyectos, skills, formación', 1),
    (uid, 'cv',         'Convertir tu experiencia de liderazgo en logros medibles', 2),
    (uid, 'cv',         'Agregar proyectos del Lab con evidencia', 3),
    (uid, 'cv',         'Versión en inglés', 4),
    (uid, 'linkedin',   'Foto profesional y titular', 1),
    (uid, 'linkedin',   'Sección "Acerca de"', 2),
    (uid, 'linkedin',   'Experiencia y proyectos', 3),
    (uid, 'linkedin',   'Skills con evidencia', 4),
    (uid, 'portafolio', 'Elegir 3 proyectos para mostrar', 1),
    (uid, 'portafolio', 'Documentar: problema, diseño, resultado, lecciones', 2),
    (uid, 'portafolio', 'Marcar proyectos del Lab como públicos', 3),
    (uid, 'empleo',     'Lista de 20 empresas objetivo', 1),
    (uid, 'empleo',     'Practicar 10 preguntas en el Interview Lab', 2),
    (uid, 'empleo',     'Primeras 5 aplicaciones', 3);
end $$;

create or replace function public.handle_new_user_career()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_career(new.id);
  return new;
end $$;
create trigger on_auth_user_created_career after insert on auth.users
  for each row execute function public.handle_new_user_career();

revoke execute on function public.seed_career(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user_career() from public, anon, authenticated;
revoke execute on function public.check_career_owner() from public, anon, authenticated;

do $$ begin perform public.seed_career(id) from auth.users; end $$;

commit;

notify pgrst, 'reload schema';
