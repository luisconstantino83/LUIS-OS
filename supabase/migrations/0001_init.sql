-- ============================================================================
-- LUIS OS — esquema inicial (MVP)
-- Postgres / Supabase. Todas las tablas son multiusuario (user_id + RLS).
-- Ejecutar completo en: Supabase Dashboard → SQL Editor → New query → Run.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- PERFIL + METAS (una fila por usuario)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                       uuid primary key references auth.users (id) on delete cascade,
  display_name             text not null default 'Luis',
  timezone                 text not null default 'America/Matamoros',
  -- Hora a la que "empieza" tu día. 4 = lo que registres a la 1:30 am cuenta para el día anterior.
  day_start_hour           smallint not null default 4 check (day_start_hour between 0 and 8),
  monthly_income_estimate  numeric(12,2) check (monthly_income_estimate is null or monthly_income_estimate >= 0),
  -- Metas diarias
  sleep_goal_hours         numeric(3,1) not null default 7   check (sleep_goal_hours between 4 and 12),
  water_goal_glasses       smallint     not null default 8   check (water_goal_glasses between 1 and 20),
  pages_goal_daily         smallint     not null default 10  check (pages_goal_daily between 1 and 200),
  meditation_goal_min      smallint     not null default 10  check (meditation_goal_min between 1 and 120),
  -- Metas semanales
  sleep_nights_target      smallint not null default 7  check (sleep_nights_target between 0 and 7),
  workouts_target          smallint not null default 4  check (workouts_target between 0 and 7),
  pages_week_target        smallint not null default 50 check (pages_week_target between 0 and 2000),
  meditation_days_target   smallint not null default 5  check (meditation_days_target between 0 and 7),
  hygiene_days_target      smallint not null default 7  check (hygiene_days_target between 0 and 7),
  content_week_target      smallint not null default 1  check (content_week_target between 0 and 50),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- HORARIO SEMANAL (plantilla editable). weekday: 0 = domingo … 6 = sábado
-- ---------------------------------------------------------------------------
create table public.week_template (
  user_id        uuid not null references auth.users (id) on delete cascade,
  weekday        smallint not null check (weekday between 0 and 6),
  day_type       text not null check (day_type in ('crecimiento','mantenimiento','carrera','creador','reset')),
  work_start     time,
  work_end       time,
  workout_focus  text,           -- null = no hay entrenamiento ese día
  primary key (user_id, weekday),
  check ((work_start is null) = (work_end is null))
);

-- ---------------------------------------------------------------------------
-- REGISTRO DIARIO (una fila por usuario y día lógico)
-- ---------------------------------------------------------------------------
create table public.daily_logs (
  user_id         uuid not null references auth.users (id) on delete cascade,
  log_date        date not null,
  sleep_hours     numeric(3,1) check (sleep_hours is null or sleep_hours between 0 and 16),
  water_glasses   smallint not null default 0 check (water_glasses between 0 and 30),
  food_quality    text check (food_quality in ('excelente','buena','regular','mala')),
  energy          smallint check (energy between 1 and 5),
  pages_read      smallint not null default 0 check (pages_read between 0 and 1000),
  meditation_min  smallint not null default 0 check (meditation_min between 0 and 600),
  -- Modo "Hoy estoy agotado"
  exhausted       boolean not null default false,
  basic_hygiene   boolean not null default false,
  ate_decently    boolean not null default false,
  going_to_sleep  boolean not null default false,
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (user_id, log_date)
);
create trigger daily_logs_touch before update on public.daily_logs
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- HÁBITOS
--   group_key: 'manana' / 'noche' (checklist de higiene) o 'general'
--   active_days: días de la semana en los que se muestra (0 = domingo)
--   target_per_week: meta semanal (para progreso). Null = no cuenta en semanal
-- ---------------------------------------------------------------------------
create table public.habits (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  key              text,                      -- identificador estable para hábitos del sistema
  name             text not null check (length(trim(name)) between 1 and 80),
  group_key        text not null default 'general' check (group_key in ('manana','noche','general')),
  active_days      smallint[] not null default '{0,1,2,3,4,5,6}',
  target_per_week  smallint check (target_per_week is null or target_per_week between 1 and 7),
  sort_order       smallint not null default 0,
  archived         boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (user_id, key)
);
create index habits_user_idx on public.habits (user_id) where not archived;

