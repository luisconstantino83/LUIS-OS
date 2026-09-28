/**
 * Libertad Financiera — cálculos puros (sin BD) para poder probarlos.
 * Filosofía: mostrar datos, escenarios y consecuencias. Nunca "cómpralo" / "no lo compres".
 */
import { addDays, monthDiff, parseISO, formatISO, weekStart, type ISODate } from "./dates";

const r2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Plan semanal
// ---------------------------------------------------------------------------
export const ALLOC_CATEGORIES = [
  { value: "tarjetas", label: "Tarjetas", group: "compromisos" },
  { value: "casa", label: "Casa / familia", group: "compromisos" },
  { value: "necesidades", label: "Necesidades", group: "compromisos" },
  { value: "ahorro", label: "Ahorro", group: "ahorro" },
  { value: "emergencia", label: "Fondo de emergencia", group: "ahorro" },
  { value: "inversion", label: "Inversión", group: "ahorro" },
  { value: "viajes", label: "Viajes", group: "metas" },
  { value: "educacion", label: "Educación", group: "metas" },
  { value: "equipo", label: "Equipo / filmmaking", group: "metas" },
  { value: "gustos", label: "Gustos", group: "gustos" },
  { value: "otros", label: "Otros", group: "compromisos" },
] as const;
export type AllocCategory = (typeof ALLOC_CATEGORIES)[number]["value"];
export type AllocGroup = "compromisos" | "ahorro" | "metas" | "gustos";

/** Ingresos de la semana según las categorías de transactions. */
export function weeklyIncome(txs: { kind: string; category: string; amount: number }[]) {
  const out = { fijo: 0, propinas: 0, extra: 0, otros: 0, total: 0 };
  for (const t of txs) {
    if (t.kind !== "ingreso") continue;
    const a = Number(t.amount);
    if (t.category === "salario") out.fijo += a;
    else if (t.category === "propinas") out.propinas += a;
    else if (t.category === "filmmaking" || t.category === "redes") out.extra += a;
    else out.otros += a;
    out.total += a;
  }
  (Object.keys(out) as (keyof typeof out)[]).forEach((k) => (out[k] = r2(out[k])));
  return out;
}

export interface Allocation {
  category: string;
  planned: number;
  actual: number | null;
}

/** INGRESO − COMPROMISOS − AHORRO − METAS − GUSTOS = DINERO LIBRE */
export function planSummary(income: number, allocs: Allocation[], use: "planned" | "actual" = "planned") {
  const sums: Record<AllocGroup, number> = { compromisos: 0, ahorro: 0, metas: 0, gustos: 0 };
  for (const a of allocs) {
    const g = ALLOC_CATEGORIES.find((c) => c.value === a.category)?.group as AllocGroup | undefined;
    if (!g) continue;
    const v = use === "actual" ? (a.actual ?? 0) : a.planned;
    sums[g] += Number(v);
  }
  const assigned = sums.compromisos + sums.ahorro + sums.metas + sums.gustos;
  return {
    income: r2(income),
    compromisos: r2(sums.compromisos),
    ahorro: r2(sums.ahorro),
    metas: r2(sums.metas),
    gustos: r2(sums.gustos),
    libre: r2(income - assigned),
  };
}

/** Primera semana del mes = la semana (dom–sáb) que contiene el día 1. */
export function isFirstWeekOfMonth(weekStartDate: ISODate): boolean {
  for (let i = 0; i < 7; i++) if (addDays(weekStartDate, i).endsWith("-01")) return true;
  return false;
}

/** Mes al que "pertenece" una semana para la estrategia de tarjetas (el del sábado). */
export function planningMonth(weekStartDate: ISODate): ISODate {
  return addDays(weekStartDate, 6).slice(0, 8) + "01";
}

/**
 * Reparto automático: si es la primera semana y las tarjetas no están cubiertas,
 * primero tarjetas; lo que queda se reparte según la plantilla de porcentajes.
 */
