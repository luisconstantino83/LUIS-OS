import type { Metadata } from "next";
import { getContext } from "@/lib/session";
import { formatMonthYear } from "@/lib/dates";
import { commitmentLevel, money, msiPaid, msiRemaining, msiSummary } from "@/lib/finance";
import { msiSchedule } from "@/lib/money";
import { getCards, getMsis } from "@/lib/finance-queries";
import { Badge, Card, CardTitle, EmptyState, LinkButton, ProgressBar, Stat } from "@/components/ui";
import { ConfirmButton } from "@/components/forms";
import { IncomeForm } from "../finance-forms";
import { deleteMsi } from "../actions";

export const metadata: Metadata = { title: "MSI" };

const MONTHS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

export default async function MsiPage() {
  const ctx = await getContext();
  const [msis, cards] = await Promise.all([getMsis(ctx), getCards(ctx)]);
  const income = ctx.profile.monthly_income_estimate != null ? Number(ctx.profile.monthly_income_estimate) : null;
  const sum = msiSummary(msis, ctx.today, income);
  const level = commitmentLevel(sum.percentOfIncome);
  const schedule = msiSchedule(msis, ctx.today, 12);
  const max = Math.max(1, ...schedule.map((s) => s.total));
  const cardName = new Map(cards.map((c) => [c.id, c.nickname ?? c.bank]));
  const active = msis.filter((m) => msiRemaining(m, ctx.today) > 0);
  const done = msis.filter((m) => msiRemaining(m, ctx.today) === 0);

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="MSI activos" value={sum.activeCount} />
          <Stat label="Compromiso mensual" value={money(sum.monthlyCommitted)} />
          <Stat label="Total restante" value={money(sum.totalRemaining)} />
          <Stat
            label="% del ingreso mensual"
            value={sum.percentOfIncome != null ? `${sum.percentOfIncome}%` : "—"}
            sub={level ? level.label : "Agrega tu ingreso mensual"}
          />
        </div>
        <LinkButton href="/finanzas/vale-la-pena" className="mt-4 w-full">
          Simular nueva compra
        </LinkButton>
      </Card>

      <Card>
        <CardTitle hint="Cuánto tendrás comprometido cada mes y cuándo se libera cada mensualidad.">Compromiso futuro</CardTitle>
        {sum.activeCount === 0 ? (
          <p className="text-sm text-muted">Sin mensualidades futuras.</p>
        ) : (
          <ul className="space-y-2.5">
            {schedule.map((s) => {
              const m = Number(s.month.slice(5, 7)) - 1;
              return (
                <li key={s.month} className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 text-sm">
                  <span className="tabular text-muted">
                    {MONTHS[m]} {s.month.slice(2, 4)}
                  </span>
                  <div>
                    <ProgressBar value={s.total} max={max} />
                    {s.ending.length ? <p className="mt-0.5 truncate text-xs text-success">Termina: {s.ending.join(", ")}</p> : null}
                  </div>
                  <span className="tabular min-w-16 text-right font-medium">{money(s.total)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle>MSI Manager</CardTitle>
        {msis.length === 0 ? (
          <EmptyState title="Sin compras a meses" />
        ) : (
          <ul className="divide-y divide-border">
            {[...active, ...done].map((m) => {
              const rem = msiRemaining(m, ctx.today);
              const paid = msiPaid(m, ctx.today);
              const down = Number((m as { down_payment?: number }).down_payment ?? 0);
              return (
                <li key={m.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{m.product}</p>
                      <p className="text-xs text-muted">
                        Precio {money(m.total_price)}
                        {down ? ` · enganche ${money(down)}` : ""} · financiado {money(Number(m.total_price) - down)}
                        {m.card_id && cardName.get(m.card_id) ? ` · ${cardName.get(m.card_id)}` : ""}
                      </p>
                      <p className="text-xs text-muted">
                        {money(m.monthly_payment, true)} × {m.months} · {formatMonthYear(m.start_date)} → {formatMonthYear(m.end_date)}
                      </p>
                      <p className="tabular text-xs text-muted">
                        Pagado {money(paid * Number(m.monthly_payment))} · Restante {money(rem * Number(m.monthly_payment))}
                      </p>
                    </div>
                    {rem > 0 ? <Badge tone="accent">{rem} restantes</Badge> : <Badge tone="success">Liquidado</Badge>}
                  </div>
                  <ProgressBar className="mt-2" value={paid} max={m.months} tone={rem ? "accent" : "success"} />
                  <div className="mt-1 flex justify-end">
                    <ConfirmButton action={deleteMsi.bind(null, m.id)} confirmText="¿Eliminar esta compra?">
                      Eliminar
                    </ConfirmButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <IncomeForm value={income} />
      </Card>
    </div>
  );
}
