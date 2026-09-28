"use client";

import { useState, useTransition } from "react";
import { ActionForm, Segmented, SubmitButton } from "@/components/forms";
import { Field, Input, Select } from "@/components/ui";
import { DAY_TYPES } from "@/lib/schedule";
import type { Profile, WeekTemplateRow } from "@/lib/types";
import { saveProfile, saveTemplate, setTheme } from "./actions";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export function ThemePicker({ current }: { current: "light" | "dark" | "system" }) {
  const [value, setValue] = useState(current);
  const [, start] = useTransition();
  return (
    <Segmented
      value={value}
      onChange={(v) => {
        setValue(v);
        const root = document.documentElement;
        root.classList.remove("light", "dark");
        if (v !== "system") root.classList.add(v);
        start(() => setTheme(v));
      }}
      options={[
        { value: "system", label: "Sistema" },
        { value: "light", label: "Claro" },
        { value: "dark", label: "Oscuro" },
      ]}
    />
  );
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const numField = (name: keyof Profile, label: string, min: number, max: number, step = 1) => (
    <Field label={label}>
      <Input name={name} type="number" inputMode="decimal" min={min} max={max} step={step} defaultValue={String(profile[name] ?? "")} />
    </Field>
  );
  return (
    <ActionForm action={saveProfile} className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombre">
          <Input name="display_name" defaultValue={profile.display_name} maxLength={40} />
        </Field>
        <Field label="Zona horaria">
          <Input name="timezone" defaultValue={profile.timezone} />
        </Field>
      </div>
      <Field label="Mi día empieza a las" hint="Lo que registres antes de esta hora cuenta para el día anterior (útil al salir a la 1:00).">
        <Select name="day_start_hour" defaultValue={String(profile.day_start_hour)}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((h) => (
            <option key={h} value={h}>
              {String(h).padStart(2, "0")}:00
            </option>
          ))}
        </Select>
      </Field>
      <div>
        <p className="mb-2 text-sm font-semibold">Metas diarias</p>
        <div className="grid grid-cols-2 gap-3">
          {numField("sleep_goal_hours", "Sueño (horas)", 4, 12, 0.5)}
          {numField("water_goal_glasses", "Agua (vasos)", 1, 20)}
          {numField("pages_goal_daily", "Lectura (páginas)", 1, 200)}
          {numField("meditation_goal_min", "Meditación (min)", 1, 120)}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold">Metas semanales</p>
        <div className="grid grid-cols-2 gap-3">
          {numField("sleep_nights_target", "Noches durmiendo bien", 0, 7)}
          {numField("workouts_target", "Entrenamientos", 0, 7)}
          {numField("pages_week_target", "Páginas", 0, 2000)}
          {numField("meditation_days_target", "Días de meditación", 0, 7)}
          {numField("hygiene_days_target", "Días de higiene", 0, 7)}
          {numField("content_week_target", "Videos publicados", 0, 50)}
        </div>
        <p className="mt-2 text-xs text-muted">Inglés, filmmaking, carrera y finanzas se ajustan en Hábitos. 0 = no se mide.</p>
      </div>
      <SubmitButton>Guardar ajustes</SubmitButton>
    </ActionForm>
  );
}

export function TemplateForm({ rows }: { rows: WeekTemplateRow[] }) {
  return (
    <ActionForm action={saveTemplate} className="space-y-3">
      {DAYS.map((name, d) => {
        const r = rows.find((x) => x.weekday === d);
        return <DayRow key={d} d={d} name={name} row={r} />;
      })}
      <SubmitButton>Guardar horario</SubmitButton>
    </ActionForm>
  );
}

function DayRow({ d, name, row }: { d: number; name: string; row?: WeekTemplateRow }) {
  const [off, setOff] = useState(!row?.work_start);
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-medium">{name}</p>
        <Select name={`type_${d}`} defaultValue={row?.day_type ?? "crecimiento"} className="h-9 w-40 min-w-0 bg-surface">
          {Object.entries(DAY_TYPES).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
        <label className="flex items-center gap-1.5 text-sm text-muted">
          <input type="checkbox" name={`off_${d}`} checked={off} onChange={(e) => setOff(e.target.checked)} className="size-4 accent-current" />
          Libre
        </label>
        {off ? (
          <p className="col-span-2 text-sm text-faint">Sin turno</p>
        ) : (
          <>
            <Input name={`start_${d}`} type="time" defaultValue={row?.work_start?.slice(0, 5) ?? "17:00"} className="h-9 min-w-0 bg-surface px-2" aria-label={`Entrada ${name}`} />
            <Input name={`end_${d}`} type="time" defaultValue={row?.work_end?.slice(0, 5) ?? "01:00"} className="h-9 min-w-0 bg-surface px-2" aria-label={`Salida ${name}`} />
          </>
        )}
      </div>
      <Input name={`focus_${d}`} defaultValue={row?.workout_focus ?? ""} placeholder="Entrenamiento (vacío = descanso)" className="mt-2 h-9 bg-surface" aria-label={`Entrenamiento ${name}`} />
    </div>
  );
}
