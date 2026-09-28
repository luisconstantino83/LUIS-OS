-- ============================================================================
-- LUIS OS — Módulo MONSE × DAZN (mini agencia + portafolio)
-- Ejecutar DESPUÉS de 0001_init.sql, en el SQL Editor de Supabase.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- CAMPAÑAS / COLABORACIONES (DAZN Playmakers, Prime Video/Kreatornow, marcas…)
-- ---------------------------------------------------------------------------
create table public.campaigns (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  brand           text not null check (length(trim(brand)) between 1 and 80),
  program         text,                    -- ej. "DAZN Playmakers", "Kreatornow"
  contact_name    text,
  contact_email   text,
  brief           text,
  deliverables    text,                    -- uno por línea
  deadline        date,
  payment_amount  numeric(12,2) check (payment_amount is null or payment_amount >= 0),
  payment_currency text not null default 'MXN' check (payment_currency in ('MXN','USD','EUR')),
  paid_at         date,
  status          text not null default 'contactada' check (status in
                    ('contactada','negociacion','aceptada','produccion','enviada','aprobada','publicada','pagada')),
  links           text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index campaigns_user_idx on public.campaigns (user_id, status);
create trigger campaigns_touch before update on public.campaigns
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- PRODUCCIONES (un evento o sesión tratado como producción completa)
-- ---------------------------------------------------------------------------
create table public.productions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  owner        text not null default 'monse' check (owner in ('luis','monse')),
  campaign_id  uuid references public.campaigns (id) on delete set null,
  title        text not null check (length(trim(title)) between 1 and 120),
  event_date   date,
  location     text,
  status       text not null default 'planeacion'
                 check (status in ('planeacion','grabacion','postproduccion','terminada')),
  concept      text,
  story_beats  text,       -- estructura narrativa, uno por línea
  refs         text,       -- referencias / links
  hooks        text,
  shot_list    text,
  gear         text,
  planned_outputs text,    -- vlog, reels, carrusel, stories, mini documental…
  learnings    text,       -- qué aprendí (filmmaking) al terminar
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index productions_user_idx on public.productions (user_id, event_date);
create trigger productions_touch before update on public.productions
  for each row execute function public.touch_updated_at();

create table public.production_tasks (
  id             uuid primary key default gen_random_uuid(),
  production_id  uuid not null references public.productions (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  phase          text not null check (phase in ('antes','durante','despues')),
  title          text not null check (length(trim(title)) between 1 and 120),
  done           boolean not null default false,
  sort_order     smallint not null default 0,
  created_at     timestamptz not null default now()
);
create index production_tasks_prod_idx on public.production_tasks (production_id, phase, sort_order);

-- ---------------------------------------------------------------------------
-- HITOS (ruta aspiracional, ej. Super Bowl 2027 — no es una garantía)
-- ---------------------------------------------------------------------------
create table public.milestones (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  area         text not null default 'monse' check (area in ('monse','luis')),
  period_label text not null,          -- "SEP–OCT 2026"
  target_date  date,                   -- fin del periodo, para ordenar
  title        text not null,
  description  text,
  done         boolean not null default false,
  created_at   timestamptz not null default now()
);
create index milestones_user_idx on public.milestones (user_id, area, target_date);

-- ---------------------------------------------------------------------------
-- CONTENIDO: vínculo con producción / campaña, formato y portafolio
-- ---------------------------------------------------------------------------
alter table public.content_items
  add column production_id  uuid references public.productions (id) on delete set null,
  add column campaign_id    uuid references public.campaigns (id) on delete set null,
  add column format         text check (format in
                              ('reel','tiktok','short','carrusel','foto','stories','video','vlog','mini_doc')),
  add column in_portfolio   boolean not null default false,
  add column portfolio_note text,
  add column roles          text[] not null default '{}';   -- qué hice: grabación, edición, color…
create index content_production_idx on public.content_items (production_id);
create index content_campaign_idx on public.content_items (campaign_id);
create index content_portfolio_idx on public.content_items (user_id) where in_portfolio;

-- ---------------------------------------------------------------------------
-- Integridad: las relaciones deben ser del mismo usuario
-- ---------------------------------------------------------------------------
create or replace function public.check_monse_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare o uuid;
begin
  if tg_table_name = 'production_tasks' then
    select user_id into o from public.productions where id = new.production_id;
    if o is distinct from new.user_id then raise exception 'El registro relacionado no pertenece a este usuario'; end if;
  elsif tg_table_name = 'productions' then
    if new.campaign_id is not null then
      select user_id into o from public.campaigns where id = new.campaign_id;
      if o is distinct from new.user_id then raise exception 'El registro relacionado no pertenece a este usuario'; end if;
    end if;
  elsif tg_table_name = 'content_items' then
    if new.production_id is not null then
      select user_id into o from public.productions where id = new.production_id;
      if o is distinct from new.user_id then raise exception 'El registro relacionado no pertenece a este usuario'; end if;
    end if;
    if new.campaign_id is not null then
      select user_id into o from public.campaigns where id = new.campaign_id;
      if o is distinct from new.user_id then raise exception 'El registro relacionado no pertenece a este usuario'; end if;
    end if;
  end if;
  return new;
end $$;

create trigger production_tasks_owner before insert or update on public.production_tasks
  for each row execute function public.check_monse_owner();
create trigger productions_owner before insert or update on public.productions
  for each row execute function public.check_monse_owner();
create trigger content_items_owner before insert or update of production_id, campaign_id, user_id on public.content_items
  for each row execute function public.check_monse_owner();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.campaigns        enable row level security;
alter table public.productions      enable row level security;
alter table public.production_tasks enable row level security;
alter table public.milestones       enable row level security;

do $$
declare t text;
begin
  foreach t in array array['campaigns','productions','production_tasks','milestones'] loop
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Ruta inicial (editable). Se marca en la app como aspiracional.
-- ---------------------------------------------------------------------------
create or replace function public.seed_monse_defaults(uid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.milestones where user_id = uid and area = 'monse') then return; end if;
  insert into public.milestones (user_id, area, period_label, target_date, title, description) values
    (uid, 'monse', 'SEP–OCT 2026', '2026-10-31', 'Consistencia y calidad',
       'Publicar con ritmo estable y subir la calidad de cada pieza (audio, luz, edición).'),
    (uid, 'monse', 'NOV 2026', '2026-11-30', 'Federado en León como producción fuerte',
       'Cobertura completa: viaje, preparación, partido, emociones, resultado. Vlog + Reels + fotos + mini documental.'),
    (uid, 'monse', 'DIC 2026', '2026-12-31', 'Media kit y portafolio',
       'Reunir los mejores resultados y métricas en un media kit de Monse y en tu portafolio.'),
    (uid, 'monse', 'ENE 2027', '2027-01-31', 'Presentación profesional',
       'Material suficiente para presentar a Monse y, cuando corresponda, proponer coberturas y viajar como su creador.'),
    (uid, 'monse', 'FEB 2027', '2027-02-28', 'Super Bowl 2027 (aspiracional)',
       'Meta aspiracional, no garantizada. Se busca con trabajo previo y propuestas profesionales.');
end $$;

create or replace function public.handle_new_user_monse()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_monse_defaults(new.id);
  return new;
end $$;

create trigger on_auth_user_created_monse
  after insert on auth.users
  for each row execute function public.handle_new_user_monse();

revoke execute on function public.seed_monse_defaults(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user_monse() from public, anon, authenticated;
revoke execute on function public.check_monse_owner() from public, anon, authenticated;

do $$ begin perform public.seed_monse_defaults(id) from auth.users; end $$;

-- Refresca la caché de la API
notify pgrst, 'reload schema';
