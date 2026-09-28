import type { Metadata } from "next";
import Link from "next/link";
import { getContext } from "@/lib/session";
import { addDays, formatMonthYear, formatShort, isValidISODate, weekStart } from "@/lib/dates";
import { money } from "@/lib/finance";
import { isFirstWeekOfMonth, weeklyIncome } from "@/lib/money";
import { getCards, getCardsStrategy, getSettings } from "@/lib/finance-queries";
import { Badge, Card, CardTitle, Stat } from "@/components/ui";
import { AutoPlanButton, FinanceSettingsForm, PlanForm, WeekIncomeForm } from "../finance-forms";

export const metadata: Metadata = { title: "Plan semanal" };

export default async function WeekPlanPage(props: PageProps<"/finanzas/semana">) {
  const ctx = await getContext();
  const sp = await props.searchParams;
  const current = weekStart(ctx.today);
  const ws = typeof sp.semana === "string" && isValidISODate(sp.semana) ? weekStart(sp.semana) : current;
  const we = addDays(ws, 6);

  const [settings, cards, { data: txs }, { data: plan }] = await Promise.all([
    getSettings(ctx),
    getCards(ctx),
    ctx.supabase.from("transactions").select("kind,category,amount").gte("tx_date", ws).lte("tx_date", we),
    ctx.supabase.from("weekly_money_plans").select("id,notes,weekly_allocations(category,planned,actual)").eq("week_start", ws).maybeSingle(),
  ]);
  const strategy = await getCardsStrategy(ctx, ws, cards);
  const inc = weeklyIncome((txs ?? []) as { kind: string; category: string; amount: number }[]);
  const p = plan as { notes: string | null; weekly_allocations: { category: string; planned: number; actual: number | null }[] } | null;
  const allocations = Object.fromEntries((p?.weekly_allocations ?? []).map((a) => [a.category, { planned: Number(a.planned), actual: a.actual == null ? null : Number(a.actual) }]));
  const firstWeek = isFirstWeekOfMonth(ws);
  // Lo que falta cubrir sin contar lo ya planeado esta semana; luego cuánto queda del ingreso de la semana.
  const thisWeekCards = allocations.tarjetas?.planned ?? 0;
  const remainingNeed = Math.max(0, strategy.needed - (strategy.covered - thisWeekCards));
  const balanceAfter = inc.total - remainingNeed;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <Link href={`/finanzas/semana?semana=${addDays(ws, -7)}`} className="text-muted hover:text-fg">
          ← Anterior
        </Link>
        <span className="font-medium">
          {formatShort(ws)} – {formatShort(we)}
          {ws === current ? " · esta semana" : ""}
        </span>
        <Link href={`/finanzas/semana?semana=${addDays(ws, 7)}`} className="text-muted hover:text-fg">
          Siguiente →
        </Link>
      </div>

      <Card>
        <CardTitle hint="Se toma de tus movimientos registrados. No se captura dos veces.">Ingreso de la semana</CardTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Fijo" value={money(inc.fijo)} />
          <Stat label="Propinas" value={money(inc.propinas)} />
          <Stat label="Extra" value={money(inc.extra)} />
          <Stat label="Otros" value={money(inc.otros)} />
        </div>
        <p className="mt-3 text-lg font-semibold">Total semanal: {money(inc.total, true)}</p>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-accent">Registrar ingresos</summary>
          <div className="mt-3">
            <WeekIncomeForm weekStart={ws} today={ctx.today <= we && ctx.today >= ws ? ctx.today : we} />
          </div>
        </details>
      </Card>

      <Card>
        <CardTitle
          hint={`${formatMonthYear(strategy.month)} · solo planifica, no mueve dinero`}
          action={strategy.isCovered ? <Badge tone="success">Cubiertas</Badge> : firstWeek ? <Badge tone="accent">Primera semana</Badge> : null}
        >
          Tarjetas del mes
        </CardTitle>
        {strategy.needed === 0 ? (
          <p className="text-sm text-muted">Agrega el &quot;pago para no generar intereses&quot; de tus tarjetas para calcular lo necesario.</p>
        ) : strategy.isCovered ? (
          <>
            <p className="text-[15px] font-semibold text-success">Tarjetas del mes cubiertas</p>
            <p className="mt-1 text-sm text-muted">Las siguientes semanas pueden priorizar ahorro, viajes, fondo de emergencia y metas.</p>
          </>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Necesario" value={money(remainingNeed)} sub={`de ${money(strategy.needed)} del mes`} />
            <Stat label="Disponible esta semana" value={money(inc.total)} />
            <Stat
              label={balanceAfter >= 0 ? "Sobrante" : "Faltante"}
              value={money(Math.abs(balanceAfter))}
              sub={`${money(strategy.paid)} pagado · ${money(strategy.allocated)} planeado`}
            />
          </div>
        )}
      </Card>

      <Card>
        <CardTitle action={<AutoPlanButton weekStart={ws} />} hint="Planeado vs. real. Reparte manualmente o automáticamente.">
          Weekly money plan
        </CardTitle>
        <PlanForm
          key={JSON.stringify(allocations) + inc.total}
          weekStart={ws}
          income={inc.total}
          allocations={allocations}
          notes={p?.notes ?? null}
        />
      </Card>

      <details className="rounded-2xl border border-border bg-surface p-4">
        <summary className="cursor-pointer text-sm font-medium">Configurar estrategia y reparto automático</summary>
        <div className="mt-4">
          <FinanceSettingsForm template={settings.alloc_template} firstWeekCards={settings.first_week_cards} essentials={settings.essential_monthly_expenses} />
        </div>
      </details>
    </div>
  );
}
