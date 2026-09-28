"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import { BatteryLow, Moon } from "lucide-react";
import { Card, CardTitle, ProgressBar, buttonClass } from "@/components/ui";
import {
  ErrorLine,
  FoodPicker,
  Row,
  Stepper,
  Toggle,
  useDay,
  useHabitToggle,
  type DayState,
} from "./day";

export interface TodayProps {
  date: string;
  initial: DayState;
  goals: { water: number; pages: number; meditation: number; sleep: number };
  work: string;
  workout: { focus: string | null; done: boolean; light: boolean };
  mainTask: string | null;
  mainTaskDone: boolean;
  growth: { id: string; name: string; activeToday: boolean }[];
  habitDone: string[];
  hygiene: { done: number; total: number };
  /** Contenido que solo se muestra fuera de modo agotado. */
  top?: ReactNode;
  bottom?: ReactNode;
}

export function TodayView(props: TodayProps) {
  const { state, update, error } = useDay(props.date, props.initial);
  const habits = useHabitToggle(props.date, new Set(props.habitDone));

  if (state.exhausted) {
    return <ExhaustedView state={state} update={update} error={error} goals={props.goals} />;
  }

  const { goals } = props;
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => update({ exhausted: true })}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3.5 text-left transition hover:bg-surface-2 active:scale-[0.99]"
      >
        <span className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-warn-soft text-warn">
            <BatteryLow size={18} />
          </span>
          <span>
            <span className="block font-semibold">Hoy estoy agotado</span>
            <span className="block text-[13px] text-muted">Deja solo lo esencial</span>
          </span>
        </span>
        <span className="text-sm text-muted">Activar</span>
      </button>

      {props.top}

      <Card>
        <CardTitle>Mi día</CardTitle>
        <div className="divide-y divide-border">
          <Row label="Trabajo" sub={props.work} />
          <Row
            label="Entrenamiento"
            sub={
              props.workout.done
                ? "Registrado"
                : props.workout.focus
                  ? props.workout.focus
                  : props.workout.light
                    ? "Hoy no toca · día ligero"
                    : "Descanso"
            }
            done={props.workout.done}
            href="/entreno"
          />
          <Row
            label="Tarea principal"
            sub={props.mainTask ?? "Escríbela arriba en prioridad 1"}
            done={props.mainTask ? props.mainTaskDone : undefined}
          />
          {props.growth.map((h) =>
            h.activeToday ? (
              <Row key={h.id} label={h.name} done={habits.done.has(h.id)}>
                <Toggle on={habits.done.has(h.id)} onClick={() => habits.toggle(h.id)} label={h.name} />
              </Row>
            ) : (
              <Row key={h.id} label={h.name} sub="Hoy no toca" done={habits.done.has(h.id)}>
                {habits.done.has(h.id) ? (
                  <Toggle on onClick={() => habits.toggle(h.id)} label={h.name} />
                ) : (
                  <button
                    type="button"
                    className={buttonClass("ghost", "sm")}
                    onClick={() => habits.toggle(h.id)}
                  >
                    Lo hice igual
                  </button>
                )}
              </Row>
            ),
          )}
          <Row
            label="Lectura"
            sub={`${state.pages_read}/${goals.pages} páginas`}
            done={state.pages_read >= goals.pages}
          >
            <Stepper
              label="páginas"
              value={state.pages_read}
              step={5}
              max={1000}
              onChange={(v) => update({ pages_read: v })}
            />
          </Row>
          <Row
            label="Meditación"
            sub={`${state.meditation_min}/${goals.meditation} min`}
            done={state.meditation_min >= goals.meditation}
          >
            <Stepper
              label="minutos"
              value={state.meditation_min}
              step={5}
              max={600}
              onChange={(v) => update({ meditation_min: v })}
            />
          </Row>
          <Row
            label="Higiene"
            sub={`${props.hygiene.done}/${props.hygiene.total} pasos`}
            done={props.hygiene.total > 0 && props.hygiene.done >= Math.min(7, props.hygiene.total)}
            href="/habitos"
          />
          <div className="py-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[15px] font-medium">Alimentación</p>
              <p className="text-[13px] text-muted">¿Cómo comiste hoy?</p>
            </div>
            <FoodPicker value={state.food_quality} onChange={(v) => update({ food_quality: v })} />
          </div>
          <Row label="Agua" sub={`${state.water_glasses}/${goals.water} vasos`} done={state.water_glasses >= goals.water}>
            <Stepper
              label="vasos"
              value={state.water_glasses}
              max={30}
              onChange={(v) => update({ water_glasses: v })}
            />
          </Row>
          <Row
            label="Sueño"
            sub={state.sleep_hours == null ? "¿Cuánto dormiste anoche?" : `Meta ${goals.sleep} h`}
            done={state.sleep_hours != null && state.sleep_hours >= goals.sleep}
          >
            <Stepper
              label="horas de sueño"
              value={state.sleep_hours ?? 0}
              step={0.5}
              max={16}
              format={(v) => (state.sleep_hours == null ? "—" : `${v} h`)}
              onChange={(v) => update({ sleep_hours: state.sleep_hours == null && v === 0.5 ? goals.sleep : v })}
            />
          </Row>
        </div>
        <ErrorLine error={error ?? habits.error} />
      </Card>

      {props.bottom}
    </div>
  );
}

