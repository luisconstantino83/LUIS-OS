"use client";

import clsx from "clsx";
import { useMemo, useState, useTransition } from "react";
import { ActionForm, Segmented, SubmitButton } from "@/components/forms";
import { Field, Input, Select, Textarea, buttonClass } from "@/components/ui";
import { ErrorLine } from "../_components/day";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, money } from "@/lib/finance";
import { ACCOUNT_KINDS, ALLOC_CATEGORIES, BUCKET_CATEGORIES, DEBT_KINDS, planSummary } from "@/lib/money";
import type { CardRow } from "@/lib/finance-queries";
import {
  addDebt,
  addGoal,
  addTransaction,
  addWeekIncome,
  autoPlan,
  moveGoal,
  payCard,
  payDebt,
  repayLoan,
  saveAccount,
  saveCard,
  saveFinanceSettings,
  savePlan,
  setMonthlyIncome,
  takeLoan,
  updateGoal,
} from "./actions";

type Opt = { id: string; label: string };

// ---------------------------------------------------------------------------
// Movimientos
// ---------------------------------------------------------------------------
export function TransactionForm({ today }: { today: string }) {
  const [kind, setKind] = useState<"gasto" | "ingreso">("gasto");
  const cats = kind === "ingreso" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return (
    <ActionForm action={addTransaction} resetOnSuccess className="space-y-3">
      <Segmented
        name="kind"
        value={kind}
        onChange={setKind}
        options={[
          { value: "gasto", label: "Gasto" },
          { value: "ingreso", label: "Ingreso" },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Monto">
          <Input name="amount" type="number" inputMode="decimal" step="0.01" min="0.01" required placeholder="$0" />
        </Field>
        <Field label="Categoría">
          <Select name="category" key={kind} defaultValue={cats[0].value}>
            {cats.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha">
          <Input name="tx_date" type="date" defaultValue={today} />
        </Field>
        <Field label="Nota">
          <Input name="note" maxLength={300} placeholder="Opcional" />
        </Field>
      </div>
      <SubmitButton className="w-full">Registrar</SubmitButton>
    </ActionForm>
  );
}

export function IncomeForm({ value }: { value: number | null }) {
  return (
    <ActionForm action={setMonthlyIncome} className="flex items-end gap-2">
      <Field label="Ingreso mensual aproximado" className="flex-1" hint="Se usa para calcular qué % de tu ingreso ya está comprometido en MSI.">
        <Input name="monthly_income_estimate" type="number" inputMode="decimal" min={0} step="100" defaultValue={value ?? ""} placeholder="Ej. 18000" />
      </Field>
      <SubmitButton variant="secondary" className="mb-5">
        Guardar
      </SubmitButton>
    </ActionForm>
  );
}

// ---------------------------------------------------------------------------
// Plan semanal
// ---------------------------------------------------------------------------
export function WeekIncomeForm({ weekStart, today }: { weekStart: string; today: string }) {
  return (
    <ActionForm action={addWeekIncome.bind(null, weekStart)} resetOnSuccess className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ingreso fijo">
          <Input name="fijo" type="number" inputMode="decimal" step="0.01" min="0" placeholder="$0" />
        </Field>
        <Field label="Propinas">
          <Input name="propinas" type="number" inputMode="decimal" step="0.01" min="0" placeholder="$0" />
        </Field>
        <Field label="Ingresos extra">
          <Input name="extra" type="number" inputMode="decimal" step="0.01" min="0" placeholder="$0" />
        </Field>
        <Field label="Otros ingresos">
          <Input name="otros" type="number" inputMode="decimal" step="0.01" min="0" placeholder="$0" />
        </Field>
      </div>
      <Field label="Fecha">
        <Input name="tx_date" type="date" defaultValue={today} />
      </Field>
      <SubmitButton className="w-full">Registrar ingresos</SubmitButton>
    </ActionForm>
  );
}

export function PlanForm({
  weekStart,
  income,
  allocations,
  notes,
}: {
  weekStart: string;
  income: number;
  allocations: Record<string, { planned: number; actual: number | null }>;
  notes: string | null;
}) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      ALLOC_CATEGORIES.map((c) => [
        c.value,
        {
          planned: allocations[c.value]?.planned ? String(allocations[c.value].planned) : "",
          actual: allocations[c.value]?.actual != null ? String(allocations[c.value].actual) : "",
        },
      ]),
    ) as Record<string, { planned: string; actual: string }>,
  );
  const sum = useMemo(
    () =>
      planSummary(
        income,
        Object.entries(values).map(([category, v]) => ({ category, planned: Number(v.planned) || 0, actual: v.actual === "" ? null : Number(v.actual) })),
      ),
    [income, values],
  );
  const set = (cat: string, k: "planned" | "actual", v: string) => setValues((p) => ({ ...p, [cat]: { ...p[cat], [k]: v } }));
  return (
    <ActionForm action={savePlan.bind(null, weekStart)} className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_96px_96px] items-center gap-x-2 gap-y-1.5 text-sm">
        <span className="text-xs text-muted">Categoría</span>
        <span className="text-right text-xs text-muted">Planeado</span>
        <span className="text-right text-xs text-muted">Real</span>
        {ALLOC_CATEGORIES.map((c) => (
          <div key={c.value} className="contents">
            <label htmlFor={`p_${c.value}`} className="truncate">
              {c.label}
            </label>
            <Input
              id={`p_${c.value}`}
              name={`planned_${c.value}`}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={values[c.value].planned}
              onChange={(e) => set(c.value, "planned", e.target.value)}
              className="h-9 px-2 text-right"
              placeholder="0"
            />
            <Input
              name={`actual_${c.value}`}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={values[c.value].actual}
              onChange={(e) => set(c.value, "actual", e.target.value)}
              className="h-9 px-2 text-right"
              placeholder="—"
              aria-label={`Real ${c.label}`}
            />
          </div>
        ))}
      </div>
      <dl className="tabular space-y-1 rounded-xl bg-surface-2 p-3 text-sm">
        {(
          [
            ["Ingreso", sum.income, ""],
            ["Compromisos", sum.compromisos, "−"],
            ["Ahorro", sum.ahorro, "−"],
            ["Metas", sum.metas, "−"],
            ["Gustos", sum.gustos, "−"],
          ] as const
        ).map(([l, v, sign]) => (
          <div key={l} className="flex justify-between">
            <dt className="text-muted">{l}</dt>
            <dd>
              {sign} {money(v, true)}
            </dd>
          </div>
        ))}
        <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold">
          <dt>Dinero libre</dt>
          <dd className={sum.libre < 0 ? "text-warn" : ""}>{money(sum.libre, true)}</dd>
        </div>
        {sum.libre < 0 ? <p className="text-xs text-warn">Planeaste más de lo que entró. Diferencia: {money(-sum.libre, true)}.</p> : null}
      </dl>
      <Field label="Notas">
        <Textarea name="notes" defaultValue={notes ?? ""} className="min-h-16" />
      </Field>
      <SubmitButton className="w-full">Guardar plan</SubmitButton>
    </ActionForm>
  );
}

