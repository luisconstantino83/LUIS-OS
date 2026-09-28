"use client";

import clsx from "clsx";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Card, CardTitle, Field, Input, ProgressBar, Select, buttonClass } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ErrorLine, useHabitToggle } from "../_components/day";
import { setHabitDone } from "../day-actions";
import { createHabit, setHabitArchived, updateHabitDays } from "./actions";
import type { Habit } from "@/lib/types";

const DAY_LETTERS = ["D", "L", "M", "M", "J", "V", "S"];
const GROUP_LABEL = { manana: "Mañana", noche: "Noche", general: "Crecimiento" } as const;

export function TodayChecklist({
  date,
  weekday,
  habits,
  doneIds,
  light,
}: {
  date: string;
  weekday: number;
  habits: Habit[];
  doneIds: string[];
  light: boolean;
}) {
  const { done, toggle, error } = useHabitToggle(date, new Set(doneIds));
  const groups = (["manana", "noche", "general"] as const).map((g) => {
    const all = habits.filter((h) => h.group_key === g);
    const today = all.filter((h) => h.active_days.includes(weekday) && !(g === "general" && light));
    const other = all.filter((h) => !today.includes(h));
    return { g, today, other };
  });
  return (
    <div className="space-y-4">
      {groups.map(({ g, today, other }) => {
        if (today.length === 0 && other.length === 0) return null;
        const count = today.filter((h) => done.has(h.id)).length;
        return (
          <Card key={g}>
            <CardTitle
              hint={g === "general" && light ? "Día de mantenimiento: nada de esto es obligatorio hoy." : undefined}
              action={today.length ? <span className="tabular text-sm text-muted">{count}/{today.length}</span> : null}
            >
              {GROUP_LABEL[g]}
            </CardTitle>
            {today.length ? <ProgressBar value={count} max={today.length} tone="success" className="mb-2" /> : null}
            <ul className="divide-y divide-border">
              {today.map((h) => (
                <HabitRow key={h.id} habit={h} on={done.has(h.id)} onToggle={() => toggle(h.id)} />
              ))}
            </ul>
            {other.length ? (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer py-1 text-muted">Hoy no toca ({other.length})</summary>
                <ul className="divide-y divide-border">
                  {other.map((h) => (
                    <HabitRow key={h.id} habit={h} on={done.has(h.id)} onToggle={() => toggle(h.id)} muted />
                  ))}
                </ul>
              </details>
            ) : null}
          </Card>
        );
      })}
      <ErrorLine error={error} />
    </div>
  );
}

function HabitRow({ habit, on, onToggle, muted }: { habit: Habit; on: boolean; onToggle: () => void; muted?: boolean }) {
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={on}
        onClick={onToggle}
        className="flex min-h-13 w-full items-center gap-3 py-2.5 text-left"
      >
        <span
          className={clsx(
            "grid size-6 shrink-0 place-items-center rounded-md border transition",
            on ? "border-success bg-success text-bg" : "border-border",
          )}
        >
          {on ? <Check size={14} strokeWidth={3} /> : null}
        </span>
        <span className={clsx("flex-1 text-[15px]", (on || muted) && "text-muted")}>{habit.name}</span>
        {habit.target_per_week ? <span className="text-xs text-faint">{habit.target_per_week}×/sem</span> : null}
      </button>
    </li>
  );
}

