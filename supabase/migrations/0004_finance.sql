-- ============================================================================
-- LUIS OS — LIBERTAD FINANCIERA · Fase 1
-- Plan semanal, ahorro semanal, sobres y metas (con préstamos internos),
-- Credit Card Hub, MSI Manager, deudas y cuentas.
--
-- Reutiliza las tablas existentes (cards, msi_purchases, savings_goals, transactions)
-- y conserva sus datos. Ejecutar después de 0001–0003.
--
-- Privacidad: nunca se guarda el número completo de tarjeta, CVV, NIP ni contraseñas.
-- Solo banco, nombre y (opcional) últimos 4 dígitos.
-- ============================================================================

begin;

-- Nueva categoría de gasto para pagos de deudas (préstamos, familia)
alter table public.transactions drop constraint transactions_check;
alter table public.transactions add constraint transactions_check check (
  (kind = 'ingreso' and category in ('salario','propinas','filmmaking','redes','otros')) or
  (kind = 'gasto'   and category in ('casa','comida','transporte','tarjetas','deudas','suscripciones',
                                     'cuidado_personal','equipo','viajes','gustos','otros'))
);

-- ---------------------------------------------------------------------------
-- TARJETAS: campos del Credit Card Hub
-- ---------------------------------------------------------------------------
alter table public.cards
  add column credit_limit        numeric(12,2) check (credit_limit is null or credit_limit >= 0),
  add column min_payment         numeric(12,2) check (min_payment is null or min_payment >= 0),
  add column no_interest_payment numeric(12,2) check (no_interest_payment is null or no_interest_payment >= 0),
  add column annual_fee          numeric(12,2) check (annual_fee is null or annual_fee >= 0),
  add column cat_rate            numeric(7,2)  check (cat_rate is null or cat_rate >= 0),
  add column interest_rate       numeric(7,2)  check (interest_rate is null or interest_rate >= 0),
  add column last4               text check (last4 is null or last4 ~ '^[0-9]{4}$'),
  add column alert_utilization   smallint not null default 30 check (alert_utilization between 1 and 100);

comment on column public.cards.balance is 'Saldo utilizado (lo reporta el usuario; baja al registrar un pago real).';
comment on column public.cards.last4 is 'Solo últimos 4 dígitos, opcional. Nunca el número completo.';

-- Pagos reales a tarjetas
create table public.card_payments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  card_id         uuid not null references public.cards (id) on delete cascade,
  amount          numeric(12,2) not null check (amount > 0),
  paid_on         date not null default current_date,
  period_month    date not null check (extract(day from period_month) = 1),  -- mes que cubre
  transaction_id  uuid references public.transactions (id) on delete set null,
  note            text,
  created_at      timestamptz not null default now()
);
create index card_payments_card_idx on public.card_payments (card_id, period_month);

create or replace function public.apply_card_payment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.cards set balance = balance - new.amount where id = new.card_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.cards set balance = balance + old.amount where id = old.card_id;
    return old;
  end if;
  return null;
end $$;
create trigger card_payments_balance after insert or delete on public.card_payments
  for each row execute function public.apply_card_payment();

-- ---------------------------------------------------------------------------
-- MSI: enganche y monto financiado
-- ---------------------------------------------------------------------------
alter table public.msi_purchases
  add column down_payment numeric(12,2) not null default 0 check (down_payment >= 0);
alter table public.msi_purchases drop column monthly_payment;
alter table public.msi_purchases
  add column monthly_payment numeric(12,2) generated always as (round((total_price - down_payment) / months, 2)) stored,
  add constraint msi_down_lt_total check (down_payment < total_price);
comment on column public.msi_purchases.total_price is 'Precio original. Monto financiado = total_price - down_payment.';

-- ---------------------------------------------------------------------------
-- SOBRES + METAS (reutiliza savings_goals)
-- ---------------------------------------------------------------------------
alter table public.savings_goals drop constraint savings_goals_category_check;
alter table public.savings_goals add constraint savings_goals_category_check check (category in
  ('emergencia','viajes','casa','automovil','educacion','filmmaking','tecnologia','gustos','visa','equipo','otros'));
alter table public.savings_goals alter column target drop not null;
alter table public.savings_goals
  add column target_date date,
  add column is_bucket   boolean not null default false,   -- true = sobre base; false = meta concreta
  add column sort_order  smallint not null default 100,
  add column archived    boolean not null default false;

