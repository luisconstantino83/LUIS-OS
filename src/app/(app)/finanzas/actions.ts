"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { bool, date, dbError, num, oneOf, str } from "@/lib/form";
import { isValidCategory } from "@/lib/finance";
import { addDays, isValidISODate, monthStart, weekdayOf } from "@/lib/dates";
import { ALLOC_CATEGORIES, autoDistribute, isFirstWeekOfMonth, weeklyIncome } from "@/lib/money";
import { getCards, getCardsStrategy, getSettings } from "@/lib/finance-queries";
import type { ActionState } from "@/components/forms";

const UUID = /^[0-9a-f-]{36}$/i;
const uuidOrNull = (v: string | null) => (v && UUID.test(v) ? v : null);
const BUCKETS = ["emergencia", "viajes", "casa", "automovil", "educacion", "filmmaking", "tecnologia", "gustos", "visa", "equipo", "otros"] as const;
const ALLOCS = ALLOC_CATEGORIES.map((c) => c.value);

function refresh() {
  revalidatePath("/", "layout");
}

function moneyError(e: { message?: string } | null | undefined): string {
  const m = e?.message ?? "";
  if (m.includes("savings_goals_saved_check")) return "El sobre no tiene saldo suficiente para ese retiro.";
  if (m.includes("FINANCE: el monto excede")) return "Ese monto es mayor a lo pendiente de reponer.";
  if (m.includes("FINANCE: el pago excede")) return "El pago es mayor al saldo de la deuda.";
  if (m.includes("cards_last4_check")) return "Solo los últimos 4 dígitos (nunca el número completo).";
  if (m.includes("msi_down_lt_total")) return "El enganche debe ser menor al precio.";
  return dbError(e);
}

// ---------------------------------------------------------------------------
// Movimientos
// ---------------------------------------------------------------------------
export async function addTransaction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const kind = oneOf(fd.get("kind"), ["ingreso", "gasto"] as const);
  const category = str(fd, "category", 40);
  const amount = num(fd, "amount", { min: 0.01, max: 10_000_000 });
  const d = date(fd, "tx_date") ?? ctx.today;
  if (!kind) return { error: "Elige ingreso o gasto." };
  if (!category || !isValidCategory(kind, category)) return { error: "Elige una categoría." };
  if (amount == null) return { error: "Escribe un monto mayor a 0." };
  const { error } = await ctx.supabase.from("transactions").insert({
    user_id: ctx.userId,
    kind,
    category,
    amount,
    tx_date: d,
    note: str(fd, "note", 300),
  });
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true, message: kind === "ingreso" ? "Ingreso registrado." : "Gasto registrado." };
}

export async function deleteTransaction(id: string) {
  const ctx = await getContext();
  await ctx.supabase.from("transactions").delete().eq("id", id);
  refresh();
}

export async function setMonthlyIncome(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const v = num(fd, "monthly_income_estimate", { min: 0, max: 10_000_000 });
  const { error } = await ctx.supabase.from("profiles").update({ monthly_income_estimate: v }).eq("id", ctx.userId);
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true, message: "Ingreso mensual actualizado." };
}

/** Registrar los ingresos de la semana (crea movimientos; el plan los lee de ahí). */
export async function addWeekIncome(weekStartDate: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  if (!isValidISODate(weekStartDate)) return { error: "Semana inválida." };
  const d = date(fd, "tx_date") ?? (ctx.today < addDays(weekStartDate, 6) ? ctx.today : addDays(weekStartDate, 6));
  const rows = (
    [
      ["fijo", "salario", "Ingreso fijo"],
      ["propinas", "propinas", "Propinas"],
      ["extra", "filmmaking", "Ingreso extra"],
      ["otros", "otros", "Otros ingresos"],
    ] as const
  )
    .map(([field, category, note]) => ({ amount: num(fd, field, { min: 0.01, max: 10_000_000 }), category, note }))
    .filter((r) => r.amount != null)
    .map((r) => ({ user_id: ctx.userId, kind: "ingreso", category: r.category, amount: r.amount, tx_date: d, note: r.note }));
  if (rows.length === 0) return { error: "Escribe al menos un ingreso." };
  const { error } = await ctx.supabase.from("transactions").insert(rows);
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true, message: "Ingresos registrados." };
}

// ---------------------------------------------------------------------------
// Plan semanal
// ---------------------------------------------------------------------------
async function ensurePlan(ctx: Awaited<ReturnType<typeof getContext>>, ws: string) {
  const { data, error } = await ctx.supabase
    .from("weekly_money_plans")
    .upsert({ user_id: ctx.userId, week_start: ws }, { onConflict: "user_id,week_start" })
    .select("id")
    .single();
  if (error || !data) throw new Error(moneyError(error));
  return data.id as string;
}

