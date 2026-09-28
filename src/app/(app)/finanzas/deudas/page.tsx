import type { Metadata } from "next";
import { getContext } from "@/lib/session";
import { money, msiRemaining } from "@/lib/finance";
import { DEBT_KINDS, payoffScenario } from "@/lib/money";
import { getCards, getDebts, getMsis } from "@/lib/finance-queries";
import { Badge, Card, CardTitle, ProgressBar, Stat } from "@/components/ui";
import { ConfirmButton } from "@/components/forms";
import { DebtForm, PayDebtForm } from "../finance-forms";
import { deleteDebt } from "../actions";

export const metadata: Metadata = { title: "Deudas" };

export default async function DebtsPage() {
  const ctx = await getContext();
  const [debts, cards, msis] = await Promise.all([getDebts(ctx), getCards(ctx), getMsis(ctx)]);
  const cardDebt = cards.reduce((s, c) => s + Math.max(0, Number(c.balance)), 0);
  const msiDebt = msis.reduce((s, m) => s + msiRemaining(m, ctx.today) * Number(m.monthly_payment), 0);
  const byKind = (k: string) => debts.filter((d) => d.kind === k && !d.closed).reduce((s, d) => s + Number(d.current_balance), 0);
  const open = debts.filter((d) => !d.closed);
  const closed = debts.filter((d) => d.closed);

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle hint="Tarjetas y MSI se leen de sus secciones (el MSI ya forma parte del saldo de tu tarjeta).">Debt center</CardTitle>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Tarjetas" value={money(cardDebt)} />
          <Stat label="MSI (restante)" value={money(msiDebt)} sub="incluido en tarjetas" />
          <Stat label="Préstamos" value={money(byKind("prestamo"))} />
          <Stat label="Familia" value={money(byKind("familia"))} />
          <Stat label="Otros" value={money(byKind("otro"))} />
        </div>
      </Card>

      {open.map((d) => {
        const paidPct = ((Number(d.original_amount) - Number(d.current_balance)) / Number(d.original_amount)) * 100;
        const base = d.payment_amount ? Number(d.payment_amount) : null;
        const scenarios = [base, base ? base * 1.5 : null, base ? base * 2 : null]
          .filter((x): x is number => x != null && x > 0)
          .map((p) => ({ p, r: payoffScenario(Number(d.current_balance), p, d.interest_rate) }));
        return (
          <Card key={d.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{d.creditor}</p>
                <p className="text-sm text-muted">
                  {DEBT_KINDS.find((k) => k.value === d.kind)?.label}
                  {d.interest_rate ? ` · ${d.interest_rate}% anual` : " · sin interés registrado"}
                  {d.payment_day ? ` · paga el día ${d.payment_day}` : ""}
                </p>
              </div>
              <Badge tone="accent">{money(d.current_balance)}</Badge>
            </div>
            <ProgressBar value={paidPct} max={100} tone="success" className="mt-3" />
            <p className="tabular mt-1 text-xs text-muted">
              Pagado {money(Number(d.original_amount) - Number(d.current_balance))} de {money(d.original_amount)}
            </p>
            {scenarios.length ? (
              <div className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">
                <p className="mb-1 text-[13px] font-medium text-muted">Escenarios de pago</p>
                <ul className="space-y-0.5">
                  {scenarios.map(({ p, r }) => (
                    <li key={p} className="flex justify-between">
                      <span>{money(p)}/mes</span>
                      <span className="tabular text-muted">
                        {r.feasible ? `${r.months} meses${r.interest ? ` · ${money(r.interest)} de interés` : ""}` : "no alcanza a cubrir el interés"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {d.notes ? <p className="mt-2 text-sm text-muted">{d.notes}</p> : null}
            <div className="mt-3">
              <PayDebtForm debtId={d.id} suggested={d.payment_amount} />
            </div>
          </Card>
        );
      })}

      {closed.length ? (
        <Card>
          <CardTitle>Liquidadas</CardTitle>
          <ul className="divide-y divide-border text-sm">
            {closed.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-2">
                <span>
                  {d.creditor} · {money(d.original_amount)}
                </span>
                <ConfirmButton action={deleteDebt.bind(null, d.id)} confirmText="¿Eliminar este registro?">
                  ✕
                </ConfirmButton>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardTitle hint="El saldo solo baja registrando pagos reales.">Registrar deuda</CardTitle>
        <DebtForm />
      </Card>
    </div>
  );
}