export function WeekGrid({
  dates,
  today,
  habits,
  logs,
}: {
  dates: string[];
  today: string;
  habits: Habit[];
  logs: { habit_id: string; log_date: string }[];
}) {
  const [set, setSet] = useState(() => new Set(logs.map((l) => `${l.habit_id}|${l.log_date}`)));
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const toggle = (habitId: string, date: string) => {
    const k = `${habitId}|${date}`;
    const on = !set.has(k);
    const prev = set;
    const next = new Set(set);
    if (on) next.add(k);
    else next.delete(k);
    setSet(next);
    start(async () => {
      const res = await setHabitDone(habitId, date, on);
      if (!res.ok) {
        setSet(prev);
        setError(res.error);
      }
    });
  };
  return (
    <Card>
      <CardTitle hint="Toca un día para corregir o registrar algo que olvidaste.">Esta semana</CardTitle>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[340px] border-separate border-spacing-y-1 text-sm">
          <thead>
            <tr>
              <th className="px-1 text-left font-normal text-faint" />
              {dates.map((d, i) => (
                <th key={d} className={clsx("w-9 text-center text-xs font-medium", d === today ? "text-fg" : "text-faint")}>
                  {DAY_LETTERS[i]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {habits.map((h) => (
              <tr key={h.id}>
                <td className="max-w-36 truncate px-1 pr-2 text-muted">{h.name}</td>
                {dates.map((d, i) => {
                  const on = set.has(`${h.id}|${d}`);
                  const future = d > today;
                  const planned = h.active_days.includes(i);
                  return (
                    <td key={d} className="text-center">
                      <button
                        type="button"
                        disabled={future}
                        aria-label={`${h.name} ${d}`}
                        aria-pressed={on}
                        onClick={() => toggle(h.id, d)}
                        className={clsx(
                          "mx-auto grid size-7 place-items-center rounded-lg transition active:scale-90",
                          on
                            ? "bg-success text-bg"
                            : planned
                              ? "bg-surface-2 ring-1 ring-inset ring-border"
                              : "bg-transparent ring-1 ring-inset ring-border/50",
                          future && "opacity-30",
                        )}
                      >
                        {on ? <Check size={13} strokeWidth={3} /> : null}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ErrorLine error={error} />
    </Card>
  );
}

function DayPicker({ value, onChange, name }: { value: number[]; onChange: (v: number[]) => void; name?: string }) {
  return (
    <div className="flex gap-1.5">
      {DAY_LETTERS.map((l, i) => {
        const on = value.includes(i);
        return (
          <label
            key={i}
            className={clsx(
              "grid size-9 cursor-pointer place-items-center rounded-full text-sm font-medium transition select-none",
              on ? "bg-fg text-bg" : "bg-surface-2 text-muted",
            )}
          >
            <input
              type="checkbox"
              className="sr-only"
              name={name}
              value={i}
              checked={on}
              onChange={() => onChange(on ? value.filter((d) => d !== i) : [...value, i])}
            />
            {l}
          </label>
        );
      })}
    </div>
  );
}

export function NewHabitForm() {
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [group, setGroup] = useState("general");
  return (
    <ActionForm action={createHabit} resetOnSuccess onSuccess={() => setDays([0, 1, 2, 3, 4, 5, 6])} className="space-y-3">
      <Field label="Nombre">
        <Input name="name" required maxLength={80} placeholder="Ej. Estirar 5 min" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Grupo">
          <Select name="group_key" value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="general">Crecimiento</option>
            <option value="manana">Higiene · mañana</option>
            <option value="noche">Higiene · noche</option>
          </Select>
        </Field>
        {group === "general" ? (
          <Field label="Meta semanal (opcional)">
            <Input name="target" type="number" inputMode="numeric" min={1} max={7} placeholder="—" />
          </Field>
        ) : null}
      </div>
      <Field label="Días">
        <DayPicker name="days" value={days} onChange={setDays} />
      </Field>
      <SubmitButton>Agregar hábito</SubmitButton>
    </ActionForm>
  );
}

export function HabitManager({ habits }: { habits: Habit[] }) {
  return (
    <ul className="divide-y divide-border">
      {habits.map((h) => (
        <ManagedHabit key={h.id} habit={h} />
      ))}
    </ul>
  );
}

function ManagedHabit({ habit }: { habit: Habit }) {
  const [editing, setEditing] = useState(false);
  const [days, setDays] = useState(habit.active_days);
  const [target, setTarget] = useState<string>(habit.target_per_week?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <li className={clsx("py-3", habit.archived && "opacity-60")}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium">{habit.name}</p>
          <p className="text-xs text-muted">
            {GROUP_LABEL[habit.group_key]} · {habit.active_days.map((d) => DAY_LETTERS[d]).join(" ")}
            {habit.target_per_week ? ` · meta ${habit.target_per_week}/sem` : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          {!habit.archived ? (
            <button type="button" className={buttonClass("ghost", "sm")} onClick={() => setEditing(!editing)}>
              {editing ? "Cerrar" : "Editar"}
            </button>
          ) : null}
          <button
            type="button"
            disabled={pending}
            className={buttonClass("ghost", "sm")}
            onClick={() =>
              start(async () => {
                const r = await setHabitArchived(habit.id, !habit.archived);
                if (!r.ok) setError(r.error);
              })
            }
          >
            {habit.archived ? "Restaurar" : "Pausar"}
          </button>
        </div>
      </div>
      {editing ? (
        <div className="mt-3 space-y-3 rounded-xl bg-surface-2 p-3">
          <DayPicker value={days} onChange={setDays} />
          {habit.group_key === "general" ? (
            <Field label="Meta semanal">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={7}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="—"
                className="bg-surface"
              />
            </Field>
          ) : null}
          <button
            type="button"
            disabled={pending}
            className={buttonClass("primary", "sm")}
            onClick={() =>
              start(async () => {
                const r = await updateHabitDays(habit.id, days, target ? Number(target) : null);
                if (!r.ok) setError(r.error);
                else setEditing(false);
              })
            }
          >
            Guardar
          </button>
        </div>
      ) : null}
      <ErrorLine error={error} />
    </li>
  );
}