create table public.habit_logs (
  habit_id  uuid not null references public.habits (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  log_date  date not null,
  created_at timestamptz not null default now(),
  primary key (habit_id, log_date)
);
create index habit_logs_user_date_idx on public.habit_logs (user_id, log_date);

-- ---------------------------------------------------------------------------
-- 3 PRIORIDADES DEL DÍA — el límite de 3 lo impone la base de datos
-- ---------------------------------------------------------------------------
create table public.priorities (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  log_date   date not null,
  position   smallint not null check (position between 1 and 3),
  title      text not null check (length(trim(title)) between 1 and 140),
  done       boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, log_date, position)
);

-- ---------------------------------------------------------------------------
-- ENTRENAMIENTOS
-- ---------------------------------------------------------------------------
create table public.workouts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  log_date      date not null,
  focus         text not null check (length(trim(focus)) between 1 and 80),
  duration_min  smallint check (duration_min is null or duration_min between 1 and 600),
  notes         text,
  created_at    timestamptz not null default now()
);
create index workouts_user_date_idx on public.workouts (user_id, log_date desc);

create table public.workout_sets (
  id          uuid primary key default gen_random_uuid(),
  workout_id  uuid not null references public.workouts (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  exercise    text not null check (length(trim(exercise)) between 1 and 80),
  set_number  smallint not null default 1 check (set_number between 1 and 50),
  reps        smallint check (reps is null or reps between 0 and 1000),
  weight_kg   numeric(6,2) check (weight_kg is null or weight_kg between 0 and 1000),
  notes       text,
  created_at  timestamptz not null default now()
);
create index workout_sets_workout_idx on public.workout_sets (workout_id);
create index workout_sets_user_ex_idx on public.workout_sets (user_id, lower(exercise));

-- ---------------------------------------------------------------------------
-- FINANZAS
-- ---------------------------------------------------------------------------
create table public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  tx_date     date not null,
  kind        text not null check (kind in ('ingreso','gasto')),
  category    text not null,
  amount      numeric(12,2) not null check (amount > 0),
  note        text,
  created_at  timestamptz not null default now(),
  check (
    (kind = 'ingreso' and category in ('salario','propinas','filmmaking','redes','otros')) or
    (kind = 'gasto'   and category in ('casa','comida','transporte','tarjetas','suscripciones',
                                       'cuidado_personal','equipo','viajes','gustos','otros'))
  )
);
create index transactions_user_date_idx on public.transactions (user_id, tx_date desc);

