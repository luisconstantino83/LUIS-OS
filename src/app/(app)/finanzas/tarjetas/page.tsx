import type { Metadata } from "next";
import { getContext } from "@/lib/session";
import { formatShort, monthStart } from "@/lib/dates";
import { money } from "@/lib/finance";
import { cardMonthlyNeed, nextDayOfMonth, utilization } from "@/lib/money";
import { getCards, getMsis, msiRemainingByCard } from "@/lib/finance-queries";
import { Badge, Card, CardTitle, EmptyState, ProgressBar, Stat } from "@/components/ui";
import { ConfirmButton } from "@/components/forms";
import { CardForm, EditCard, PayCardForm } from "../finance-forms";
import { archiveCard, deleteCardPayment } from "../actions";

export const metadata: Metadata = { title: "Tarjetas" };

export default async function CardsPage() {
  const ctx = await getContext();
  const month = monthStart(ctx.today);
  const [cards, msis, { data: pays }] = await Promise.all([
    getCards(ctx),
    getMsis(ctx),
    ctx.supabase.from("card_payments").select("id,card_id,amount,paid_on,period_month").eq("period_month", month).order("paid_on"),
  ]);
  const msiByCard = msiRemainingByCard(msis, ctx.today);
  const payments = (pays ?? []) as { id: string; card_id: string; amount: number; paid_on: string }[];

  return (
    <div className="space-y-4">
      {cards.length === 0 ? <EmptyState title="Sin tarjetas registradas" /> : null}
      {cards.map((c) => {
        const u = utilization(c);
        const limit = c.credit_limit != null ? Number(c.credit_limit) : null;
        const msiBal = msiByCard.get(c.id) ?? 0;
        const paid = payments.filter((p) => p.card_id === c.id);
        const paidTotal = paid.reduce((s, p) => s + Number(p.amount), 0);
        const need = cardMonthlyNeed(c);
        const overAlert = u != null && u >= c.alert_utilization;
        return (
          <Card key={c.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">
                  {c.nickname ?? c.bank}
                  {c.last4 ? <span className="ml-1.5 text-sm font-normal text-muted">•••• {c.last4}</span> : null}
                </p>
                <p className="text-sm text-muted">{c.bank}</p>
              </div>
              <div className="flex gap-1">
                <EditCard card={c} />
                <ConfirmButton action={archiveCard.bind(null, c.id)} confirmText="¿Quitar esta tarjeta? Sus compras MSI y pagos se conservan.">
                  Quitar
                </ConfirmButton>
              </div>
            </div>

            {u != null ? (
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-muted">Utilización</span>
                  <span className="tabular font-medium">
                    {u}%{overAlert ? <span className="ml-1.5 text-warn">· arriba de tu alerta ({c.alert_utilization}%)</span> : null}
                  </span>
                </div>
                <ProgressBar value={u} max={100} tone={overAlert ? "warn" : "accent"} />
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Stat label="Saldo utilizado" value={money(c.balance, true)} />
              <Stat label="Límite" value={limit != null ? money(limit) : "—"} />
              <Stat label="Disponible" value={limit != null ? money(limit - Number(c.balance)) : "—"} />
              <Stat label="Saldo a MSI" value={money(msiBal)} />
              <Stat label="Saldo normal" value={money(Math.max(0, Number(c.balance) - msiBal))} />
              <Stat label="Anualidad" value={c.annual_fee != null ? money(c.annual_fee) : "—"} />
              <Stat label="Corte" value={c.cut_day ? formatShort(nextDayOfMonth(c.cut_day, ctx.today)) : "—"} />
              <Stat label="Fecha límite" value={c.due_day ? formatShort(nextDayOfMonth(c.due_day, ctx.today)) : "—"} />
              <Stat label="CAT / tasa" value={c.cat_rate != null || c.interest_rate != null ? `${c.cat_rate ?? "—"}% / ${c.interest_rate ?? "—"}%` : "—"} />
            </div>

            <div className="mt-4 rounded-xl bg-surface-2 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  Para no generar intereses: <b className="tabular">{c.no_interest_payment != null ? money(c.no_interest_payment, true) : "—"}</b>
                  <span className="text-muted"> · mínimo {c.min_payment != null ? money(c.min_payment, true) : "—"}</span>
                </span>
                {need > 0 && paidTotal >= need ? <Badge tone="success">Pagada este mes</Badge> : paidTotal > 0 ? <Badge tone="accent">Pagado {money(paidTotal)}</Badge> : null}
              </div>
              {paid.length ? (
                <ul className="mb-2 space-y-1 text-sm">
                  {paid.map((p) => (
                    <li key={p.id} className="flex items-center justify-between">
                      <span className="text-muted">
                        {formatShort(p.paid_on)} · {money(p.amount, true)}
                      </span>
                      <ConfirmButton action={deleteCardPayment.bind(null, p.id)} confirmText="¿Eliminar este pago? El saldo de la tarjeta se restaura.">
                        ✕
                      </ConfirmButton>
                    </li>
                  ))}
                </ul>
              ) : null}
              <PayCardForm cardId={c.id} suggested={need > paidTotal ? Math.round((need - paidTotal) * 100) / 100 : null} month={month.slice(0, 7)} />
            </div>
          </Card>
        );
      })}
      <Card>
        <CardTitle hint="Nunca guardes el número completo, CVV, NIP ni contraseñas.">Agregar tarjeta</CardTitle>
        <CardForm />
      </Card>
    </div>
  );
}