-- Préstamos entre mis propios sobres (NO son ingreso)
create table public.internal_loans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  from_goal_id  uuid not null references public.savings_goals (id) on delete cascade,
  to_goal_id    uuid references public.savings_goals (id) on delete set null,
  purpose       text,
  amount        numeric(12,2) not null check (amount > 0),
  repaid        numeric(12,2) not null default 0 check (repaid >= 0),
  status        text not null default 'pendiente' check (status in ('pendiente','repuesto')),
  taken_on      date not null default current_date,
  created_at    timestamptz not null default now(),
  check (to_goal_id is null or to_goal_id <> from_goal_id)
);

-- Historial de movimientos de cada sobre / meta. El saldo (saved) se calcula de aquí.
create table public.goal_movements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  goal_id     uuid not null references public.savings_goals (id) on delete cascade,
  kind        text not null check (kind in ('aporte','retiro','prestamo_salida','prestamo_entrada','prestamo_regreso','ajuste')),
  amount      numeric(12,2) not null check (amount > 0),
  moved_on    date not null default current_date,
  loan_id     uuid references public.internal_loans (id) on delete cascade,
  note        text,
  created_at  timestamptz not null default now(),
  check ((kind like 'prestamo_%') = (loan_id is not null))
);
create index goal_movements_goal_idx on public.goal_movements (goal_id, moved_on);
create index goal_movements_user_date_idx on public.goal_movements (user_id, moved_on);

-- Saldos iniciales: los datos existentes pasan al historial como "ajuste"
insert into public.goal_movements (user_id, goal_id, kind, amount, moved_on, note)
select user_id, id, 'ajuste', saved, created_at::date, 'Saldo inicial'
from public.savings_goals where saved > 0;

create or replace function public.movement_sign(k text)
returns int language sql immutable as $$
  select case when k in ('aporte','prestamo_entrada','prestamo_regreso','ajuste') then 1 else -1 end;
$$;

create or replace function public.recompute_goal_balance()
returns trigger language plpgsql security definer set search_path = public as $$
declare gid uuid; lid uuid;
begin
  gid := coalesce(new.goal_id, old.goal_id);
  update public.savings_goals g
     set saved = coalesce((select sum(public.movement_sign(m.kind) * m.amount)
                           from public.goal_movements m where m.goal_id = gid), 0)
   where g.id = gid;
  lid := coalesce(new.loan_id, old.loan_id);
  if lid is not null then
    update public.internal_loans l
       set repaid = coalesce((select sum(m.amount) from public.goal_movements m
                              where m.loan_id = lid and m.kind = 'prestamo_regreso'), 0)
     where l.id = lid;
    update public.internal_loans set status = case when repaid >= amount then 'repuesto' else 'pendiente' end
     where id = lid;
  end if;
  return null;
end $$;
create trigger goal_movements_balance after insert or update or delete on public.goal_movements
  for each row execute function public.recompute_goal_balance();

-- El saldo solo cambia vía movimientos (no se puede editar directo desde la API)
revoke insert, update on public.savings_goals from anon, authenticated;
grant insert (user_id, category, name, target, target_date, is_bucket, sort_order, archived)
  on public.savings_goals to authenticated;
grant update (category, name, target, target_date, is_bucket, sort_order, archived)
  on public.savings_goals to authenticated;
revoke update on public.internal_loans from anon, authenticated;
grant update (purpose) on public.internal_loans to authenticated;

-- Tomar prestado de un sobre (atómico)
create or replace function public.take_internal_loan(
  p_from uuid, p_amount numeric, p_purpose text default null, p_to uuid default null, p_date date default current_date
) returns uuid language plpgsql security invoker set search_path = public as $$
declare lid uuid; uid uuid := auth.uid();
begin
  insert into public.internal_loans (user_id, from_goal_id, to_goal_id, purpose, amount, taken_on)
  values (uid, p_from, p_to, p_purpose, p_amount, p_date) returning id into lid;
  insert into public.goal_movements (user_id, goal_id, kind, amount, moved_on, loan_id, note)
  values (uid, p_from, 'prestamo_salida', p_amount, p_date, lid, p_purpose);
  if p_to is not null then
    insert into public.goal_movements (user_id, goal_id, kind, amount, moved_on, loan_id, note)
    values (uid, p_to, 'prestamo_entrada', p_amount, p_date, lid, p_purpose);
  end if;
  return lid;
end $$;

