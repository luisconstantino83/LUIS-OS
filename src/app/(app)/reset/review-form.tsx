"use client";

import clsx from "clsx";
import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, CardTitle, Field, Input, Textarea } from "@/components/ui";
import type { WeeklyReview } from "@/lib/types";
import { saveReview } from "./actions";
import type { PickerGroup } from "@/components/skill-picker";

const FEELINGS = ["Muy pesado", "Pesado", "Normal", "Bien", "Muy bien"];

export function ReviewForm({
  weekStart,
  snapshot,
  review,
  detectedWins,
  toAdjust,
  suggestions,
  groups,
}: {
  groups: PickerGroup[];
  weekStart: string;
  snapshot: Record<string, unknown>;
  review: WeeklyReview | null;
  detectedWins: string[];
  toAdjust: string[];
  suggestions: string[];
}) {
  const [score, setScore] = useState<number | null>(review?.feeling_score ?? null);
  const [prio, setPrio] = useState<string[]>(() => {
    const p = review?.top_priorities ?? [];
    return [p[0] ?? "", p[1] ?? "", p[2] ?? ""];
  });
  const addSuggestion = (s: string) => {
    const i = prio.findIndex((p) => !p.trim());
    if (i === -1 || prio.includes(s)) return;
    setPrio(prio.map((p, j) => (j === i ? s : p)));
  };

  return (
    <ActionForm action={saveReview.bind(null, weekStart, snapshot)} className="space-y-4">
      <Card>
        <CardTitle>Lo que solo tú sabes</CardTitle>
        <div className="space-y-3">
          <Field label="¿Qué avancé de servicio social / titulación?">
            <Textarea name="career_progress" defaultValue={review?.career_progress ?? ""} className="min-h-16" />
          </Field>
          <Field label="¿Qué salió bien en el trabajo?">
            <Textarea name="work_went_well" defaultValue={review?.work_went_well ?? ""} className="min-h-16" />
          </Field>
          <Field label="¿Qué problema se repitió?">
            <Textarea name="work_repeated_problem" defaultValue={review?.work_repeated_problem ?? ""} className="min-h-16" />
          </Field>
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-muted">¿Cómo me sentí esta semana?</p>
            <input type="hidden" name="feeling_score" value={score ?? ""} />
            <div className="grid grid-cols-5 gap-1.5">
              {FEELINGS.map((f, i) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setScore(i + 1)}
                  className={clsx(
                    "h-10 rounded-lg px-1 text-xs font-medium transition",
                    score === i + 1 ? "bg-fg text-bg" : "bg-surface-2 text-muted",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
            <Textarea name="feeling" defaultValue={review?.feeling ?? ""} placeholder="Opcional: en pocas palabras" className="mt-2 min-h-16" />
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle hint="Lo que produjiste pesa más que lo que consumiste.">Skills</CardTitle>
        <div className="space-y-3">
          <Field label="¿Qué puedo hacer ahora que la semana pasada no podía?">
            <Textarea name="can_do_now" defaultValue={review?.can_do_now ?? ""} className="min-h-16" />
          </Field>
          <Field label="¿Qué aprendí esta semana?">
            <Textarea name="learned_text" defaultValue={review?.learned_text ?? ""} className="min-h-16" />
          </Field>
          <Field label="¿Qué skill quiero mejorar la próxima semana?" hint="Se vuelve tu Skill of the Week.">
            <select
              name="next_skill_id"
              defaultValue={review?.next_skill_id ?? ""}
              className="h-11 w-full min-w-0 appearance-none rounded-xl border border-border bg-surface-2 px-3 text-fg outline-none focus:border-accent"
            >
              <option value="">—</option>
              {groups.map((g) => (
                <optgroup key={g.id} label={g.name}>
                  {g.skills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle>Dinero</CardTitle>
        <div className="space-y-3">
          <Field label="¿Hubo gastos inesperados?">
            <Textarea name="unexpected_expenses" defaultValue={review?.unexpected_expenses ?? ""} className="min-h-16" />
          </Field>
          <Field label="Money win of the week">
            <Input name="money_win" defaultValue={review?.money_win ?? ""} maxLength={500} />
          </Field>
          <Field label="Money problem">
            <Input name="money_problem" defaultValue={review?.money_problem ?? ""} maxLength={500} />
          </Field>
          <Field label="Next money move">
            <Input name="next_money_move" defaultValue={review?.next_money_move ?? ""} maxLength={500} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle>Cierre</CardTitle>
        <div className="space-y-3">
          <Field label="Wins" hint={detectedWins.length ? `Detectado: ${detectedWins.join(", ")} al 100%.` : undefined}>
            <Textarea name="wins" defaultValue={review?.wins ?? ""} className="min-h-16" />
          </Field>
          <Field
            label="Problems"
            hint={toAdjust.length ? `Por ajustar (sin culpa): ${toAdjust.join(", ")}.` : undefined}
          >
            <Textarea name="problems" defaultValue={review?.problems ?? ""} className="min-h-16" />
          </Field>
          <Field label="Lessons">
            <Textarea name="lessons" defaultValue={review?.lessons ?? ""} className="min-h-16" />
          </Field>
          <Field label="Next week">
            <Textarea name="next_week" defaultValue={review?.next_week ?? ""} className="min-h-16" />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle hint="Solo tres. Aparecerán en tu pantalla de Hoy toda la próxima semana.">
          Top 3 priorities next week
        </CardTitle>
        <div className="space-y-2">
          {prio.map((p, i) => (
            <Input
              key={i}
              name={`p${i + 1}`}
              value={p}
              maxLength={140}
              onChange={(e) => setPrio(prio.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={`Prioridad ${i + 1}`}
            />
          ))}
        </div>
        {suggestions.length ? (
          <div className="mt-3">
            <p className="mb-1.5 text-xs text-muted">Sugerencias según tu semana:</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addSuggestion(s)}
                  disabled={prio.includes(s) || prio.every((p) => p.trim())}
                  className="rounded-full bg-surface-2 px-3 py-1 text-sm text-muted transition hover:text-fg disabled:opacity-40"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      <SubmitButton className="w-full">{review?.completed_at ? "Actualizar semana" : "Cerrar semana"}</SubmitButton>
    </ActionForm>
  );
}
