"use client";

import clsx from "clsx";
import { useState } from "react";
import { ActionForm, Segmented, SubmitButton } from "@/components/forms";
import { Card, CardTitle, Field, Input, LinkButton, ProgressBar, Select } from "@/components/ui";
import { EXPENSE_CATEGORIES, commitmentLevel, money } from "@/lib/finance";
import { formatLong, addDays } from "@/lib/dates";
import { purchaseScenarios } from "@/lib/money";
import { registerPurchase } from "../actions";

const QUESTIONS = [
  { key: "q_salud", label: "¿Mejora mi salud?", good: true },
  { key: "q_dinero", label: "¿Me ayuda a ganar dinero?", good: true },
  { key: "q_profesional", label: "¿Me ayuda profesionalmente?", good: true },
  { key: "q_necesito", label: "¿Lo necesito?", good: true },
  { key: "q_duplicado", label: "¿Ya tengo algo que hace lo mismo?", good: false },
] as const;

const OPTIONS = [3, 6, 9, 12, 18, 24];

export function WorthItForm({
  cards,
  currentMonthly,
  income,
  incomeSource,
  avgWeeklySavings,
  weeklyFree,
  goals,
  today,
  thisMonth,
}: {
  cards: { id: string; label: string }[];
  currentMonthly: number;
  income: number | null;
  incomeSource: "estimado" | "promedio" | null;
  avgWeeklySavings: number;
  weeklyFree: number | null;
  goals: { name: string; remaining: number }[];
  today: string;
  thisMonth: string;
}) {
  const [mode, setMode] = useState<"msi" | "contado">("msi");
  const [price, setPrice] = useState("");
  const [down, setDown] = useState("");
  const [months, setMonths] = useState(12);
  const [answers, setAnswers] = useState<Record<string, boolean | undefined>>({});

  const total = Number(price) || 0;
  const dp = Math.min(Number(down) || 0, Math.max(0, total - 0.01));
  const scen = purchaseScenarios(total, dp, [12, 18, 24]);
  const monthly = mode === "msi" && total > 0 ? Math.round(((total - dp) / months) * 100) / 100 : 0;
  const newMonthly = currentMonthly + monthly;
  const pctBefore = income ? Math.round((currentMonthly / income) * 1000) / 10 : null;
  const pctAfter = income ? Math.round((newMonthly / income) * 1000) / 10 : null;
  const level = commitmentLevel(pctAfter);
  const weeklyImpact = monthly / (52 / 12);
  const savingsRateBefore = income ? Math.round(((avgWeeklySavings * 52) / 12 / income) * 1000) / 10 : null;
  const newWeeklySavings = Math.max(0, avgWeeklySavings - weeklyImpact);
  const savingsRateAfter = income ? Math.round(((newWeeklySavings * 52) / 12 / income) * 1000) / 10 : null;
  const eta = (remaining: number, weekly: number) => (weekly > 0 ? formatLong(addDays(today, Math.ceil(remaining / weekly) * 7)) : "sin fecha con este ritmo");
  const yes = QUESTIONS.filter((q) => answers[q.key] === q.good).length;
  const answered = QUESTIONS.filter((q) => answers[q.key] !== undefined).length;

  return (
    <ActionForm action={registerPurchase} className="space-y-4">
      <Card>
        <CardTitle>La compra</CardTitle>
        <div className="space-y-3">
          <Field label="¿Qué quieres comprar?">
            <Input name="product" required maxLength={120} placeholder="Ej. Cámara" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Precio">
              <Input name="total_price" type="number" inputMode="decimal" min="0.01" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} placeholder="$0" />
            </Field>
            <Field label="Enganche (opcional)">
              <Input name="down_payment" type="number" inputMode="decimal" min="0" step="0.01" value={down} onChange={(e) => setDown(e.target.value)} placeholder="$0" />
            </Field>
          </div>
          <Segmented
            name="mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: "msi", label: "Meses sin intereses" },
              { value: "contado", label: "Contado" },
            ]}
          />
          {mode === "msi" ? (
            <>
              {total > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {scen.map((s) => (
                    <button
                      key={s.months}
                      type="button"
                      onClick={() => setMonths(s.months)}
                      className={clsx("rounded-xl p-2.5 text-left transition", months === s.months ? "bg-fg text-bg" : "bg-surface-2")}
                    >
                      <span className="block text-xs opacity-70">{s.months} MSI</span>
                      <span className="tabular block font-semibold">{money(s.monthly)}/mes</span>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Meses">
                  <Select name="months" value={String(months)} onChange={(e) => setMonths(Number(e.target.value))}>
                    {OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n} meses
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Primer pago">
                  <Input name="start_month" type="month" defaultValue={thisMonth} />
                </Field>
              </div>
              <Field label="Tarjeta">
                <Select name="card_id" defaultValue="">
                  <option value="">Sin asignar</option>
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          ) : (
            <Field label="Categoría del gasto">
              <Select name="category" defaultValue="equipo">
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle hint="Responde con honestidad. No hay respuesta incorrecta.">¿Vale la pena?</CardTitle>
        <ul className="divide-y divide-border">
          {QUESTIONS.map((q) => (
            <li key={q.key} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-[15px]">{q.label}</span>
              <input type="hidden" name={q.key} value={answers[q.key] ? "on" : ""} />
              <div className="flex shrink-0 gap-1">
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => setAnswers({ ...answers, [q.key]: v })}
                    className={clsx("h-9 w-12 rounded-lg text-sm font-medium transition", answers[q.key] === v ? "bg-fg text-bg" : "bg-surface-2 text-muted")}
                  >
                    {v ? "Sí" : "No"}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
        {answered > 0 ? <p className="mt-3 text-sm text-muted">{yes} de {QUESTIONS.length} respuestas a favor de la compra.</p> : null}
      </Card>

      <Card>
        <CardTitle>Impacto</CardTitle>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-muted">Mensualidad</dt>
            <dd className="tabular mt-0.5 text-xl font-semibold">{mode === "msi" ? money(monthly, true) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Total a pagar</dt>
            <dd className="tabular mt-0.5 text-xl font-semibold">{money(total, true)}</dd>
          </div>
        </dl>
        {mode === "msi" && total > 0 ? (
          <div className="mt-4 space-y-3 text-sm">
            <p className="rounded-xl bg-surface-2 p-3 text-[15px]">
              Esta compra comprometería <b className="tabular">{money(monthly, true)}</b> mensuales durante <b>{months} meses</b>.
            </p>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-4 gap-y-1.5">
              <span className="text-muted" />
              <span className="text-xs text-muted">Planeado hoy</span>
              <span className="text-xs text-muted">Con la compra</span>
              <span>Compromiso mensual MSI</span>
              <span className="tabular">{money(currentMonthly)}</span>
              <span className="tabular font-medium">{money(newMonthly)}</span>
              {pctAfter != null ? (
                <>
                  <span>% del ingreso</span>
                  <span className="tabular">{pctBefore}%</span>
                  <span className="tabular font-medium">{pctAfter}%</span>
                </>
              ) : null}
              {weeklyFree != null ? (
                <>
                  <span>Dinero libre semanal</span>
                  <span className="tabular">{money(weeklyFree)}</span>
                  <span className="tabular font-medium">{money(weeklyFree - weeklyImpact)}</span>
                </>
              ) : null}
              {savingsRateBefore != null ? (
                <>
                  <span>Tasa de ahorro (si sale del ahorro)</span>
                  <span className="tabular">{savingsRateBefore}%</span>
                  <span className="tabular font-medium">{savingsRateAfter}%</span>
                </>
              ) : null}
            </div>
            {pctAfter != null ? (
              <ProgressBar value={pctAfter} max={100} tone={level?.tone === "high" ? "danger" : level?.tone === "warn" ? "warn" : "success"} />
            ) : (
              <p className="text-muted">Registra ingresos o tu ingreso mensual para ver porcentajes.</p>
            )}
            {incomeSource === "promedio" ? <p className="text-xs text-faint">Ingreso mensual estimado con tus últimas 8 semanas.</p> : null}
            {goals.length && avgWeeklySavings > 0 ? (
              <div className="rounded-xl bg-surface-2 p-3">
                <p className="mb-1.5 text-[13px] font-medium">Fecha de otras metas (si la mensualidad saliera de tu ahorro)</p>
                <ul className="space-y-1">
                  {goals.map((g) => (
                    <li key={g.name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                      <span className="truncate">{g.name}</span>
                      <span className="tabular text-right text-muted">
                        {eta(g.remaining, avgWeeklySavings)} → <span className="text-fg">{eta(g.remaining, newWeeklySavings)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>

      <div className="flex gap-2">
        <LinkButton href="/finanzas/msi" variant="secondary" className="flex-1">
          Mejor no
        </LinkButton>
        <SubmitButton className="flex-1">Registrar compra</SubmitButton>
      </div>
    </ActionForm>
  );
}
