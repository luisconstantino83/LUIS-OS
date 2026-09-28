"use client";

import clsx from "clsx";
import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { Check, ChevronRight, Minus, Plus } from "lucide-react";
import { Segmented } from "@/components/forms";
import { updateDailyLog, setHabitDone, type DailyPatch } from "../day-actions";
import type { FoodQuality } from "@/lib/types";
import type { DayState } from "./day-defaults";

export type { DayState } from "./day-defaults";

/** Estado local optimista del día + persistencia en Supabase. */
export function useDay(date: string, initial: DayState) {
  const [state, setState] = useState<DayState>(initial);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const update = (patch: DailyPatch) => {
    const prev = state;
    setState({ ...state, ...patch });
    setError(null);
    start(async () => {
      const res = await updateDailyLog(date, patch);
      if (!res.ok) {
        setState(prev);
        setError(res.error);
      }
    });
  };
  return { state, update, error };
}

export function Row({
  label,
  sub,
  children,
  done,
  href,
}: {
  label: string;
  sub?: ReactNode;
  children?: ReactNode;
  done?: boolean;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        {done === undefined ? (
          <span className="grid size-5 shrink-0 place-items-center" aria-hidden>
            <span className="size-1.5 rounded-full bg-faint" />
          </span>
        ) : (
          <span
            className={clsx(
              "grid size-5 shrink-0 place-items-center rounded-full border transition",
              done ? "border-success bg-success text-bg" : "border-border",
            )}
            aria-hidden
          >
            {done ? <Check size={12} strokeWidth={3} /> : null}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium">{label}</p>
          {sub ? <p className="truncate text-[13px] text-muted">{sub}</p> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {children}
        {href ? <ChevronRight size={16} className="text-faint" /> : null}
      </div>
    </>
  );
  const cls = "flex min-h-14 items-center justify-between gap-3 py-2.5";
  return href ? (
    <Link href={href} className={clsx(cls, "-mx-2 rounded-xl px-2 transition hover:bg-surface-2")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 999,
  format,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  format?: (v: number) => ReactNode;
  label: string;
}) {
  const btn =
    "grid size-9 place-items-center rounded-full bg-surface-2 text-fg transition active:scale-95 disabled:opacity-40";
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={btn}
        aria-label={`Menos ${label}`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, +(value - step).toFixed(1)))}
      >
        <Minus size={15} />
      </button>
      <span className="tabular min-w-12 text-center text-[15px] font-semibold">{format ? format(value) : value}</span>
      <button
        type="button"
        className={btn}
        aria-label={`Más ${label}`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, +(value + step).toFixed(1)))}
      >
        <Plus size={15} />
      </button>
    </div>
  );
}

export function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={clsx(
        "grid size-9 place-items-center rounded-full border transition active:scale-95",
        on ? "border-success bg-success text-bg" : "border-border bg-surface-2 text-faint",
      )}
    >
      <Check size={16} strokeWidth={2.6} />
    </button>
  );
}

export function useHabitToggle(date: string, initialDone: Set<string>) {
  const [done, setDone] = useState(initialDone);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const toggle = (habitId: string) => {
    const next = new Set(done);
    const willBeDone = !next.has(habitId);
    if (willBeDone) next.add(habitId);
    else next.delete(habitId);
    const prev = done;
    setDone(next);
    setError(null);
    start(async () => {
      const res = await setHabitDone(habitId, date, willBeDone);
      if (!res.ok) {
        setDone(prev);
        setError(res.error);
      }
    });
  };
  return { done, toggle, error };
}

export const FOOD_OPTIONS: { value: FoodQuality; label: string }[] = [
  { value: "excelente", label: "Excelente" },
  { value: "buena", label: "Buena" },
  { value: "regular", label: "Regular" },
  { value: "mala", label: "Mala" },
];

export function FoodPicker({ value, onChange }: { value: FoodQuality | null; onChange: (v: FoodQuality) => void }) {
  return <Segmented size="sm" value={value} onChange={onChange} options={FOOD_OPTIONS} />;
}

export function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
      {error}
    </p>
  );
}
