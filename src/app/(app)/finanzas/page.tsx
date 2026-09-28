import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, ChevronRight } from "lucide-react";
import { getContext } from "@/lib/session";
import { formatShort } from "@/lib/dates";
import { money } from "@/lib/finance";
import { netSavings, planSummary, utilization, weeklyIncome } from "@/lib/money";
import {
  currentWeek,
  getAccounts,
  getCards,
  getDebts,
  getGoals,
  getLoans,
  getUpcoming,
  getCardsStrategy,
} from "@/lib/finance-queries";
import { Badge, Card, CardTitle, EmptyState, Stat } from "@/components/ui";
import { ConfirmButton } from "@/components/forms";
import { AccountForm } from "./finance-forms";
import { archiveAccount } from "./actions";

export const metadata: Metadata = { title: "Finanzas" };

const LEGACY: Record<string, string> = {
  movimientos: "/finanzas/movimientos",
  tarjetas: "/finanzas/tarjetas",
  msi: "/finanzas/msi",
  metas: "/finanzas/sobres",
};

export default async function FinanceHome(props: PageProps<"/finanzas">) {
  const sp = await props.searchParams;
  if (typeof sp.tab === "string" && LEGACY[sp.tab]) redirect(LEGACY[sp.tab]);

  const ctx = await getContext();
  const { ws, we } = currentWeek(ctx.today);
  const [accounts, cards, goals, debts, loans, { data: txs }, { data: movs }, { data: plan }, { data: debtPays }] = await Promise.all([
    getAccounts(ctx),
    getCards(ctx),
    getGoals(ctx),
    getDebts(ctx),
    getLoans(ctx),
    ctx.supabase.from("transactions").select("kind,category,amount").gte("tx_date", ws).lte("tx_date", we),
    ctx.supabase.from("goal_movements").select("kind,amount").gte("moved_on", ws).lte("moved_on", we),
    ctx.supabase.from("weekly_money_plans").select("weekly_allocations(category,planned,actual)").eq("week_start", ws).maybeSingle(),
    ctx.supabase.from("debt_payments").select("debt_id,amount").gte("paid_on", ctx.today.slice(0, 8) + "01"),
  ]);
  const [upcoming, strategy] = await Promise.all([getUpcoming(ctx, cards, debts), getCardsStrategy(ctx, ws, cards)]);

  const tx = (txs ?? []) as { kind: string; category: string; amount: number }[];
  const income = weeklyIncome(tx).total;
  const spent = tx.filter((t) => t.kind === "gasto").reduce((s, t) => s + Number(t.amount), 0);
  const savedWeek = netSavings((movs ?? []) as { kind: string; amount: number }[]);

  const totalMoney = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const savingsTotal = goals.reduce((s, g) => s + Number(g.saved), 0);
  const cardDebt = cards.reduce((s, c) => s + Math.max(0, Number(c.balance)), 0);
  const otherDebt = debts.filter((d) => !d.closed).reduce((s, d) => s + Number(d.current_balance), 0);
  const totalDebt = cardDebt + otherDebt;
  const cardsPending = Math.max(0, strategy.needed - strategy.paid);
  const paidByDebt = new Map<string, number>();
  for (const p of (debtPays ?? []) as { debt_id: string; amount: number }[]) paidByDebt.set(p.debt_id, (paidByDebt.get(p.debt_id) ?? 0) + Number(p.amount));
  const debtsThisMonth = debts
    .filter((d) => !d.closed && d.payment_amount)
    .reduce((s, d) => s + Math.max(0, Math.min(Number(d.payment_amount), Number(d.current_balance)) - (paidByDebt.get(d.id) ?? 0)), 0);
  const committed = cardsPending + debtsThisMonth;
  const available = totalMoney - savingsTotal - committed;
  const netWorth = totalMoney - totalDebt;
  const pendingLoans = loans.filter((l) => l.status === "pendiente");
  const toRepay = pendingLoans.reduce((s, l) => s + Number(l.amount) - Number(l.repaid), 0);

  const allocs = ((plan as { weekly_allocations?: { category: string; planned: number; actual: number | null }[] } | null)?.weekly_allocations ?? []);
  const libre = allocs.length ? planSummary(income, allocs).libre : null;

  // Alertas: solo lo importante, máximo 3
  const alerts: { text: string; href: string }[] = [];
  for (const u of upcoming.filter((u) => u.kind === "pago" && u.days <= 5)) alerts.push({ text: `${u.title} ${u.days === 0 ? "hoy" : `en ${u.days} días`}`, href: u.href });
  if (toRepay > 0) alerts.push({ text: `${money(toRepay)} pendiente de reponer a tus sobres`, href: "/finanzas/sobres" });
  for (const c of cards) {
    const u = utilization(c);
    if (u != null && u >= c.alert_utilization) alerts.push({ text: `${c.nickname ?? c.bank}: utilización ${u}% (tu alerta: ${c.alert_utilization}%)`, href: "/finanzas/tarjetas" });
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
          <Stat label="Dinero total" value={money(totalMoney)} sub={accounts.length ? `${accounts.length} ${accounts.length === 1 ? "cuenta" : "cuentas"}` : "Agrega tus cuentas"} />
          <Stat label="Comprometido" value={money(committed)} sub="pagos del mes pendientes" />
          <Stat label="Disponible real" value={money(available)} sub="total − ahorro − comprometido" />
          <Stat label="Deuda total" value={money(totalDebt)} sub={otherDebt ? `tarjetas ${money(cardDebt)}` : undefined} />
          <Stat label="Ahorro total" value={money(savingsTotal)} sub="en sobres" />
          <Stat label="Patrimonio neto" value={money(netWorth)} sub="cuentas − deudas" />
        </div>
      </Card>

      <Card>
        <CardTitle hint={`${formatShort(ws)} – ${formatShort(we)}`} action={<Link href="/finanzas/semana" className="text-sm text-accent">Plan</Link>}>
          Esta semana
        </CardTitle>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Ingreso" value={money(income)} />
          <Stat label="Gastado" value={money(spent)} />
          <Stat label="Ahorrado" value={money(savedWeek)} />
        </div>
        {libre != null ? <p className="mt-3 text-sm text-muted">Dinero libre según tu plan: <span className="font-medium text-fg">{money(libre)}</span></p> : null}
        {strategy.needed > 0 ? (
          <p className="mt-2 text-sm">
            {strategy.isCovered ? (
              <Badge tone="success">Tarjetas del mes cubiertas</Badge>
            ) : (
              <span className="text-muted">
                Tarjetas del mes: {money(strategy.covered)} de {money(strategy.needed)} planeado o pagado
              </span>
            )}
          </p>
        ) : null}
      </Card>

      {alerts.length ? (
        <Card>
          <CardTitle>Atención</CardTitle>
          <ul className="space-y-2">
            {alerts.slice(0, 3).map((a, i) => (
              <li key={i}>
                <Link href={a.href} className="flex items-center gap-2 text-[15px]">
                  <AlertCircle size={16} className="shrink-0 text-warn" />
                  <span className="flex-1">{a.text}</span>
                  <ChevronRight size={15} className="text-faint" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardTitle>Próximos pagos</CardTitle>
        {upcoming.length === 0 ? (
          <EmptyState title="Sin pagos registrados">Agrega fechas de corte y pago en tus tarjetas.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {upcoming.slice(0, 5).map((u, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[15px]">{u.title}</p>
                  <p className="text-xs text-muted">
                    {formatShort(u.date)} · {u.days === 0 ? "hoy" : `en ${u.days} días`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {u.amount ? <span className="tabular text-sm font-medium">{money(u.amount)}</span> : null}
                  <Badge tone={u.kind === "corte" ? "neutral" : "accent"}>{u.kind === "corte" ? "Corte" : "Pago"}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle hint="Saldo de efectivo y cuentas. Lo actualizas tú cuando quieras.">Cuentas</CardTitle>
        <ul className="mb-3 divide-y divide-border">
          {accounts.map((a) => (
            <li key={a.id} className="py-2.5">
              <details>
                <summary className="flex cursor-pointer items-center justify-between gap-3">
                  <span className="truncate text-[15px]">{a.name}</span>
                  <span className="tabular font-medium">{money(a.balance, true)}</span>
                </summary>
                <div className="mt-2 space-y-2">
                  <AccountForm account={a} />
                  <ConfirmButton action={archiveAccount.bind(null, a.id)} confirmText="¿Quitar esta cuenta?">
                    Quitar
                  </ConfirmButton>
                </div>
              </details>
            </li>
          ))}
        </ul>
        <AccountForm />
      </Card>
    </div>
  );
}
