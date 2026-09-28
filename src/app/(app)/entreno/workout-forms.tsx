"use client";

import { useRef } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input, Textarea } from "@/components/ui";
import { addSet, createWorkout, updateWorkoutNotes } from "./actions";

export function NewWorkoutForm({
  today,
  defaultFocus,
  focuses,
}: {
  today: string;
  defaultFocus: string;
  focuses: string[];
}) {
  return (
    <ActionForm action={createWorkout} className="space-y-3">
      <Field label="¿Qué entrenas?">
        <Input name="focus" list="focus-list" defaultValue={defaultFocus} required maxLength={80} placeholder="Ej. Pierna" />
        <datalist id="focus-list">
          {focuses.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha">
          <Input name="log_date" type="date" defaultValue={today} max={today} />
        </Field>
        <Field label="Duración (min)">
          <Input name="duration_min" type="number" inputMode="numeric" min={1} max={600} placeholder="Opcional" />
        </Field>
      </div>
      <SubmitButton className="w-full" pendingText="Creando…">
        Registrar entrenamiento
      </SubmitButton>
    </ActionForm>
  );
}

export function AddSetForm({
  workoutId,
  suggestions,
  lastExercise,
}: {
  workoutId: string;
  suggestions: string[];
  lastExercise: string;
}) {
  const repsRef = useRef<HTMLInputElement>(null);
  return (
    <ActionForm
      action={addSet.bind(null, workoutId)}
      className="space-y-3"
      onSuccess={() => repsRef.current?.focus()}
    >
      <Field label="Ejercicio">
        <Input name="exercise" list="ex-list" defaultValue={lastExercise} required maxLength={80} placeholder="Ej. Press banca" />
        <datalist id="ex-list">
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Repeticiones">
          <Input ref={repsRef} name="reps" type="number" inputMode="numeric" min={0} max={1000} />
        </Field>
        <Field label="Peso (kg)">
          <Input name="weight_kg" type="number" inputMode="decimal" step="0.5" min={0} max={1000} />
        </Field>
      </div>
      <Field label="Nota (opcional)">
        <Input name="notes" maxLength={500} placeholder="Ej. última serie al fallo" />
      </Field>
      <SubmitButton className="w-full">Agregar serie</SubmitButton>
    </ActionForm>
  );
}

export function WorkoutNotesForm({
  workoutId,
  notes,
  duration,
}: {
  workoutId: string;
  notes: string | null;
  duration: number | null;
}) {
  return (
    <ActionForm action={updateWorkoutNotes.bind(null, workoutId)} className="space-y-3">
      <Field label="Duración (min)">
        <Input name="duration_min" type="number" inputMode="numeric" min={1} max={600} defaultValue={duration ?? ""} />
      </Field>
      <Field label="Notas">
        <Textarea name="notes" defaultValue={notes ?? ""} maxLength={2000} placeholder="¿Cómo te sentiste? ¿Algo que ajustar?" />
      </Field>
      <SubmitButton variant="secondary">Guardar notas</SubmitButton>
    </ActionForm>
  );
}