export async function savePlan(weekStartDate: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  if (!isValidISODate(weekStartDate) || weekdayOf(weekStartDate) !== 0) return { error: "Semana inválida." };
  const planId = await ensurePlan(ctx, weekStartDate);
  const rows = ALLOCS.map((cat) => ({
    plan_id: planId,
    user_id: ctx.userId,
    category: cat,
    planned: num(fd, `planned_${cat}`, { min: 0, max: 10_000_000 }) ?? 0,
    actual: num(fd, `actual_${cat}`, { min: 0, max: 10_000_000 }),
  }));
  const { error } = await ctx.supabase.from("weekly_allocations").upsert(rows, { onConflict: "plan_id,category" });
  if (error) return { error: moneyError(error) };
  await ctx.supabase.from("weekly_money_plans").update({ notes: str(fd, "notes", 2000) }).eq("id", planId);
  refresh();
  return { ok: true, message: "Plan guardado." };
}

/** Reparto automático: primera semana → tarjetas; lo demás según tu plantilla. */
export async function autoPlan(weekStartDate: string) {
  const ctx = await getContext();
  if (!isValidISODate(weekStartDate)) return { ok: false as const, error: "Semana inválida." };
  const [settings, cards, { data: txs }] = await Promise.all([
    getSettings(ctx),
    getCards(ctx),
    ctx.supabase.from("transactions").select("kind,category,amount").gte("tx_date", weekStartDate).lte("tx_date", addDays(weekStartDate, 6)),
  ]);
  const income = weeklyIncome((txs ?? []) as { kind: string; category: string; amount: number }[]).total;
  if (income <= 0) return { ok: false as const, error: "Primero registra el ingreso de la semana." };
  const strategy = await getCardsStrategy(ctx, weekStartDate, cards);
  // Lo ya asignado en ESTA semana no cuenta como faltante
  const planId = await ensurePlan(ctx, weekStartDate);
  const { data: mine } = await ctx.supabase.from("weekly_allocations").select("planned").eq("plan_id", planId).eq("category", "tarjetas").maybeSingle();
  const stillNeeded = Math.max(0, strategy.needed - (strategy.covered - Number(mine?.planned ?? 0)));
  const prioritize = settings.first_week_cards && (isFirstWeekOfMonth(weekStartDate) || !strategy.isCovered);
  const dist = autoDistribute(income, settings.alloc_template, stillNeeded, prioritize);
  const rows = ALLOCS.map((cat) => ({ plan_id: planId, user_id: ctx.userId, category: cat, planned: dist[cat] ?? 0 }));
  const { error } = await ctx.supabase.from("weekly_allocations").upsert(rows, { onConflict: "plan_id,category" });
  if (error) return { ok: false as const, error: moneyError(error) };
  refresh();
  return { ok: true as const };
}

export async function saveFinanceSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const template: Record<string, number> = {};
  let total = 0;
  for (const c of ALLOCS) {
    if (c === "tarjetas") continue;
    const v = num(fd, `pct_${c}`, { min: 0, max: 100, int: true }) ?? 0;
    template[c] = v;
    total += v;
  }
  if (total > 100) return { error: `Los porcentajes suman ${total}%. Deben sumar 100% o menos.` };
  const { error } = await ctx.supabase.from("finance_settings").upsert(
    {
      user_id: ctx.userId,
      first_week_cards: bool(fd, "first_week_cards"),
      alloc_template: template,
      essential_monthly_expenses: num(fd, "essential_monthly_expenses", { min: 0, max: 10_000_000 }),
    },
    { onConflict: "user_id" },
  );
  if (error) return { error: moneyError(error) };
  refresh();
  return { ok: true, message: "Configuración guardada." };
}

// ---------------------------------------------------------------------------
// Tarjetas (Credit Card Hub)
// ---------------------------------------------------------------------------
function cardFields(fd: FormData) {
  const n = (k: string) => num(fd, k, { min: 0, max: 10_000_000 });
  const last4 = str(fd, "last4", 20);
  return {
    bank: str(fd, "bank", 60),
    nickname: str(fd, "nickname", 60),
    balance: num(fd, "balance", { min: -10_000_000, max: 10_000_000 }) ?? 0,
    credit_limit: n("credit_limit"),
    cut_day: num(fd, "cut_day", { min: 1, max: 31, int: true }),
    due_day: num(fd, "due_day", { min: 1, max: 31, int: true }),
    monthly_payment: n("monthly_payment"),
    no_interest_payment: n("no_interest_payment"),
    min_payment: n("min_payment"),
    annual_fee: n("annual_fee"),
    cat_rate: num(fd, "cat_rate", { min: 0, max: 1000 }),
    interest_rate: num(fd, "interest_rate", { min: 0, max: 1000 }),
    last4: last4 ? last4.replace(/\D/g, "") : null,
    alert_utilization: num(fd, "alert_utilization", { min: 1, max: 100, int: true }) ?? 30,
  };
}