create table public.cards (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  bank             text not null check (length(trim(bank)) between 1 and 60),
  nickname         text,
  balance          numeric(12,2) not null default 0,
  cut_day          smallint check (cut_day between 1 and 31),
  due_day          smallint check (due_day between 1 and 31),
  monthly_payment  numeric(12,2) check (monthly_payment is null or monthly_payment >= 0),
  archived         boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger cards_touch before update on public.cards
  for each row execute function public.touch_updated_at();

create table public.msi_purchases (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  card_id          uuid references public.cards (id) on delete set null,
  product          text not null check (length(trim(product)) between 1 and 120),
  total_price      numeric(12,2) not null check (total_price > 0),
  months           smallint not null check (months between 1 and 60),
  monthly_payment  numeric(12,2) generated always as (round(total_price / months, 2)) stored,
  -- Mes del primer pago (se usa el día 1 de ese mes)
  start_date       date not null,
  end_date         date generated always as (
                     (date_trunc('month', start_date::timestamp) + make_interval(months => months - 1))::date
                   ) stored,
  -- Respuestas del filtro "¿Vale la pena?"
  worth_it         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);
create index msi_user_idx on public.msi_purchases (user_id, end_date);

create table public.savings_goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  category    text not null check (category in ('emergencia','viajes','equipo','automovil','educacion','otros')),
  name        text not null check (length(trim(name)) between 1 and 80),
  target      numeric(12,2) not null check (target > 0),
  saved       numeric(12,2) not null default 0 check (saved >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger savings_goals_touch before update on public.savings_goals
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- CONTENT STUDIO (Luis / Monse)
-- ---------------------------------------------------------------------------
create table public.content_items (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  owner             text not null default 'luis' check (owner in ('luis','monse')),
  platform          text not null check (platform in ('youtube','instagram','tiktok')),
  title             text not null check (length(trim(title)) between 1 and 140),
  status            text not null default 'idea'
                      check (status in ('idea','guion','grabacion','edicion','programado','publicado')),
  hook              text,
  concept           text,
  script            text,
  shot_list         text,
  caption           text,
  cta               text,
  hashtags          text,
  scheduled_date    date,
  published_date    date,
  url               text,
  views             integer check (views is null or views >= 0),
  likes             integer check (likes is null or likes >= 0),
  comments          integer check (comments is null or comments >= 0),
  shares            integer check (shares is null or shares >= 0),
  saves             integer check (saves is null or saves >= 0),
  followers_gained  integer,
  -- Engagement aproximado = interacciones / vistas × 100
  engagement_rate   numeric(7,2) generated always as (
                      case when coalesce(views, 0) > 0 then
                        round(((coalesce(likes,0) + coalesce(comments,0) + coalesce(shares,0) + coalesce(saves,0))::numeric
                               / views) * 100, 2)
                      end
                    ) stored,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index content_user_idx on public.content_items (user_id, status);
create trigger content_touch before update on public.content_items
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- WEEKLY RESET (semana domingo → sábado; week_start = domingo)
-- ---------------------------------------------------------------------------
create table public.weekly_reviews (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  week_start         date not null check (extract(dow from week_start) = 0),
  metrics            jsonb not null default '{}'::jsonb,   -- foto de las métricas automáticas
  career_progress    text,
  work_went_well     text,
  work_repeated_problem text,
  feeling            text,
  feeling_score      smallint check (feeling_score between 1 and 5),
  wins               text,
  problems           text,
  lessons            text,
  next_week          text,
  top_priorities     text[] not null default '{}'
                       check (cardinality(top_priorities) <= 3),
  completed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, week_start)
);
create trigger weekly_reviews_touch before update on public.weekly_reviews
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- INTEGRIDAD: filas hijas deben pertenecer al mismo usuario que su padre
-- ============================================================================
create or replace function public.check_child_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare parent_owner uuid;
begin
  if tg_table_name = 'habit_logs' then
    select user_id into parent_owner from public.habits where id = new.habit_id;
  elsif tg_table_name = 'workout_sets' then
    select user_id into parent_owner from public.workouts where id = new.workout_id;
  elsif tg_table_name = 'msi_purchases' then
    if new.card_id is null then return new; end if;
    select user_id into parent_owner from public.cards where id = new.card_id;
  end if;
  if parent_owner is distinct from new.user_id then
    raise exception 'El registro relacionado no pertenece a este usuario';
  end if;
  return new;
end $$;

create trigger habit_logs_owner   before insert or update on public.habit_logs
  for each row execute function public.check_child_owner();
create trigger workout_sets_owner before insert or update on public.workout_sets
  for each row execute function public.check_child_owner();
create trigger msi_owner          before insert or update on public.msi_purchases
  for each row execute function public.check_child_owner();

-- ============================================================================
-- ROW LEVEL SECURITY — cada usuario solo ve y modifica lo suyo
-- ============================================================================
alter table public.profiles       enable row level security;
alter table public.week_template  enable row level security;
alter table public.daily_logs     enable row level security;
alter table public.habits         enable row level security;
alter table public.habit_logs     enable row level security;
alter table public.priorities     enable row level security;
alter table public.workouts       enable row level security;
alter table public.workout_sets   enable row level security;
alter table public.transactions   enable row level security;
alter table public.cards          enable row level security;
alter table public.msi_purchases  enable row level security;
alter table public.savings_goals  enable row level security;
alter table public.content_items  enable row level security;
alter table public.weekly_reviews enable row level security;

create policy "own profile" on public.profiles
  for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array[
    'week_template','daily_logs','habits','habit_logs','priorities','workouts','workout_sets',
    'transactions','cards','msi_purchases','savings_goals','content_items','weekly_reviews'
  ] loop
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- ============================================================================
-- ALTA DE USUARIO: crea perfil, horario y hábitos por defecto
-- ============================================================================
create or replace function public.seed_user_defaults(uid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (uid) on conflict (id) do nothing;

  -- Horario real de Luis (editable en Ajustes)
  insert into public.week_template (user_id, weekday, day_type, work_start, work_end, workout_focus) values
    (uid, 0, 'mantenimiento', '10:00', '01:00', null),
    (uid, 1, 'crecimiento',   '17:00', '01:00', 'Pecho + hombros + tríceps'),
    (uid, 2, 'mantenimiento', '10:00', '01:00', null),
    (uid, 3, 'carrera',       '17:00', '01:00', 'Espalda + bíceps'),
    (uid, 4, 'creador',       '17:00', '01:00', 'Pierna'),
    (uid, 5, 'mantenimiento', '10:00', '01:00', null),
    (uid, 6, 'reset',         null,    null,    'Full body / rezagados')
  on conflict do nothing;

  insert into public.habits (user_id, key, name, group_key, active_days, target_per_week, sort_order) values
    -- Higiene mañana
    (uid, 'h_cepillado_am',  'Cepillado 2 min',           'manana', '{0,1,2,3,4,5,6}', null, 1),
    (uid, 'h_lengua',        'Lengua',                    'manana', '{0,1,2,3,4,5,6}', null, 2),
    (uid, 'h_limpiador',     'Limpiador facial',          'manana', '{0,1,2,3,4,5,6}', null, 3),
    (uid, 'h_hidratante',    'Hidratante',                'manana', '{0,1,2,3,4,5,6}', null, 4),
    (uid, 'h_protector',     'Protector solar',           'manana', '{0,1,2,3,4,5,6}', null, 5),
    (uid, 'h_cabello',       'Arreglar cabello/barba',    'manana', '{0,1,2,3,4,5,6}', null, 6),
    -- Higiene noche
    (uid, 'h_hilo',          'Hilo dental',               'noche',  '{0,1,2,3,4,5,6}', null, 1),
    (uid, 'h_cepillado_pm',  'Cepillado 2 min',           'noche',  '{0,1,2,3,4,5,6}', null, 2),
    (uid, 'h_limpieza_pm',   'Limpieza facial',           'noche',  '{0,1,2,3,4,5,6}', null, 3),
    (uid, 'h_skincare',      'Skincare',                  'noche',  '{0,1,2,3,4,5,6}', null, 4),
    -- Crecimiento (solo en días con espacio; nunca en doble turno)
    (uid, 'ingles',          'Inglés · 30 min',           'general', '{1,3,4,6}', 4, 1),
    (uid, 'filmmaking',      'Filmmaking · práctica',     'general', '{1,4,6}',   3, 2),
    (uid, 'carrera',         'Avance servicio/titulación','general', '{3,6}',     1, 3),
    (uid, 'finanzas',        'Revisar finanzas',          'general', '{6}',       1, 4)
  on conflict do nothing;
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_user_defaults(new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Las funciones de sistema no deben ser invocables desde la API
revoke execute on function public.seed_user_defaults(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.check_child_owner() from public, anon, authenticated;

-- Por si ya existían usuarios antes de correr este script
do $$ begin perform public.seed_user_defaults(id) from auth.users; end $$;