function ExhaustedView({
  state,
  update,
  error,
  goals,
}: {
  state: DayState;
  update: (p: Partial<DayState>) => void;
  error: string | null;
  goals: TodayProps["goals"];
}) {
  const waterGoal = Math.max(1, Math.ceil(goals.water / 2));
  const items: { key: string; label: string; on: boolean; toggle: () => void; extra?: ReactNode }[] = [
    { key: "h", label: "Higiene básica", on: state.basic_hygiene, toggle: () => update({ basic_hygiene: !state.basic_hygiene }) },
    { key: "c", label: "Comer decentemente", on: state.ate_decently, toggle: () => update({ ate_decently: !state.ate_decently }) },
    {
      key: "a",
      label: `Agua · ${state.water_glasses}/${waterGoal} vasos`,
      on: state.water_glasses >= waterGoal,
      toggle: () => update({ water_glasses: state.water_glasses >= waterGoal ? 0 : waterGoal }),
      extra: (
        <Stepper label="vasos" value={state.water_glasses} max={30} onChange={(v) => update({ water_glasses: v })} />
      ),
    },
    {
      key: "m",
      label: "5 minutos de meditación",
      on: state.meditation_min >= 5,
      toggle: () => update({ meditation_min: state.meditation_min >= 5 ? 0 : 5 }),
    },
    {
      key: "p",
      label: "5 páginas",
      on: state.pages_read >= 5,
      toggle: () => update({ pages_read: state.pages_read >= 5 ? 0 : 5 }),
    },
    { key: "d", label: "Dormir", on: state.going_to_sleep, toggle: () => update({ going_to_sleep: !state.going_to_sleep }) },
  ];
  const done = items.filter((i) => i.on).length;
  return (
    <div className="space-y-4">
      <Card className="border-transparent bg-surface-2">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-muted">
            <Moon size={18} />
          </span>
          <div>
            <p className="font-semibold">Modo agotado</p>
            <p className="mt-0.5 text-sm text-muted">
              Hoy solo cuenta lo esencial. Descansar es parte del plan.
            </p>
          </div>
        </div>
      </Card>
      <Card>
        <CardTitle action={<span className="tabular text-sm text-muted">{done}/6</span>}>Solo esto</CardTitle>
        <ProgressBar value={done} max={6} tone="success" className="mb-2" />
        <ul className="divide-y divide-border">
          {items.map((it) => (
            <li key={it.key} className="flex min-h-14 items-center justify-between gap-3 py-2">
              <button
                type="button"
                onClick={it.toggle}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                role="checkbox"
                aria-checked={it.on}
              >
                <span
                  className={clsx(
                    "grid size-6 shrink-0 place-items-center rounded-md border transition",
                    it.on ? "border-success bg-success text-bg" : "border-border",
                  )}
                >
                  {it.on ? "✓" : ""}
                </span>
                <span className={clsx("text-[15px]", it.on && "text-muted")}>{it.label}</span>
              </button>
              {it.extra}
            </li>
          ))}
        </ul>
        <ErrorLine error={error} />
      </Card>
      <button
        type="button"
        onClick={() => update({ exhausted: false })}
        className={clsx(buttonClass("ghost", "sm"), "w-full")}
      >
        Volver al día normal
      </button>
    </div>
  );
}