export function autoDistribute(
  income: number,
  template: Record<string, number>,
  cardsStillNeeded: number,
  prioritizeCards: boolean,
): Record<string, number> {
  const out: Record<string, number> = {};
  let rest = Math.max(0, income);
  if (prioritizeCards && cardsStillNeeded > 0) {
    out.tarjetas = r2(Math.min(rest, cardsStillNeeded));
    rest = r2(rest - out.tarjetas);
  }
  for (const [cat, pct] of Object.entries(template)) {
    if (cat === "tarjetas" || !pct) continue;
    out[cat] = Math.floor(((rest * pct) / 100) * 100) / 100;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tarjetas
// ---------------------------------------------------------------------------
export interface CardLike {
  id: string;
  bank: string;
  nickname: string | null;
  balance: number;
  credit_limit: number | null;
  cut_day: number | null;
  due_day: number | null;
  monthly_payment: number | null;
  no_interest_payment: number | null;
  min_payment: number | null;
  alert_utilization: number;
}

/** Monto a cubrir en el mes: pago para no generar intereses → pago planeado → mínimo. */
export function cardMonthlyNeed(c: CardLike): number {
  return Number(c.no_interest_payment ?? c.monthly_payment ?? c.min_payment ?? 0);
}

export function utilization(c: Pick<CardLike, "balance" | "credit_limit">): number | null {
  if (!c.credit_limit || Number(c.credit_limit) <= 0) return null;
  return Math.round((Math.max(0, Number(c.balance)) / Number(c.credit_limit)) * 1000) / 10;
}

export function cardsCoverage(needed: number, allocatedThisMonth: number, paidThisMonth: number) {
  const covered = r2(allocatedThisMonth + paidThisMonth);
  const diff = r2(covered - needed);
  return { needed: r2(needed), covered, diff, isCovered: needed > 0 && diff >= 0 };
}

/** Siguiente fecha de un día del mes (maneja meses cortos). */
export function nextDayOfMonth(day: number, today: ISODate): ISODate {
  const [y, m] = today.split("-").map(Number);
  const make = (yy: number, mm: number) => {
    const last = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
    return `${yy}-${String(mm).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
  };
  const thisMonth = make(y, m);
  if (thisMonth >= today) return thisMonth;
  return m === 12 ? make(y + 1, 1) : make(y, m + 1);
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Metas y sobres
// ---------------------------------------------------------------------------
export function goalMath(target: number | null, saved: number, targetDate: ISODate | null, today: ISODate) {
  const t = target != null ? Number(target) : null;
  const remaining = t != null ? r2(Math.max(0, t - Number(saved))) : null;
  const weeksLeft = targetDate ? Math.max(0, Math.ceil(daysBetween(today, targetDate) / 7)) : null;
  const weeklyNeeded =
    remaining != null && weeksLeft != null ? (weeksLeft > 0 ? r2(remaining / weeksLeft) : remaining) : null;
  const percent = t && t > 0 ? Math.min(100, Math.round((Number(saved) / t) * 100)) : null;
  return { remaining, weeksLeft, weeklyNeeded, percent };
}

/** Escenarios: si aporto X por semana, ¿cuándo llego? */
export function goalScenarios(remaining: number, today: ISODate, weeklyAmounts: number[]) {
  return weeklyAmounts.map((w) => {
    if (w <= 0) return { weekly: w, weeks: null as number | null, date: null as ISODate | null };
    const weeks = Math.ceil(remaining / w);
    return { weekly: w, weeks, date: addDays(today, weeks * 7) };
  });
}

export const MOVEMENT_SIGN: Record<string, 1 | -1> = {
  aporte: 1,
  ajuste: 1,
  prestamo_entrada: 1,
  prestamo_regreso: 1,
  retiro: -1,
  prestamo_salida: -1,
};

// ---------------------------------------------------------------------------
// Ahorro semanal (ahorro real = aportes − retiros; los préstamos internos NO cuentan)
// ---------------------------------------------------------------------------
export function netSavings(movs: { kind: string; amount: number }[]) {
  return r2(
    movs.reduce((s, m) => (m.kind === "aporte" ? s + Number(m.amount) : m.kind === "retiro" ? s - Number(m.amount) : s), 0),
  );
}

export interface WeekSavings {
  weekStart: ISODate;
  income: number;
  planned: number;
  actual: number;
  rate: number | null;
}

export function savingsHistory(
  weeks: ISODate[],
  incomeByWeek: Map<ISODate, number>,
  plannedByWeek: Map<ISODate, number>,
  movs: { kind: string; amount: number; moved_on: ISODate }[],
): WeekSavings[] {
  return weeks.map((w) => {
    const end = addDays(w, 6);
    const actual = netSavings(movs.filter((m) => m.moved_on >= w && m.moved_on <= end));
    const income = incomeByWeek.get(w) ?? 0;
    return {
      weekStart: w,
      income,
      planned: plannedByWeek.get(w) ?? 0,
      actual,
      rate: income > 0 ? Math.round((actual / income) * 1000) / 10 : null,
    };
  });
}

export function savingsTotals(history: WeekSavings[], today: ISODate, allMovs: { kind: string; amount: number; moved_on: ISODate }[]) {
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  const thisMonth = netSavings(allMovs.filter((m) => m.moved_on.startsWith(month)));
  const thisYear = netSavings(allMovs.filter((m) => m.moved_on.startsWith(year)));
  const withData = history.filter((h) => h.income > 0 || h.actual !== 0);
  const avgWeekly = withData.length ? r2(withData.reduce((s, h) => s + h.actual, 0) / withData.length) : 0;
  const inc = withData.reduce((s, h) => s + h.income, 0);
  const sav = withData.reduce((s, h) => s + h.actual, 0);
  return { thisMonth, thisYear, avgWeekly, rate: inc > 0 ? Math.round((sav / inc) * 1000) / 10 : null };
}

export function lastNWeeks(today: ISODate, n: number): ISODate[] {
  const ws = weekStart(today);
  return Array.from({ length: n }, (_, i) => addDays(ws, -7 * (n - 1 - i)));
}

// ---------------------------------------------------------------------------
// MSI
// ---------------------------------------------------------------------------
export interface MsiLike {
  id: string;
  product: string;
  months: number;
  monthly_payment: number;
  start_date: ISODate;
}

function addMonths(iso: ISODate, n: number): ISODate {
  const d = parseISO(iso.slice(0, 8) + "01");
  d.setUTCMonth(d.getUTCMonth() + n);
  return formatISO(d);
}

/** Compromiso por mes para los próximos `n` meses y qué se libera cada mes. */
export function msiSchedule(items: MsiLike[], today: ISODate, n = 12) {
  const start = today.slice(0, 8) + "01";
  return Array.from({ length: n }, (_, i) => {
    const month = addMonths(start, i);
    let total = 0;
    const ending: string[] = [];
    for (const p of items) {
      const idx = monthDiff(p.start_date, month); // 0 = primer pago
      if (idx >= 0 && idx < p.months) {
        total += Number(p.monthly_payment);
        if (idx === p.months - 1) ending.push(p.product);
      }
    }
    return { month, total: r2(total), ending };
  });
}

export function purchaseScenarios(price: number, downPayment: number, monthsOptions: number[]) {
  const financed = Math.max(0, price - downPayment);
  return monthsOptions.map((m) => ({ months: m, monthly: r2(financed / m), total: r2(price) }));
}

// ---------------------------------------------------------------------------
// Deudas: escenarios de pago (interés simple mensual sobre saldo, si hay tasa)
// ---------------------------------------------------------------------------
export function payoffScenario(balance: number, monthlyPayment: number, annualRate: number | null) {
  if (monthlyPayment <= 0) return { months: null as number | null, interest: 0, feasible: false };
  const rate = annualRate ? annualRate / 100 / 12 : 0;
  let b = balance;
  let months = 0;
  let interest = 0;
  while (b > 0.005 && months < 600) {
    const i = b * rate;
    if (monthlyPayment <= i) return { months: null, interest: r2(interest), feasible: false };
    interest += i;
    b = b + i - monthlyPayment;
    months++;
  }
  return { months, interest: r2(interest), feasible: months < 600 };
}

// ---------------------------------------------------------------------------
// Fondo de emergencia
// ---------------------------------------------------------------------------
export function emergencyStatus(balance: number, monthlyEssentials: number | null, levels: number[]) {
  if (!monthlyEssentials || monthlyEssentials <= 0) return { months: null as number | null, levels: [] as { months: number; target: number; reached: boolean }[] };
  const months = Math.round((balance / monthlyEssentials) * 10) / 10;
  return {
    months,
    levels: levels.map((l) => ({ months: l, target: r2(l * monthlyEssentials), reached: balance >= l * monthlyEssentials })),
  };
}

/** Promedio mensual de gastos esenciales en los últimos 90 días (si no está configurado). */
export const ESSENTIAL_CATEGORIES = ["casa", "comida", "transporte", "tarjetas", "suscripciones"];
export function avgEssentialMonthly(txs: { kind: string; category: string; amount: number }[], days = 90) {
  const total = txs
    .filter((t) => t.kind === "gasto" && ESSENTIAL_CATEGORIES.includes(t.category))
    .reduce((s, t) => s + Number(t.amount), 0);
  return r2((total / days) * 30);
}

// ---------------------------------------------------------------------------
// Etiquetas
// ---------------------------------------------------------------------------
export const BUCKET_CATEGORIES = [
  { value: "emergencia", label: "Emergencia" },
  { value: "viajes", label: "Viajes" },
  { value: "casa", label: "Casa" },
  { value: "automovil", label: "Automóvil" },
  { value: "educacion", label: "Educación" },
  { value: "filmmaking", label: "Filmmaking" },
  { value: "tecnologia", label: "Tecnología" },
  { value: "gustos", label: "Gustos" },
  { value: "visa", label: "Visa / trámites" },
  { value: "equipo", label: "Equipo" },
  { value: "otros", label: "Otros" },
] as const;

export const DEBT_KINDS = [
  { value: "prestamo", label: "Préstamo" },
  { value: "familia", label: "Familia" },
  { value: "otro", label: "Otro" },
] as const;

export const ACCOUNT_KINDS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "banco", label: "Banco" },
  { value: "ahorro", label: "Ahorro" },
  { value: "inversion", label: "Inversión" },
  { value: "otro", label: "Otro" },
] as const;