export function AutoPlanButton({ weekStart }: { weekStart: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await autoPlan(weekStart);
            if (!r.ok) setError(r.error);
          })
        }
        className={buttonClass("secondary", "sm")}
      >
        {pending ? "Calculando…" : "Repartir automáticamente"}
      </button>
      <ErrorLine error={error} />
    </div>
  );
}

export function FinanceSettingsForm({
  template,
  firstWeekCards,
  essentials,
}: {
  template: Record<string, number>;
  firstWeekCards: boolean;
  essentials: number | null;
}) {
  const cats = ALLOC_CATEGORIES.filter((c) => c.value !== "tarjetas");
  const [pcts, setPcts] = useState(() => Object.fromEntries(cats.map((c) => [c.value, String(template[c.value] ?? 0)])));
  const total = Object.values(pcts).reduce((s, v) => s + (Number(v) || 0), 0);
  return (
    <ActionForm action={saveFinanceSettings} className="space-y-4">
      <label className="flex items-start gap-3">
        <input type="checkbox" name="first_week_cards" defaultChecked={firstWeekCards} className="mt-1 size-4 accent-current" />
        <span>
          <span className="block text-[15px] font-medium">Primera semana del mes = tarjetas</span>
          <span className="block text-sm text-muted">El reparto automático cubre primero los pagos de tarjetas del mes. Solo planifica, no mueve dinero.</span>
        </span>
      </label>
      <div>
        <p className="mb-2 text-[13px] font-medium text-muted">
          Plantilla del reparto (sobre lo que queda) · <span className={total > 100 ? "text-danger" : ""}>{total}%</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          {cats.map((c) => (
            <label key={c.value} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-1.5 text-sm">
              <span className="truncate">{c.label}</span>
              <span className="flex items-center gap-1">
                <input
                  name={`pct_${c.value}`}
                  type="number"
                  min={0}
                  max={100}
                  value={pcts[c.value]}
                  onChange={(e) => setPcts({ ...pcts, [c.value]: e.target.value })}
                  className="h-8 w-14 rounded-md border border-border bg-surface px-1.5 text-right"
                />
                %
              </span>
            </label>
          ))}
        </div>
      </div>
      <Field label="Gastos esenciales mensuales (opcional)" hint="Para calcular cuántos meses cubre tu fondo de emergencia. Si lo dejas vacío, se estima con tus gastos registrados.">
        <Input name="essential_monthly_expenses" type="number" inputMode="decimal" min={0} defaultValue={essentials ?? ""} />
      </Field>
      <SubmitButton variant="secondary">Guardar configuración</SubmitButton>
    </ActionForm>
  );
}