export async function saveCard(cardId: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const f = cardFields(fd);
  if (!f.bank) return { error: "Escribe el banco." };
  if (f.last4 && f.last4.length !== 4) return { error: "Solo los últimos 4 dígitos (nunca el número completo)." };
  const { error } = cardId
    ? await ctx.supabase.from("cards").update(f).eq("id", cardId)
    : await ctx.supabase.from("cards").insert({ ...f, user_id: ctx.userId });
  if (error) return { error: moneyError(error) };
  refresh();
  return { ok: true, message: cardId ? "Tarjeta actualizada." : "Tarjeta agregada." };
}

export async function archiveCard(id: string) {
  const ctx = await getContext();
  await ctx.supabase.from("cards").update({ archived: true }).eq("id", id);
  refresh();
}

/** Pago real a una tarjeta: baja el saldo y queda como gasto "tarjetas". */
export async function payCard(cardId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const amount = num(fd, "amount", { min: 0.01, max: 10_000_000 });
  if (amount == null) return { error: "Escribe el monto pagado." };
  const paidOn = date(fd, "paid_on") ?? ctx.today;
  const period = str(fd, "period_month", 7);
  const periodMonth = period && /^\d{4}-\d{2}$/.test(period) ? `${period}-01` : monthStart(paidOn);
  const { data: card } = await ctx.supabase.from("cards").select("bank,nickname").eq("id", cardId).single();
  const { data: tx, error: e1 } = await ctx.supabase
    .from("transactions")
    .insert({
      user_id: ctx.userId,
      kind: "gasto",
      category: "tarjetas",
      amount,
      tx_date: paidOn,
      note: `Pago ${card?.nickname ?? card?.bank ?? "tarjeta"}`,
    })
    .select("id")
    .single();
  if (e1 || !tx) return { error: moneyError(e1) };
  const { error } = await ctx.supabase.from("card_payments").insert({
    user_id: ctx.userId,
    card_id: cardId,
    amount,
    paid_on: paidOn,
    period_month: periodMonth,
    transaction_id: tx.id,
  });
  if (error) {
    await ctx.supabase.from("transactions").delete().eq("id", tx.id);
    return { error: moneyError(error) };
  }
  refresh();
  return { ok: true, message: "Pago registrado." };
}

export async function deleteCardPayment(id: string) {
  const ctx = await getContext();
  const { data } = await ctx.supabase.from("card_payments").select("transaction_id").eq("id", id).single();
  await ctx.supabase.from("card_payments").delete().eq("id", id);
  if (data?.transaction_id) await ctx.supabase.from("transactions").delete().eq("id", data.transaction_id);
  refresh();
}

// ---------------------------------------------------------------------------
// Compras: simulador → MSI o contado
// ---------------------------------------------------------------------------
export async function registerPurchase(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const product = str(fd, "product", 120);
  const total = num(fd, "total_price", { min: 0.01, max: 10_000_000 });
  const down = num(fd, "down_payment", { min: 0, max: 10_000_000 }) ?? 0;
  const mode = oneOf(fd.get("mode"), ["msi", "contado"] as const) ?? "msi";
  if (!product) return { error: "Escribe qué vas a comprar." };
  if (total == null) return { error: "Escribe el precio total." };

  const worth_it = {
    salud: bool(fd, "q_salud"),
    dinero: bool(fd, "q_dinero"),
    profesional: bool(fd, "q_profesional"),
    necesito: bool(fd, "q_necesito"),
    duplicado: bool(fd, "q_duplicado"),
  };

  if (mode === "contado") {
    const category = str(fd, "category", 40) ?? "otros";
    if (!isValidCategory("gasto", category)) return { error: "Categoría inválida." };
    const { error } = await ctx.supabase.from("transactions").insert({
      user_id: ctx.userId,
      kind: "gasto",
      category,
      amount: total,
      tx_date: ctx.today,
      note: product,
    });
    if (error) return { error: dbError(error) };
    refresh();
    redirect("/finanzas/movimientos");
  }

  const months = num(fd, "months", { min: 2, max: 60, int: true });
  if (months == null) return { error: "Elige el número de meses (2 a 60)." };
  if (down >= total) return { error: "El enganche debe ser menor al precio." };
  const startMonth = str(fd, "start_month", 7);
  const start = startMonth && /^\d{4}-\d{2}$/.test(startMonth) ? `${startMonth}-01` : monthStart(ctx.today);
  const { error } = await ctx.supabase.from("msi_purchases").insert({
    user_id: ctx.userId,
    card_id: uuidOrNull(str(fd, "card_id", 36)),
    product,
    total_price: total,
    down_payment: down,
    months,
    start_date: start,
    worth_it,
  });
  if (error) return { error: moneyError(error) };
  refresh();
  redirect("/finanzas/msi");
}