-- Reponer (total o parcial)
create or replace function public.repay_internal_loan(p_loan uuid, p_amount numeric, p_date date default current_date)
returns void language plpgsql security invoker set search_path = public as $$
declare l public.internal_loans;
begin
  select * into l from public.internal_loans where id = p_loan;
  if l.id is null then raise exception 'Préstamo no encontrado'; end if;
  if p_amount > l.amount - l.repaid then raise exception 'FINANCE: el monto excede lo pendiente de reponer'; end if;
  insert into public.goal_movements (user_id, goal_id, kind, amount, moved_on, loan_id, note)
  values (l.user_id, l.from_goal_id, 'prestamo_regreso', p_amount, p_date, l.id, 'Reposición');
end $$;

-- ---------------------------------------------------------------------------
-- PLAN SEMANAL (el ingreso se lee de transactions: no se captura dos veces)
-- ---------------------------------------------------------------------------
create table public.weekly_money_plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  week_start  date not null check (extract(dow from week_start) = 0),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, week_start)
);
create trigger weekly_money_plans_touch before update on public.weekly_money_plans
  for each row execute function public.touch_updated_at();

create table public.weekly_allocations (
  plan_id   uuid not null references public.weekly_money_plans (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  category  text not null check (category in
              ('tarjetas','casa','necesidades','ahorro','emergencia','viajes','educacion','equipo','gustos','inversion','otros')),
  planned   numeric(12,2) not null default 0 check (planned >= 0),
  actual    numeric(12,2) check (actual is null or actual >= 0),
  goal_id   uuid references public.savings_goals (id) on delete set null,
  primary key (plan_id, category)
);

create table public.finance_settings (
  user_id                     uuid primary key references auth.users (id) on delete cascade,
  first_week_cards            boolean not null default true,
  -- % sugerido por categoría para el reparto automático (se aplica sobre lo que queda)
  alloc_template              jsonb not null default
    '{"casa":15,"necesidades":20,"ahorro":10,"emergencia":10,"viajes":5,"educacion":5,"equipo":5,"gustos":10,"inversion":0,"otros":0}'::jsonb,
  essential_monthly_expenses  numeric(12,2) check (essential_monthly_expenses is null or essential_monthly_expenses >= 0),
  emergency_levels            smallint[] not null default '{1,3,6}',
  updated_at                  timestamptz not null default now()
);
create trigger finance_settings_touch before update on public.finance_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- DEUDAS (tarjetas y MSI se leen de sus tablas; aquí préstamos, familia, otros)
-- ---------------------------------------------------------------------------
create table public.debts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  kind             text not null check (kind in ('prestamo','familia','otro')),
  creditor         text not null check (length(trim(creditor)) between 1 and 80),
  original_amount  numeric(12,2) not null check (original_amount > 0),
  current_balance  numeric(12,2) not null default 0 check (current_balance >= 0),
  payment_amount   numeric(12,2) check (payment_amount is null or payment_amount >= 0),
  payment_day      smallint check (payment_day between 1 and 31),
  interest_rate    numeric(7,2) check (interest_rate is null or interest_rate >= 0),  -- % anual
  notes            text,
  closed           boolean not null default false,
  created_at       timestamptz not null default now()
);

create table public.debt_payments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  debt_id         uuid not null references public.debts (id) on delete cascade,
  amount          numeric(12,2) not null check (amount > 0),
  paid_on         date not null default current_date,
  transaction_id  uuid references public.transactions (id) on delete set null,
  note            text,
  created_at      timestamptz not null default now()
);

create or replace function public.recompute_debt_balance()
returns trigger language plpgsql security definer set search_path = public as $$
declare did uuid := coalesce(new.debt_id, old.debt_id); bal numeric;
begin
  select d.original_amount - coalesce((select sum(p.amount) from public.debt_payments p where p.debt_id = did), 0)
    into bal from public.debts d where d.id = did;
  if bal < 0 then raise exception 'FINANCE: el pago excede el saldo de la deuda'; end if;
  update public.debts set current_balance = bal, closed = (bal = 0) where id = did;
  return null;
end $$;
create trigger debt_payments_balance after insert or delete on public.debt_payments
  for each row execute function public.recompute_debt_balance();

create or replace function public.init_debt_balance()
returns trigger language plpgsql as $$
begin
  new.current_balance := new.original_amount;
  return new;
end $$;
create trigger debts_init before insert on public.debts
  for each row execute function public.init_debt_balance();

-- El saldo de una deuda solo cambia registrando pagos reales
revoke update on public.debts from anon, authenticated;
grant update (kind, creditor, payment_amount, payment_day, interest_rate, notes) on public.debts to authenticated;

