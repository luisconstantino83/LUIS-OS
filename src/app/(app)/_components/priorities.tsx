"use client";

import clsx from "clsx";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Card, CardTitle, buttonClass } from "@/components/ui";
import { carryOverPriorities, savePriority, setPriorityDone } from "../day-actions";
import { ErrorLine } from "./day";

type Slot = { id: string | null; title: string; done: boolean };

export function PrioritiesCard({
  date,
  initial,
  weeklyFocus,
  pendingYesterday,
}: {
  date: string;
  initial: { id: string; position: number; title: string; done: boolean }[];
  weeklyFocus: string[];
  pendingYesterday: number;
}) {
  const [slots, setSlots] = useState<Slot[]>(() =>
    [1, 2, 3].map((pos) => {
      const p = initial.find((x) => x.position === pos);
      return p ? { id: p.id, title: p.title, done: p.done } : { id: null, title: "", done: false };
    }),
  );
  const [saved, setSaved] = useState<string[]>(() => slots.map((s) => s.title));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = (i: number, patch: Partial<Slot>) =>
    setSlots((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const persist = (i: number) => {
    const title = slots[i].title.trim();
    if (title === saved[i]) return;
    start(async () => {
      const res = await savePriority(date, i + 1, title);
      if (!res.ok) return setError(res.error);
      setError(null);
      setSaved((prev) => prev.map((t, j) => (j === i ? title : t)));
      set(i, { id: title ? (res.id ?? slots[i].id) : null, done: title ? slots[i].done : false });
    });
  };

  const toggle = (i: number) => {
    const s = slots[i];
    if (!s.id) return;
    set(i, { done: !s.done });
    start(async () => {
      const res = await setPriorityDone(s.id as string, !s.done);
      if (!res.ok) {
        set(i, { done: s.done });
        setError(res.error);
      }
    });
  };

  const empty = slots.every((s) => !s.title);
  const doneCount = slots.filter((s) => s.title && s.done).length;
  const total = slots.filter((s) => s.title).length;

  return (
    <Card>
      <CardTitle
        hint="Máximo tres. Lo demás puede esperar."
        action={total > 0 ? <span className="tabular text-sm text-muted">{doneCount}/{total}</span> : null}
      >
        Las 3 prioridades de hoy
      </CardTitle>
      <ol className="space-y-2">
        {slots.map((s, i) => (
          <li key={i} className="flex items-center gap-3">
            <button
              type="button"
              role="checkbox"
              aria-checked={s.done}
              aria-label={`Marcar prioridad ${i + 1}`}
              disabled={!s.id}
              onClick={() => toggle(i)}
              className={clsx(
                "grid size-7 shrink-0 place-items-center rounded-lg border text-xs font-semibold transition active:scale-95",
                s.done ? "border-success bg-success text-bg" : "border-border text-muted",
                !s.id && "opacity-60",
              )}
            >
              {s.done ? <Check size={14} strokeWidth={3} /> : i + 1}
            </button>
            <input
              value={s.title}
              maxLength={140}
              onChange={(e) => set(i, { title: e.target.value })}
              onBlur={() => persist(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              placeholder={i === 0 ? "Tarea principal del día" : "Prioridad " + (i + 1)}
              aria-label={`Prioridad ${i + 1}`}
              className={clsx(
                "h-11 min-w-0 flex-1 rounded-xl border border-transparent bg-surface-2 px-3 outline-none transition placeholder:text-faint focus:border-accent",
                s.done && "text-muted line-through",
              )}
            />
          </li>
        ))}
      </ol>
      {empty && pendingYesterday > 0 ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await carryOverPriorities();
              if (!res.ok) return setError(res.error);
              for (const r of res.rows ?? []) {
                set(r.position - 1, { id: r.id, title: r.title, done: false });
                setSaved((prev) => prev.map((t, j) => (j === r.position - 1 ? r.title : t)));
              }
            })
          }
          className={clsx(buttonClass("secondary", "sm"), "mt-3")}
        >
          Traer {pendingYesterday} pendiente{pendingYesterday > 1 ? "s" : ""} de ayer
        </button>
      ) : null}
      {weeklyFocus.length > 0 ? (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-faint">Foco de la semana</p>
          <ul className="mt-1.5 space-y-1 text-sm text-muted">
            {weeklyFocus.map((f, i) => (
              <li key={i}>· {f}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <ErrorLine error={error} />
    </Card>
  );
}