export async function deleteMsi(id: string) {
  const ctx = await getContext();
  await ctx.supabase.from("msi_purchases").delete().eq("id", id);
  refresh();
}

// ---------------------------------------------------------------------------
// Sobres y metas
// ---------------------------------------------------------------------------
export async function addGoal(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const category = oneOf(fd.get("category"), BUCKETS);
  const name = str(fd, "name", 80);
  const target = num(fd, "target", { min: 1, max: 100_000_000 });
  if (!category || !name) return { error: "Completa sobre y nombre." };
  const { data, error } = await ctx.supabase
    .from("savings_goals")
    .insert({ user_id: ctx.userId, category, name, target, target_date: date(fd, "target_date"), is_bucket: false })
    .select("id")
    .single();
  if (error || !data) return { error: moneyError(error) };
  const initial = num(fd, "saved", { min: 0.01, max: 100_000_000 });
  if (initial) {
    const { error: e2 } = await ctx.supabase
      .from("goal_movements")
      .insert({ user_id: ctx.userId, goal_id: data.id, kind: "ajuste", amount: initial, note: "Saldo inicial" });
    if (e2) return { error: moneyError(e2) };
  }
  refresh();
  return { ok: true, message: "Meta creada." };
}

export async function updateGoal(goalId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const name = str(fd, "name", 80);
  if (!name) return { error: "El nombre no puede ir vacío." };
  const { error } = await ctx.supabase
    .from("savings_goals")
    .update({ name, target: num(fd, "target", { min: 1, max: 100_000_000 }), target_date: date(fd, "target_date") })
    .eq("id", goalId);
  if (error) return { error: moneyError(error) };
  refresh();
  return { ok: true, message: "Guardado." };
}

/** Aporte (+) o retiro (−) real a un sobre. Nunca cambia el saldo sin movimiento. */
export async function moveGoal(goalId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const kind = oneOf(fd.get("kind"), ["aporte", "retiro"] as const) ?? "aporte";
  const amount = num(fd, "amount", { min: 0.01, max: 100_000_000 });
  if (amount == null) return { error: "Escribe un monto." };
  const { error } = await ctx.supabase.from("goal_movements").insert({
    user_id: ctx.userId,
    goal_id: goalId,
    kind,
    amount,
    moved_on: date(fd, "moved_on") ?? ctx.today,
    note: str(fd, "note", 300),
  });
  if (error) return { error: moneyError(error) };
  refresh();
  return { ok: true, message: kind === "aporte" ? "Aporte registrado." : "Retiro registrado." };
}

export async function deleteMovement(id: string) {
  const ctx = await getContext();
  const { error } = await ctx.supabase.from("goal_movements").delete().eq("id", id).is("loan_id", null);
  if (error) return { ok: false as const, error: moneyError(error) };
  refresh();
  return { ok: true as const };
}

export async function archiveGoal(id: string) {
  const ctx = await getContext();
  await ctx.supabase.from("savings_goals").update({ archived: true }).eq("id", id);
  refresh();
}

/** Tomar dinero de un sobre (queda "por reponer"; no es ingreso). */
export async function takeLoan(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const from = uuidOrNull(str(fd, "from_goal_id", 36));
  const to = uuidOrNull(str(fd, "to_goal_id", 36));
  const amount = num(fd, "amount", { min: 0.01, max: 100_000_000 });
  if (!from || amount == null) return { error: "Elige el sobre de origen y el monto." };
  if (to === from) return { error: "El origen y el destino deben ser distintos." };
  const { error } = await ctx.supabase.rpc("take_internal_loan", {
    p_from: from,
    p_amount: amount,
    p_purpose: str(fd, "purpose", 200),
    p_to: to,
    p_date: date(fd, "taken_on") ?? ctx.today,
  });
  if (error) return { error: moneyError(error) };
  refresh();
  return { ok: true, message: "Registrado como dinero por reponer." };
}

