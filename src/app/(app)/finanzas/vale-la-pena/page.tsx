import type { Metadata } from "next";
import { getContext } from "@/lib/session";
import { addDays, weekStart } from "@/lib/dates";
import { msiSummary } from "@/lib/finance";
import { goalMath, netSavings, planSummary, weeklyIncome } from "@/lib/money";
import { getCards, getGoals } from "@/lib/finance-queries";
import type { MsiPurchase } from "@/lib/types";
import { WorthItForm } from "./worth-it-form";

export const metadata: Metadata = { title: "Simulador de compra" };

export default async function SimulatorPage() {
  const ctx = await getContext();
  const ws = weekStart(ctx.today);
  const from = addDays(ws, -56);
  const [cards, goals, { data: msis }, { data: incomes }, { data: movs }, { data: plan }, { data: weekTx }] = await Promise.all([
    getCards(ctx),
    getGoals(ctx),
    ctx.supabase.from("msi_purchases").select("start_date,months,monthly_payment"),
    ctx.supabase.from("transactions").select("amount").eq("kind", "ingreso").gte("tx_date", from).lt("tx_date", ws),
    ctx.supabase.from("goal_movements").select("kind,amount").gte("moved_on", from).lt("moved_on", ws),
    ctx.supabase.from("weekly_money_plans").select("weekly_allocations(category,planned,actual)").eq("week_start", ws).maybeSingle(),
    ctx.supabase.from("transactions").select("kind,category,amount").gte("tx_date", ws).lte("tx_date", addDays(ws, 6)),
  ]);
  const estimate = ctx.profile.monthly_income_estimate != null ? Number(ctx.profile.monthly_income_estimate) : null;
  const incomeSum = ((incomes ?? []) as { amount: number }[]).reduce((s, t) => s + Number(t.amount), 0);
  const avgMonthlyIncome = incomeSum > 0 ? Math.round((incomeSum / 8) * (52 / 12)) : null;
  const income = estimate ?? avgMonthlyIncome;
  const current = msiSummary((msis ?? []) as MsiPurchase[], ctx.today, income);
  const avgWeeklySavings = Math.round((netSavings((movs ?? []) as { kind: string; amount: number }[]) / 8) * 100) / 100;
  const allocs = (plan as { weekly_allocations?: { category: string; planned: number; actual: number | null }[] } | null)?.weekly_allocations ?? [];
  const weekIncome = weeklyIncome((weekTx ?? []) as { kind: string; category: string; amount: number }[]).total;
  const weeklyFree = allocs.length ? planSummary(weekIncome, allocs).libre : null;
  const goalList = goals
    .filter((g) => !g.is_bucket)
    .map((g) => ({ name: g.name, remaining: goalMath(g.target, g.saved, g.target_date, ctx.today).remaining ?? 0 }))
    .filter((g) => g.remaining > 0)
    .slice(0, 4);

  return (
    <>
      <p className="mb-4 text-sm text-muted">New purchase simulator · no te dice qué hacer, te muestra el impacto completo.</p>
      <WorthItForm
        cards={cards.map((c) => ({ id: c.id, label: c.nickname ? `${c.bank} · ${c.nickname}` : c.bank }))}
        currentMonthly={current.monthlyCommitted}
        income={income}
        incomeSource={estimate != null ? "estimado" : avgMonthlyIncome != null ? "promedio" : null}
        avgWeeklySavings={avgWeeklySavings}
        weeklyFree={weeklyFree}
        goals={goalList}
        today={ctx.today}
        thisMonth={ctx.today.slice(0, 7)}
      />
    </>
  );
}
