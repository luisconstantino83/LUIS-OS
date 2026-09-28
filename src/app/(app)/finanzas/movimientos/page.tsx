import type { Metadata } from "next";
import Link from "next/link";
import { getContext } from "@/lib/session";
import { formatISO, formatMonthYear, formatShort, monthDiff, monthStart, parseISO } from "@/lib/dates";
import { EXPENSE_CATEGORIES, categoryLabel, money } from "@/lib/finance";
import { moneySummary } from "@/lib/progress";
import { Card, CardTitle, EmptyState, ProgressBar, Stat } from "@/components/ui";
import { ConfirmButton } from "@/components/forms";
import type { Transaction } from "@/lib/types";
import { TransactionForm } from "../finance-forms";
import { deleteTransaction } from "../actions";

export const metadata: Metadata = { title: "Movimientos" };

function shiftMonth(iso: string, delta: number) {
  const d = parseISO(iso);
  d.setUTCMonth(d.getUTCMonth() + delta, 1);
  return formatISO(d);
}

export default async function MovementsPage(props: PageProps<"/finanzas/movimientos">) {
  const ctx = await getContext();
  const sp = await props.searchParams;
  const mes = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? `${sp.mes}-01` : null;
  const month = mes && mes <= ctx.today ? mes : monthStart(ctx.today);
  const { data } = await ctx.supabase
    .from("transactions")
    .select("*")
    .gte("tx_date", month)
    .lt("tx_date", shiftMonth(month, 1))
    .order("tx_date", { ascending: false })
    .order("created_at", { ascending: false });
  const txs = (data ?? []) as Transaction[];
  const sum = moneySummary(txs);

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Nuevo movimiento</CardTitle>
        <TransactionForm today={ctx.today} />
      </Card>
      <Card>
        <CardTitle
          action={
            <div className="flex items-center gap-1 text-sm">
              <Link className="rounded-lg px-2 py-1 text-muted hover:bg-surface-2" href={`/finanzas/movimientos?mes=${shiftMonth(month, -1).slice(0, 7)}`}>
                ‹
              </Link>
              <span className="capitalize">{formatMonthYear(month)}</span>
              {monthDiff(month, ctx.today) > 0 ? (
                <Link className="rounded-lg px-2 py-1 text-muted hover:bg-surface-2" href={`/finanzas/movimientos?mes=${shiftMonth(month, 1).slice(0, 7)}`}>
                  ›
                </Link>
              ) : null}
            </div>
          }
        >
          Movimientos
        </CardTitle>
        <div className="mb-4 grid grid-cols-3 gap-3">
          <Stat label="Ingresos" value={money(sum.income)} />
          <Stat label="Gastos" value={money(sum.expenses)} />
          <Stat label="Diferencia" value={money(sum.net)} />
        </div>
        {sum.expenses > 0 ? (
          <ul className="mb-4 space-y-2.5">
            {EXPENSE_CATEGORIES.filter((c) => sum.byCategory[c.value])
              .sort((a, b) => sum.byCategory[b.value] - sum.byCategory[a.value])
              .map((c) => (
                <li key={c.value} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm">
                  <span className="truncate">{c.label}</span>
                  <ProgressBar value={sum.byCategory[c.value]} max={sum.expenses} />
                  <span className="tabular text-muted">{money(sum.byCategory[c.value])}</span>
                </li>
              ))}
          </ul>
        ) : null}
        {txs.length === 0 ? (
          <EmptyState title="Sin movimientos este mes" />
        ) : (
          <ul className="divide-y divide-border">
            {txs.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[15px]">{t.note ?? categoryLabel(t.category)}</p>
                  <p className="text-xs text-muted">
                    {formatShort(t.tx_date)} · {categoryLabel(t.category)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className={`tabular font-medium ${t.kind === "ingreso" ? "text-success" : ""}`}>
                    {t.kind === "ingreso" ? "+" : "−"}
                    {money(t.amount, true)}
                  </span>
                  <ConfirmButton action={deleteTransaction.bind(null, t.id)} confirmText="¿Eliminar este movimiento?">
                    ✕
                  </ConfirmButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
