import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getContext } from "@/lib/session";
import { formatShort } from "@/lib/dates";
import { money } from "@/lib/finance";
import { BUCKET_CATEGORIES, goalMath } from "@/lib/money";
import { getGoals, getLoans } from "@/lib/finance-queries";
import { Badge, Card, CardTitle, EmptyState, ProgressBar } from "@/components/ui";
import { GoalForm, LoanForm, RepayForm } from "../finance-forms";

export const metadata: Metadata = { title: "Sobres y metas" };

const catLabel = (v: string) => BUCKET_CATEGORIES.find((c) => c.value === v)?.label ?? v;

export default async function BucketsPage() {
  const ctx = await getContext();
  const [goals, loans] = await Promise.all([getGoals(ctx), getLoans(ctx)]);
  const buckets = goals.filter((g) => g.is_bucket);
  const metas = goals.filter((g) => !g.is_bucket);
  const name = new Map(goals.map((g) => [g.id, g.name]));
  const pending = loans.filter((l) => l.status === "pendiente");
  const toRepay = pending.reduce((s, l) => s + Number(l.amount) - Number(l.repaid), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle hint="Dinero separado virtualmente. Viajes y Gustos son sobres distintos.">Sobres</CardTitle>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {buckets.map((b) => {
            const m = goalMath(b.target, b.saved, b.target_date, ctx.today);
            return (
              <li key={b.id}>
                <Link href={`/finanzas/sobres/${b.id}`} className="block rounded-xl bg-surface-2 p-3 transition hover:bg-track">
                  <p className="truncate text-sm text-muted">{b.name}</p>
                  <p className="tabular text-lg font-semibold">{money(b.saved)}</p>
                  {m.percent != null ? <ProgressBar value={m.percent} max={100} tone="success" className="mt-1.5" /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <CardTitle>Metas</CardTitle>
        {metas.length === 0 ? (
          <EmptyState title="Sin metas todavía">Ej. Viaje León, TV, equipo de filmmaking, visa.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {metas.map((g) => {
              const m = goalMath(g.target, g.saved, g.target_date, ctx.today);
              const late = m.weeksLeft === 0 && (m.remaining ?? 0) > 0;
              return (
                <li key={g.id}>
                  <Link href={`/finanzas/sobres/${g.id}`} className="-mx-2 block rounded-xl px-2 py-3 hover:bg-surface-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{g.name}</p>
                        <p className="text-xs text-muted">
                          {catLabel(g.category)}
                          {g.target_date ? ` · ${formatShort(g.target_date)}` : ""}
                          {m.weeksLeft != null ? ` · ${m.weeksLeft} semanas` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-right">
                        <div>
                          <p className="tabular text-sm font-medium">
                            {money(g.saved)}
                            {g.target ? <span className="text-muted"> / {money(g.target)}</span> : null}
                          </p>
                          {m.weeklyNeeded != null && (m.remaining ?? 0) > 0 ? (
                            <p className="tabular text-xs text-muted">{money(m.weeklyNeeded, true)}/semana</p>
                          ) : null}
                        </div>
                        <ChevronRight size={15} className="text-faint" />
                      </div>
                    </div>
                    {m.percent != null ? <ProgressBar value={m.percent} max={100} tone={m.percent >= 100 ? "success" : "accent"} className="mt-2" /> : null}
                    {late ? <p className="mt-1 text-xs text-warn">La fecha objetivo ya llegó. Puedes ajustar la fecha o el aporte.</p> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle hint="Transferencias internas. No cuentan como ingreso ni como gasto.">Dinero por reponer</CardTitle>
        {pending.length ? (
          <>
            <p className="mb-3 text-lg font-semibold">{money(toRepay, true)} pendiente</p>
            <ul className="mb-4 divide-y divide-border">
              {pending.map((l) => (
                <li key={l.id} className="space-y-2 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[15px] font-medium">
                        Tomé {money(l.amount)} de {name.get(l.from_goal_id) ?? "un sobre"}
                        {l.to_goal_id ? ` → ${name.get(l.to_goal_id) ?? ""}` : ""}
                      </p>
                      <p className="text-xs text-muted">
                        {formatShort(l.taken_on)}
                        {l.purpose ? ` · ${l.purpose}` : ""} · repuesto {money(l.repaid)}
                      </p>
                    </div>
                    <Badge tone="warn">Por reponer</Badge>
                  </div>
                  <RepayForm loanId={l.id} pending={Math.round((Number(l.amount) - Number(l.repaid)) * 100) / 100} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mb-4 text-sm text-muted">Nada pendiente.</p>
        )}
        <details>
          <summary className="cursor-pointer text-sm font-medium text-accent">Tomar prestado de un sobre</summary>
          <div className="mt-3">
            <LoanForm goals={goals.map((g) => ({ id: g.id, label: g.name }))} />
          </div>
        </details>
        {loans.some((l) => l.status === "repuesto") ? (
          <p className="mt-3 text-xs text-muted">{loans.filter((l) => l.status === "repuesto").length} préstamos internos ya repuestos.</p>
        ) : null}
      </Card>

      <Card>
        <CardTitle>Nueva meta</CardTitle>
        <GoalForm />
      </Card>
    </div>
  );
}
