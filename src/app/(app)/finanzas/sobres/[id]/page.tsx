import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext } from "@/lib/session";
import { formatLong, formatShort } from "@/lib/dates";
import { money } from "@/lib/finance";
import { BUCKET_CATEGORIES, MOVEMENT_SIGN, goalMath, goalScenarios } from "@/lib/money";
import { Card, CardTitle, EmptyState, ProgressBar, Stat } from "@/components/ui";
import { ConfirmButton } from "@/components/forms";
import type { GoalRow } from "@/lib/finance-queries";
import { GoalEditForm, MoveForm } from "../../finance-forms";
import { archiveGoal, deleteMovement } from "../../actions";

export const metadata: Metadata = { title: "Sobre" };

const KIND_LABEL: Record<string, string> = {
  aporte: "Aporte",
  retiro: "Retiro",
  ajuste: "Saldo inicial / ajuste",
  prestamo_salida: "Préstamo interno (salida)",
  prestamo_entrada: "Préstamo interno (entrada)",
  prestamo_regreso: "Reposición",
};

export default async function GoalPage(props: PageProps<"/finanzas/sobres/[id]">) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await getContext();
  const [{ data: g }, { data: movs }] = await Promise.all([
    ctx.supabase.from("savings_goals").select("*").eq("id", id).maybeSingle<GoalRow>(),
    ctx.supabase.from("goal_movements").select("*").eq("goal_id", id).order("moved_on", { ascending: false }).order("created_at", { ascending: false }),
  ]);
  if (!g) notFound();
  const m = goalMath(g.target, g.saved, g.target_date, ctx.today);
  const scenarios = m.remaining ? goalScenarios(m.remaining, ctx.today, [500, 750, 1000]) : [];
  const list = (movs ?? []) as { id: string; kind: string; amount: number; moved_on: string; note: string | null; loan_id: string | null }[];

  return (
    <div className="space-y-4">
      <Link href="/finanzas/sobres" className="inline-block text-sm text-muted hover:text-fg">
        ← Sobres y metas
      </Link>
      <div>
        <p className="text-sm text-muted">{BUCKET_CATEGORIES.find((c) => c.value === g.category)?.label}{g.is_bucket ? " · sobre" : " · meta"}</p>
        <h2 className="text-2xl font-semibold tracking-tight">{g.name}</h2>
      </div>
      <Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Saldo" value={money(g.saved, true)} />
          <Stat label="Meta" value={g.target ? money(g.target) : "—"} />
          <Stat label="Faltante" value={m.remaining != null ? money(m.remaining) : "—"} />
          <Stat label="Semanas restantes" value={m.weeksLeft ?? "—"} sub={g.target_date ? formatShort(g.target_date) : undefined} />
        </div>
        {m.percent != null ? <ProgressBar value={m.percent} max={100} tone="success" className="mt-4" /> : null}
        {m.weeklyNeeded != null && (m.remaining ?? 0) > 0 ? (
          <p className="mt-3 text-[15px]">
            Aporte semanal necesario: <span className="font-semibold">{money(m.weeklyNeeded, true)}</span>
          </p>
        ) : null}
      </Card>

      {scenarios.length ? (
        <Card>
          <CardTitle hint="Escenarios, no promesas.">Si aporto por semana…</CardTitle>
          <ul className="divide-y divide-border text-sm">
            {scenarios.map((s) => (
              <li key={s.weekly} className="flex justify-between py-2">
                <span>{money(s.weekly)}/semana</span>
                <span className="tabular text-muted">
                  {s.weeks} semanas · {s.date ? formatLong(s.date) : "—"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardTitle>Registrar movimiento real</CardTitle>
        <MoveForm goalId={g.id} suggested={m.weeklyNeeded} />
      </Card>

      <Card>
        <CardTitle>Historial de aportaciones</CardTitle>
        {list.length === 0 ? (
          <EmptyState title="Sin movimientos" />
        ) : (
          <ul className="divide-y divide-border">
            {list.map((mv) => (
              <li key={mv.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[15px]">{KIND_LABEL[mv.kind]}</p>
                  <p className="truncate text-xs text-muted">
                    {formatShort(mv.moved_on)}
                    {mv.note ? ` · ${mv.note}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className={`tabular font-medium ${MOVEMENT_SIGN[mv.kind] > 0 ? "text-success" : ""}`}>
                    {MOVEMENT_SIGN[mv.kind] > 0 ? "+" : "−"}
                    {money(mv.amount, true)}
                  </span>
                  {!mv.loan_id ? (
                    <ConfirmButton action={deleteMovement.bind(null, mv.id)} confirmText="¿Eliminar este movimiento? El saldo se recalcula.">
                      ✕
                    </ConfirmButton>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle>Editar</CardTitle>
        <GoalEditForm id={g.id} name={g.name} target={g.target} targetDate={g.target_date} />
        {!g.is_bucket ? (
          <div className="mt-3 flex justify-end">
            <ConfirmButton action={archiveGoal.bind(null, g.id)} confirmText="¿Archivar esta meta? Su historial se conserva.">
              Archivar meta
            </ConfirmButton>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