-- ---------------------------------------------------------------------------
-- CUENTAS (efectivo, banco…) para "Dinero total" y, después, patrimonio
-- ---------------------------------------------------------------------------
create table public.money_accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 60),
  kind        text not null check (kind in ('efectivo','banco','ahorro','inversion','otro')),
  balance     numeric(12,2) not null default 0,
  archived    boolean not null default false,
  updated_at  timestamptz not null default now()
);
create trigger money_accounts_touch before update on public.money_accounts
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- WEEKLY RESET: Money scorecard
-- ---------------------------------------------------------------------------
alter table public.weekly_reviews
  add column money_win           text,
  add column money_problem       text,
  add column next_money_move     text,
  add column unexpected_expenses text;

-- ---------------------------------------------------------------------------
-- Integridad y RLS
-- ---------------------------------------------------------------------------
create or replace function public.check_finance_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare j jsonb := to_jsonb(new); ok boolean := true; uid uuid := new.user_id;
begin
  if j->>'card_id' is not null then
    ok := ok and (select user_id from public.cards where id = (j->>'card_id')::uuid) is not distinct from uid; end if;
  if j->>'goal_id' is not null then
    ok := ok and (select user_id from public.savings_goals where id = (j->>'goal_id')::uuid) is not distinct from uid; end if;
  if j->>'from_goal_id' is not null then
    ok := ok and (select user_id from public.savings_goals where id = (j->>'from_goal_id')::uuid) is not distinct from uid; end if;
  if j->>'to_goal_id' is not null then
    ok := ok and (select user_id from public.savings_goals where id = (j->>'to_goal_id')::uuid) is not distinct from uid; end if;
  if j->>'loan_id' is not null then
    ok := ok and (select user_id from public.internal_loans where id = (j->>'loan_id')::uuid) is not distinct from uid; end if;
  if j->>'plan_id' is not null then
    ok := ok and (select user_id from public.weekly_money_plans where id = (j->>'plan_id')::uuid) is not distinct from uid; end if;
  if j->>'debt_id' is not null then
    ok := ok and (select user_id from public.debts where id = (j->>'debt_id')::uuid) is not distinct from uid; end if;
  if j->>'transaction_id' is not null then
    ok := ok and (select user_id from public.transactions where id = (j->>'transaction_id')::uuid) is not distinct from uid; end if;
  if not ok then raise exception 'El registro relacionado no pertenece a este usuario'; end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['card_payments','internal_loans','goal_movements','weekly_money_plans','weekly_allocations',
                           'finance_settings','debts','debt_payments','money_accounts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    if t <> 'finance_settings' then
      execute format('create trigger %I before insert or update on public.%I for each row execute function public.check_finance_owner()',
                     t || '_owner', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Sobres base por usuario
-- ---------------------------------------------------------------------------
create or replace function public.seed_finance_defaults(uid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.finance_settings (user_id) values (uid) on conflict do nothing;
  if exists (select 1 from public.savings_goals where user_id = uid and is_bucket) then return; end if;
  insert into public.savings_goals (user_id, category, name, is_bucket, sort_order) values
    (uid, 'emergencia', 'Emergencia', true, 1),
    (uid, 'viajes',     'Viajes', true, 2),
    (uid, 'casa',       'Casa', true, 3),
    (uid, 'automovil',  'Automóvil', true, 4),
    (uid, 'educacion',  'Educación', true, 5),
    (uid, 'filmmaking', 'Filmmaking', true, 6),
    (uid, 'tecnologia', 'Tecnología', true, 7),
    (uid, 'gustos',     'Gustos', true, 8),
    (uid, 'visa',       'Visa / trámites', true, 9),
    (uid, 'otros',      'Otros', true, 10);
end $$;

create or replace function public.handle_new_user_finance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_finance_defaults(new.id);
  return new;
end $$;
create trigger on_auth_user_created_finance after insert on auth.users
  for each row execute function public.handle_new_user_finance();

revoke execute on function public.seed_finance_defaults(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user_finance() from public, anon, authenticated;
revoke execute on function public.check_finance_owner() from public, anon, authenticated;
revoke execute on function public.recompute_goal_balance() from public, anon, authenticated;
revoke execute on function public.recompute_debt_balance() from public, anon, authenticated;
revoke execute on function public.apply_card_payment() from public, anon, authenticated;

do $$ begin perform public.seed_finance_defaults(id) from auth.users; end $$;

commit;

notify pgrst, 'reload schema';