export async function repayLoan(loanId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const amount = num(fd, "amount", { min: 0.01, max: 100_000_000 });
  if (amount == null) return { error: "Escribe el monto." };
  const { error } = await ctx.supabase.rpc("repay_internal_loan", { p_loan: loanId, p_amount: amount, p_date: ctx.today });
  if (error) return { error: moneyError(error) };
  refresh();
  return { ok: true, message: "Reposición registrada." };
}

// ---------------------------------------------------------------------------
// Deudas
// ---------------------------------------------------------------------------
export async function addDebt(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const kind = oneOf(fd.get("kind"), ["prestamo", "familia", "otro"] as const);
  const creditor = str(fd, "creditor", 80);
  const original = num(fd, "original_amount", { min: 0.01, max: 100_000_000 });
  if (!kind || !creditor || original == null) return { error: "Completa tipo, persona/institución y saldo." };
  const { data, error } = await ctx.supabase
    .from("debts")
    .insert({
      user_id: ctx.userId,
      kind,
      creditor,
      original_amount: original,
      payment_amount: num(fd, "payment_amount", { min: 0, max: 100_000_000 }),
      payment_day: num(fd, "payment_day", { min: 1, max: 31, int: true }),
      interest_rate: num(fd, "interest_rate", { min: 0, max: 1000 }),
      notes: str(fd, "notes", 2000),
    })
    .select("id")
    .single();
  if (error || !data) return { error: moneyError(error) };
  // Si ya pagaste una parte, se registra como pago real (no se edita el saldo a mano)
  const current = num(fd, "current_balance", { min: 0, max: 100_000_000 });
  if (current != null && current < original) {
    const { error: e2 } = await ctx.supabase
      .from("debt_payments")
      .insert({ user_id: ctx.userId, debt_id: data.id, amount: original - current, note: "Pagado antes de registrar" });
    if (e2) return { error: moneyError(e2) };
  }
  refresh();
  return { ok: true, message: "Deuda registrada." };
}

export async function payDebt(debtId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const amount = num(fd, "amount", { min: 0.01, max: 100_000_000 });
  if (amount == null) return { error: "Escribe el monto pagado." };
  const paidOn = date(fd, "paid_on") ?? ctx.today;
  const { data: debt } = await ctx.supabase.from("debts").select("creditor").eq("id", debtId).single();
  const withTx = bool(fd, "as_expense");
  let txId: string | null = null;
  if (withTx) {
    const { data: tx, error: e1 } = await ctx.supabase
      .from("transactions")
      .insert({ user_id: ctx.userId, kind: "gasto", category: "deudas", amount, tx_date: paidOn, note: `Pago a ${debt?.creditor ?? "deuda"}` })
      .select("id")
      .single();
    if (e1) return { error: moneyError(e1) };
    txId = tx.id;
  }
  const { error } = await ctx.supabase
    .from("debt_payments")
    .insert({ user_id: ctx.userId, debt_id: debtId, amount, paid_on: paidOn, transaction_id: txId });
  if (error) {
    if (txId) await ctx.supabase.from("transactions").delete().eq("id", txId);
    return { error: moneyError(error) };
  }
  refresh();
  return { ok: true, message: "Pago registrado." };
}

export async function deleteDebt(id: string) {
  const ctx = await getContext();
  await ctx.supabase.from("debts").delete().eq("id", id);
  refresh();
}

// ---------------------------------------------------------------------------
// Cuentas
// ---------------------------------------------------------------------------
export async function saveAccount(accountId: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const name = str(fd, "name", 60);
  const kind = oneOf(fd.get("kind"), ["efectivo", "banco", "ahorro", "inversion", "otro"] as const) ?? "banco";
  const balance = num(fd, "balance", { min: -100_000_000, max: 100_000_000 });
  if (!name || balance == null) return { error: "Completa nombre y saldo." };
  const { error } = accountId
    ? await ctx.supabase.from("money_accounts").update({ name, kind, balance }).eq("id", accountId)
    : await ctx.supabase.from("money_accounts").insert({ user_id: ctx.userId, name, kind, balance });
  if (error) return { error: moneyError(error) };
  refresh();
  return { ok: true, message: "Cuenta guardada." };
}

export async function archiveAccount(id: string) {
  const ctx = await getContext();
  await ctx.supabase.from("money_accounts").update({ archived: true }).eq("id", id);
  refresh();
}

