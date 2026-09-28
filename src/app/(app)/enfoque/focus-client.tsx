"use client";

import { useTransition } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input, Select, buttonClass } from "@/components/ui";
import type { FocusItem } from "@/lib/types";
import { FOCUS_LEVEL_LABEL as LEVEL_LABEL } from "@/lib/labels";
import { addFocusItem, createSeason, deleteFocusItem, setFocusLevel } from "./actions";


export function FocusItemRow({ item }: { item: FocusItem }) {
  const [pending, start] = useTransition();
  return (
    <li className="flex items-center justify-between gap-2 py-2">
      <span className="text-[15px]">{item.label}</span>
      <span className="flex items-center gap-1">
        <select
          aria-label={`Nivel de ${item.label}`}
          defaultValue={item.level}
          disabled={pending}
          onChange={(e) => start(async () => void (await setFocusLevel(item.id, e.target.value)))}
          className="h-9 rounded-lg border border-border bg-surface-2 px-2 text-sm"
        >
          {Object.entries(LEVEL_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <button type="button" disabled={pending} onClick={() => start(async () => void (await deleteFocusItem(item.id)))} className={buttonClass("ghost", "sm")} aria-label={`Quitar ${item.label}`}>
          ✕
        </button>
      </span>
    </li>
  );
}

export function AddItemForm({ seasonId }: { seasonId: string }) {
  return (
    <ActionForm action={addFocusItem.bind(null, seasonId)} resetOnSuccess className="flex gap-2">
      <Input name="label" required maxLength={60} placeholder="Ej. Tarot" className="h-10" aria-label="Área" />
      <Select name="level" defaultValue="secondary" className="h-10 w-36" aria-label="Nivel">
        {Object.entries(LEVEL_LABEL).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
      <SubmitButton size="sm" variant="secondary" className="h-10">
        Agregar
      </SubmitButton>
    </ActionForm>
  );
}

export function NewSeasonForm({ copyFrom }: { copyFrom: string | null }) {
  return (
    <ActionForm action={createSeason} resetOnSuccess className="space-y-3">
      <Field label="Nombre">
        <Input name="name" required maxLength={60} placeholder="Ej. ENE–MAR 2027" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Inicio">
          <Input name="starts_on" type="date" required />
        </Field>
        <Field label="Fin">
          <Input name="ends_on" type="date" required />
        </Field>
      </div>
      {copyFrom ? <input type="hidden" name="copy_from" value={copyFrom} /> : null}
      <SubmitButton>Crear temporada</SubmitButton>
    </ActionForm>
  );
}
