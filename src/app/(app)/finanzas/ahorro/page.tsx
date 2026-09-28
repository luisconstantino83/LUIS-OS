import type { Metadata } from "next";
import { getContext } from "@/lib/session";
import { addDays, formatShort } from "@/lib/dates";
import { money } from "@/lib/finance";
import {
  ALLOC_CATEGORIES,
  avgEssentialMonthly,
  emergencyStatus,
  lastNWeeks,
  savingsHistory,
  savingsTotals,
} from "@/lib/money";
import { getGoals, getSettings } from "@/lib/finance-queries";
import { Badge, Card, CardTitle, EmptyState, ProgressBar, Stat } from "@/components/ui";
import { LineChart } from "@/components/line-chart";

export const metadata: Metadata = { title: "Ahorro semanal" };

const SAVE_GROUPS = new Set(ALLOC_CATEGORIES.filter((c) => c.group === "ahorro" || c.group === "metas").map((c) => c.value as string));

export default async function SavingsPage() {
  const ctx = await getContext();
  const weeks = lastNWeeks(ctx.today, 12);
  const from = weeks[0];
  const yearStart = ctx.today.slice(0, 4) + "-01-01";
  const [settings, goals, { data: txs }, { data: movs }, { data: plans }, { data: ess }] = await Promise.all([
    getSettings(ctx),
    getGoals(ctx),
    ctx.supabase.from("transactions").select("kind,amount,tx_date").eq("kind", "ingreso").gte("tx_date", from),
    ctx.supabase.from("goal_movements").select("kind,amount,moved_on").gte("moved_on", from < yearStart ? from : yearStart),
    ctx.supabase.from("weekly_money_plans").select("week_start,weekly_allocations(category,planned)").gte("week_start", from),
    ctx.supabase.from("transactions").select("kind,category,amount").eq("kind", "gasto").gte("tx_date", addDays(ctx.today, -90)),
  ]);
  const incomeByWeek = new Map<string, number>();
  for (const t of (txs ?? []) as { amount: number; tx_date: string }[]) {
    const w = weeks.filter((x) => x <= t.tx_date).at(-1);
    if (w) incomeByWeek.set(w, (incomeByWeek.get(w) ?? 0) + Number(t.amount));
  }
  const plannedByWeek = new Map<string, number>();
  for (const p of (plans ?? []) as { week_start: string; weekly_allocations: { category: string; planned: number }[] }[]) {
    plannedByWeek.set(p.week_start, p.weekly_allocations.filter((a) => SAVE_GROUPS.has(a.category)).reduce((s, a) => s + Number(a.planned), 0));
  }
  const allMovs = (movs ?? []) as { kind: string; amount: number; moved_on: string }[];
  const history = savingsHistory(weeks, incomeByWeek, plannedByWeek, allMovs);
  const totals = savingsTotals(history, ctx.today, allMovs);
  const cumulative = history.reduce<number[]>((arr, h) => [...arr, (arr.at(-1) ?? 0) + h.actual], []);
  const points = history.map((h, i) => ({
    x: formatShort(h.weekStart),
    y: Math.round(cumulative[i]),
    tip: `Semana del ${formatShort(h.weekStart)}: ${money(cumulative[i])} acumulado`,
  }));

  // Fondo de emergencia
  const emergencyBalance = goals.filter((g) => g.category === "emergencia").reduce((s, g) => s + Number(g.saved), 0);
  const estimated = avgEssentialMonthly((ess ?? []) as { kind: string; category: string; amount: number }[]);
  const essentials = settings.essential_monthly_expenses != null ? Number(settings.essential_monthly_expenses) : estimated || null;
  const em = emergencyStatus(emergencyBalance, essentials, settings.emergency_levels);
  const nextLevel = em.levels.find((l) => !l.reached);

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle hint="Ahorro real = aportes a tus sobres menos retiros. Los préstamos internos no cuentan.">Weekly savings</CardTitle>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Ahorrado este mes" value={money(totals.thisMonth)} />
          <Stat label="Ahorrado este año" value={money(totals.thisYear)} />
          <Stat label="Promedio semanal" value={money(totals.avgWeekly)} />
          <Stat label="Tasa de ahorro" value={totals.rate != null ? `${totals.rate}%` : "—"} sub="últimas 12 semanas" />
        </div>
      </Card>

      <Card>
        <CardTitle>Ahorro acumulado</CardTitle>
        {history.some((h) => h.actual !== 0) ? (
          <LineChart points={points} label="Ahorro acumulado de las últimas 12 semanas" unit="" />
        ) : (
          <EmptyState title="Aún no hay aportes">Registra un aporte en un sobre para empezar la gráfica.</EmptyState>
        )}
      </Card>

      <Card>
        <CardTitle>Historial</CardTitle>
        <ul className="divide-y divide-border">
          {[...history].reverse().map((h) => (
            <li key={h.weekStart} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 py-2.5 text-sm">
              <div>
                <p className="font-medium">Semana del {formatShort(h.weekStart)}</p>
                <p className="text-xs text-muted">
                  Ingreso {money(h.income)} · Planeado {money(h.planned)}
                </p>
              </div>
              <div className="text-right">
                <p className="tabular font-medium">{money(h.actual)}</p>
                <p className="tabular text-xs text-muted">{h.rate != null ? `${h.rate}%` : "—"}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle
          hint={
            settings.essential_monthly_expenses != null
              ? "Con tus gastos esenciales configurados."
              : essentials
                ? "Estimado con tus gastos esenciales de los últimos 90 días (configúralo en Semana)."
                : "Configura tus gastos esenciales mensuales en Semana."
          }
        >
          Emergency fund
        </CardTitle>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Saldo" value={money(emergencyBalance)} />
          <Stat label="Meses cubiertos" value={em.months != null ? em.months : "—"} />
          <Stat label="Meta actual" value={nextLevel ? money(nextLevel.target) : em.levels.length ? "Completa" : "—"} sub={nextLevel ? `Nivel ${nextLevel.months} ${nextLevel.months === 1 ? "mes" : "meses"}` : undefined} />
          <Stat label="Faltante" value={nextLevel ? money(nextLevel.target - emergencyBalance) : "—"} />
        </div>
        {em.levels.length ? (
          <ul className="mt-4 space-y-3">
            {em.levels.map((l, i) => (
              <li key={l.months}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>
                    Nivel {i + 1} · {l.months} {l.months === 1 ? "mes" : "meses"}
                  </span>
                  {l.reached ? <Badge tone="success">Alcanzado</Badge> : <span className="tabular text-muted">{money(l.target)}</span>}
                </div>
                <ProgressBar value={emergencyBalance} max={l.target} tone={l.reached ? "success" : "accent"} />
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  );
}
