import "server-only";
import type { AppContext } from "./session";
import { addDays, monthStart, weekStart } from "./dates";
import { msiRemaining } from "./finance";
import {
  cardMonthlyNeed,
  cardsCoverage,
  daysBetween,
  nextDayOfMonth,
  planningMonth,
  type CardLike,
} from "./money";
import type { MsiPurchase } from "./types";

export interface FinanceSettings {
  user_id: string;
  first_week_cards: boolean;
  alloc_template: Record<string, number>;
  essential_monthly_expenses: number | null;
  emergency_levels: number[];
}

export interface CardRow extends CardLike {
  last4: string | null;
  annual_fee: number | null;
  cat_rate: number | null;
  interest_rate: number | null;
  archived: boolean;
}

export interface GoalRow {
  id: string;
  category: string;
  name: string;
  target: number | null;
  saved: number;
  target_date: string | null;
  is_bucket: boolean;
  sort_order: number;
  archived: boolean;
}

export interface DebtRow {
  id: string;
  kind: "prestamo" | "familia" | "otro";
  creditor: string;
  original_amount: number;
  current_balance: number;
  payment_amount: number | null;
  payment_day: number | null;
  interest_rate: number | null;
  notes: string | null;
  closed: boolean;
}

export interface LoanRow {
  id: string;
  from_goal_id: string;
  to_goal_id: string | null;
  purpose: string | null;
  amount: number;
  repaid: number;
  status: "pendiente" | "repuesto";
  taken_on: string;
}

export async function getSettings(ctx: AppContext): Promise<FinanceSettings> {
  const { data } = await ctx.supabase.from("finance_settings").select("*").maybeSingle<FinanceSettings>();
  if (data) return data;
  const { data: created } = await ctx.supabase
    .from("finance_settings")
    .insert({ user_id: ctx.userId })
    .select("*")
    .single<FinanceSettings>();
  return (
    created ?? {
      user_id: ctx.userId,
      first_week_cards: true,
      alloc_template: {},
      essential_monthly_expenses: null,
      emergency_levels: [1, 3, 6],
    }
  );
}

export async function getCards(ctx: AppContext) {
  const { data } = await ctx.supabase.from("cards").select("*").eq("archived", false).order("created_at");
  return (data ?? []) as CardRow[];
}

export async function getGoals(ctx: AppContext) {
  const { data } = await ctx.supabase
    .from("savings_goals")
    .select("*")
    .eq("archived", false)
    .order("is_bucket", { ascending: false })
    .order("sort_order")
    .order("created_at");
  return (data ?? []) as GoalRow[];
}

export async function getMsis(ctx: AppContext) {
  const { data } = await ctx.supabase.from("msi_purchases").select("*").order("start_date", { ascending: false });
  return (data ?? []) as (MsiPurchase & { down_payment: number })[];
}

export async function getDebts(ctx: AppContext) {
  const { data } = await ctx.supabase.from("debts").select("*").order("closed").order("created_at");
  return (data ?? []) as DebtRow[];
}

export async function getLoans(ctx: AppContext) {
  const { data } = await ctx.supabase.from("internal_loans").select("*").order("taken_on", { ascending: false });
  return (data ?? []) as LoanRow[];
}

export async function getAccounts(ctx: AppContext) {
  const { data } = await ctx.supabase.from("money_accounts").select("*").eq("archived", false).order("updated_at");
  return (data ?? []) as { id: string; name: string; kind: string; balance: number; updated_at: string }[];
}

/** Estado de la estrategia "primera semana = tarjetas" para el mes de planeación. */
export async function getCardsStrategy(ctx: AppContext, forWeekStart: string, cards: CardRow[]) {
  const month = planningMonth(forWeekStart);
  const nextMonth = addDays(month, 32).slice(0, 8) + "01";
  const [{ data: allocs }, { data: pays }] = await Promise.all([
    ctx.supabase
      .from("weekly_allocations")
      .select("planned, weekly_money_plans!inner(week_start)")
      .eq("category", "tarjetas")
      .gte("weekly_money_plans.week_start", addDays(month, -6))
      .lt("weekly_money_plans.week_start", nextMonth),
    ctx.supabase.from("card_payments").select("amount").eq("period_month", month),
  ]);
  // Solo semanas cuyo "mes de planeación" es este mes
  const allocated = ((allocs ?? []) as unknown as { planned: number; weekly_money_plans: { week_start: string } }[])
    .filter((a) => planningMonth(a.weekly_money_plans.week_start) === month)
    .reduce((s, a) => s + Number(a.planned), 0);
  const paid = ((pays ?? []) as { amount: number }[]).reduce((s, p) => s + Number(p.amount), 0);
  const needed = cards.reduce((s, c) => s + cardMonthlyNeed(c), 0);
  return { month, ...cardsCoverage(needed, allocated, paid), allocated, paid };
}

export interface UpcomingItem {
  date: string;
  days: number;
  kind: "pago" | "corte" | "deuda" | "reponer";
  title: string;
  amount: number | null;
  href: string;
}

/** Próximos pagos y cortes (tarjetas, deudas). */
export async function getUpcoming(ctx: AppContext, cards: CardRow[], debts: DebtRow[]) {
  const month = monthStart(ctx.today);
  const { data: pays } = await ctx.supabase.from("card_payments").select("card_id").eq("period_month", month);
  const paidCards = new Set(((pays ?? []) as { card_id: string }[]).map((p) => p.card_id));
  const items: UpcomingItem[] = [];
  for (const c of cards) {
    const name = c.nickname ? `${c.bank} · ${c.nickname}` : c.bank;
    if (c.due_day) {
      const d = nextDayOfMonth(c.due_day, ctx.today);
      const samePeriod = d.slice(0, 7) === ctx.today.slice(0, 7);
      if (!(samePeriod && paidCards.has(c.id)))
        items.push({ date: d, days: daysBetween(ctx.today, d), kind: "pago", title: `Pago ${name}`, amount: cardMonthlyNeed(c) || null, href: "/finanzas/tarjetas" });
    }
    if (c.cut_day) {
      const d = nextDayOfMonth(c.cut_day, ctx.today);
      items.push({ date: d, days: daysBetween(ctx.today, d), kind: "corte", title: `Corte ${name}`, amount: null, href: "/finanzas/tarjetas" });
    }
  }
  for (const debt of debts) {
    if (debt.closed || !debt.payment_day) continue;
    const d = nextDayOfMonth(debt.payment_day, ctx.today);
    items.push({ date: d, days: daysBetween(ctx.today, d), kind: "deuda", title: `Pago a ${debt.creditor}`, amount: debt.payment_amount, href: "/finanzas/deudas" });
  }
  return items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function msiRemainingByCard(msis: MsiPurchase[], today: string) {
  const m = new Map<string, number>();
  for (const p of msis) {
    const rem = msiRemaining(p, today);
    if (rem <= 0 || !p.card_id) continue;
    m.set(p.card_id, (m.get(p.card_id) ?? 0) + rem * Number(p.monthly_payment));
  }
  return m;
}

export function currentWeek(today: string) {
  const ws = weekStart(today);
  return { ws, we: addDays(ws, 6) };
}