// ---------------------------------------------------------------------------
// Tarjetas
// ---------------------------------------------------------------------------
export function CardForm({ card, onDone }: { card?: CardRow; onDone?: () => void }) {
  const n = (v: number | null | undefined) => (v == null ? "" : String(v));
  const num = (name: string, label: string, v: number | null | undefined, hint?: string) => (
    <Field label={label} hint={hint}>
      <Input name={name} type="number" inputMode="decimal" step="0.01" min={0} defaultValue={n(v)} />
    </Field>
  );
  return (
    <ActionForm action={saveCard.bind(null, card?.id ?? null)} resetOnSuccess={!card} onSuccess={onDone} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Banco">
          <Input name="bank" required maxLength={60} defaultValue={card?.bank} placeholder="Ej. Nu" />
        </Field>
        <Field label="Nombre">
          <Input name="nickname" maxLength={60} defaultValue={card?.nickname ?? ""} placeholder="Ej. Nu Oro" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {num("credit_limit", "Límite", card?.credit_limit)}
        <Field label="Saldo utilizado">
          <Input name="balance" type="number" inputMode="decimal" step="0.01" defaultValue={n(card?.balance)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Día de corte">
          <Input name="cut_day" type="number" inputMode="numeric" min={1} max={31} defaultValue={n(card?.cut_day)} />
        </Field>
        <Field label="Día límite de pago">
          <Input name="due_day" type="number" inputMode="numeric" min={1} max={31} defaultValue={n(card?.due_day)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {num("no_interest_payment", "Pago para no generar intereses", card?.no_interest_payment)}
        {num("min_payment", "Pago mínimo", card?.min_payment)}
      </div>
      <details className="rounded-xl bg-surface-2 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">Más datos (opcionales)</summary>
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {num("monthly_payment", "Pago planeado", card?.monthly_payment)}
            {num("annual_fee", "Anualidad", card?.annual_fee)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {num("cat_rate", "CAT %", card?.cat_rate)}
            {num("interest_rate", "Tasa %", card?.interest_rate)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Últimos 4 (opcional)" hint="Nunca el número completo, CVV ni NIP.">
              <Input name="last4" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" defaultValue={card?.last4 ?? ""} autoComplete="off" />
            </Field>
            <Field label="Alerta de utilización" hint="% del límite">
              <Input name="alert_utilization" type="number" inputMode="numeric" min={1} max={100} defaultValue={card?.alert_utilization ?? 30} />
            </Field>
          </div>
        </div>
      </details>
      <SubmitButton>{card ? "Guardar cambios" : "Agregar tarjeta"}</SubmitButton>
    </ActionForm>
  );
}

export function EditCard({ card }: { card: CardRow }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={buttonClass("ghost", "sm")} onClick={() => setOpen(!open)}>
        {open ? "Cerrar" : "Editar"}
      </button>
      {open ? (
        <div className="mt-3 basis-full rounded-xl bg-surface-2 p-3">
          <CardForm card={card} onDone={() => setOpen(false)} />
        </div>
      ) : null}
    </>
  );
}

export function PayCardForm({ cardId, suggested, month }: { cardId: string; suggested: number | null; month: string }) {
  return (
    <ActionForm action={payCard.bind(null, cardId)} resetOnSuccess className="space-y-2">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
        <Input name="amount" type="number" inputMode="decimal" step="0.01" min="0.01" required defaultValue={suggested ?? ""} aria-label="Monto pagado" placeholder="Monto" className="h-10" />
        <Input name="paid_on" type="date" className="h-10" aria-label="Fecha de pago" />
      </div>
      <input type="hidden" name="period_month" value={month} />
      <SubmitButton size="sm" className="w-full">
        Registrar pago real
      </SubmitButton>
    </ActionForm>
  );
}

// ---------------------------------------------------------------------------
// Sobres / metas / préstamos internos
// ---------------------------------------------------------------------------
export function GoalForm() {
  return (
    <ActionForm action={addGoal} resetOnSuccess className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sobre">
          <Select name="category" defaultValue="viajes">
            {BUCKET_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Meta">
          <Input name="name" required maxLength={80} placeholder="Ej. Viaje León" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Precio / meta">
          <Input name="target" type="number" inputMode="decimal" min={1} placeholder="$" />
        </Field>
        <Field label="Fecha objetivo">
          <Input name="target_date" type="date" />
        </Field>
      </div>
      <Field label="Ya ahorrado (opcional)">
        <Input name="saved" type="number" inputMode="decimal" min={0} placeholder="0" />
      </Field>
      <SubmitButton>Crear meta</SubmitButton>
    </ActionForm>
  );
}

export function GoalEditForm({ id, name, target, targetDate }: { id: string; name: string; target: number | null; targetDate: string | null }) {
  return (
    <ActionForm action={updateGoal.bind(null, id)} className="space-y-3">
      <Field label="Nombre">
        <Input name="name" required maxLength={80} defaultValue={name} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Meta">
          <Input name="target" type="number" inputMode="decimal" min={1} defaultValue={target ?? ""} />
        </Field>
        <Field label="Fecha objetivo">
          <Input name="target_date" type="date" defaultValue={targetDate ?? ""} />
        </Field>
      </div>
      <SubmitButton variant="secondary">Guardar</SubmitButton>
    </ActionForm>
  );
}

export function MoveForm({ goalId, suggested }: { goalId: string; suggested?: number | null }) {
  const [kind, setKind] = useState<"aporte" | "retiro">("aporte");
  return (
    <ActionForm action={moveGoal.bind(null, goalId)} resetOnSuccess className="space-y-2">
      <Segmented
        size="sm"
        name="kind"
        value={kind}
        onChange={setKind}
        options={[
          { value: "aporte", label: "Aportar" },
          { value: "retiro", label: "Retirar (gasto)" },
        ]}
      />
      <div className="flex gap-2">
        <Input name="amount" type="number" inputMode="decimal" step="0.01" min="0.01" required placeholder={suggested ? `Sugerido ${money(suggested)}` : "Monto"} aria-label="Monto" className="h-10" />
        <SubmitButton size="sm" className="h-10">
          Registrar
        </SubmitButton>
      </div>
      <Input name="note" maxLength={300} placeholder="Nota (opcional)" className="h-10" />
      {kind === "retiro" ? (
        <p className="text-xs text-muted">¿Lo vas a reponer? Usa &quot;Tomar prestado&quot; en Sobres para que quede como dinero por reponer.</p>
      ) : null}
    </ActionForm>
  );
}

export function LoanForm({ goals }: { goals: Opt[] }) {
  return (
    <ActionForm action={takeLoan} resetOnSuccess className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tomé de">
          <Select name="from_goal_id" required defaultValue="">
            <option value="" disabled>
              Sobre…
            </option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Para (opcional)">
          <Select name="to_goal_id" defaultValue="">
            <option value="">Un gasto</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Monto">
          <Input name="amount" type="number" inputMode="decimal" step="0.01" min="0.01" required />
        </Field>
        <Field label="Motivo">
          <Input name="purpose" maxLength={200} placeholder="Ej. Emergencia médica" />
        </Field>
      </div>
      <SubmitButton variant="secondary">Registrar como dinero por reponer</SubmitButton>
    </ActionForm>
  );
}

export function RepayForm({ loanId, pending }: { loanId: string; pending: number }) {
  return (
    <ActionForm action={repayLoan.bind(null, loanId)} resetOnSuccess className="flex gap-2">
      <Input name="amount" type="number" inputMode="decimal" step="0.01" min="0.01" max={pending} required defaultValue={pending} aria-label="Monto a reponer" className="h-9" />
      <SubmitButton size="sm" variant="secondary">
        Reponer
      </SubmitButton>
    </ActionForm>
  );
}

// ---------------------------------------------------------------------------
// Deudas
// ---------------------------------------------------------------------------
export function DebtForm() {
  return (
    <ActionForm action={addDebt} resetOnSuccess className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo">
          <Select name="kind" defaultValue="prestamo">
            {DEBT_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Persona / institución">
          <Input name="creditor" required maxLength={80} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Saldo original">
          <Input name="original_amount" type="number" inputMode="decimal" step="0.01" min="0.01" required />
        </Field>
        <Field label="Saldo actual" hint="Si ya pagaste una parte.">
          <Input name="current_balance" type="number" inputMode="decimal" step="0.01" min="0" />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Pago">
          <Input name="payment_amount" type="number" inputMode="decimal" step="0.01" min="0" />
        </Field>
        <Field label="Día de pago">
          <Input name="payment_day" type="number" inputMode="numeric" min={1} max={31} />
        </Field>
        <Field label="Interés % anual">
          <Input name="interest_rate" type="number" inputMode="decimal" step="0.01" min="0" />
        </Field>
      </div>
      <Field label="Notas">
        <Input name="notes" maxLength={2000} />
      </Field>
      <SubmitButton>Registrar deuda</SubmitButton>
    </ActionForm>
  );
}

export function PayDebtForm({ debtId, suggested }: { debtId: string; suggested: number | null }) {
  return (
    <ActionForm action={payDebt.bind(null, debtId)} resetOnSuccess className="space-y-2">
      <div className="flex gap-2">
        <Input name="amount" type="number" inputMode="decimal" step="0.01" min="0.01" required defaultValue={suggested ?? ""} aria-label="Monto pagado" className="h-10" />
        <SubmitButton size="sm" className="h-10">
          Registrar pago
        </SubmitButton>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" name="as_expense" defaultChecked className="size-4 accent-current" />
        Registrar también como gasto (Deudas)
      </label>
    </ActionForm>
  );
}

// ---------------------------------------------------------------------------
// Cuentas
// ---------------------------------------------------------------------------
export function AccountForm({ account }: { account?: { id: string; name: string; kind: string; balance: number } }) {
  return (
    <ActionForm action={saveAccount.bind(null, account?.id ?? null)} resetOnSuccess={!account} className={clsx("grid gap-2", "grid-cols-[minmax(0,1fr)_110px]")}>
      <Input name="name" required maxLength={60} defaultValue={account?.name} placeholder="Ej. BBVA débito" aria-label="Nombre de la cuenta" className="h-10" />
      <Select name="kind" defaultValue={account?.kind ?? "banco"} className="h-10" aria-label="Tipo">
        {ACCOUNT_KINDS.map((k) => (
          <option key={k.value} value={k.value}>
            {k.label}
          </option>
        ))}
      </Select>
      <Input name="balance" type="number" inputMode="decimal" step="0.01" required defaultValue={account?.balance ?? ""} placeholder="Saldo" aria-label="Saldo" className="h-10" />
      <SubmitButton size="sm" variant="secondary" className="h-10">
        {account ? "Actualizar" : "Agregar"}
      </SubmitButton>
    </ActionForm>
  );
}
