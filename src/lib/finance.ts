import { monthDiff, type ISODate } from "./dates";
import type { MsiPurchase } from "./types";

export const INCOME_CATEGORIES = [
  { value: "salario", label: "Salario" },
  { value: "propinas", label: "Propinas" },
  { value: "filmmaking", label: "Filmmaking" },
  { value: "redes", label: "Redes" },
  { value: "otros", label: "Otros" },
] as const;

export const EXPENSE_CATEGORIES = [
  { value: "casa", label: "Casa" },
  { value: "comida", label: "Comida" },
  { value: "transporte", label: "Transporte" },
  { value: "tarjetas", label: "Tarjetas" },
  { value: "deudas", label: "Deudas" },
  { value: "suscripciones", label: "Suscripciones" },
  { value: "cuidado_personal", label: "Cuidado personal" },
  { value: "equipo", label: "Equipo" },
  { value: "viajes", label: "Viajes" },
  { value: "gustos", label: "Gustos" },
  { value: "otros", label: "Otros" },
] as const;

export const GOAL_CATEGORIES = [
  { value: "emergencia", label: "Fondo de emergencia" },
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

export function categoryLabel(value: string): string {
  return (
    [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES, ...GOAL_CATEGORIES].find((c) => c.value === value)?.label ??
    value
  );
}

export function isValidCategory(kind: string, category: string): boolean {
  const list = kind === "ingreso" ? INCOME_CATEGORIES : kind === "gasto" ? EXPENSE_CATEGORIES : [];
  return list.some((c) => c.value === category);
}

/**
 * Mensualidades pendientes: el pago del mes en curso cuenta como pendiente.
 * start_date indica el mes del primer pago.
 */
export function msiRemaining(p: Pick<MsiPurchase, "start_date" | "months">, today: ISODate): number {
  const elapsed = Math.max(0, monthDiff(p.start_date, today));
  return Math.max(0, p.months - elapsed);
}

export function msiPaid(p: Pick<MsiPurchase, "start_date" | "months">, today: ISODate): number {
  return p.months - msiRemaining(p, today);
}

export interface MsiSummary {
  activeCount: number;
  monthlyCommitted: number;
  totalRemaining: number;
  percentOfIncome: number | null;
}

export function msiSummary(
  purchases: Pick<MsiPurchase, "start_date" | "months" | "monthly_payment">[],
  today: ISODate,
  monthlyIncome: number | null,
): MsiSummary {
  let monthlyCommitted = 0;
  let totalRemaining = 0;
  let activeCount = 0;
  for (const p of purchases) {
    const rem = msiRemaining(p, today);
    if (rem <= 0) continue;
    // Si la compra empieza en un mes futuro, aún no pesa en este mes.
    if (monthDiff(p.start_date, today) >= 0) monthlyCommitted += Number(p.monthly_payment);
    totalRemaining += rem * Number(p.monthly_payment);
    activeCount++;
  }
  monthlyCommitted = Math.round(monthlyCommitted * 100) / 100;
  totalRemaining = Math.round(totalRemaining * 100) / 100;
  const percentOfIncome =
    monthlyIncome && monthlyIncome > 0 ? Math.round((monthlyCommitted / monthlyIncome) * 1000) / 10 : null;
  return { activeCount, monthlyCommitted, totalRemaining, percentOfIncome };
}

/** Qué significa el % comprometido. Solo informa, no prohíbe. */
export function commitmentLevel(percent: number | null): { label: string; tone: "ok" | "warn" | "high" } | null {
  if (percent == null) return null;
  if (percent < 15) return { label: "Holgado", tone: "ok" };
  if (percent < 30) return { label: "Atento", tone: "warn" };
  return { label: "Alto", tone: "high" };
}

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });
const mxn0 = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

export function money(n: number | null | undefined, decimals = false): string {
  if (n == null || Number.isNaN(n)) return "—";
  return (decimals ? mxn : mxn0).format(Number(n));
}
