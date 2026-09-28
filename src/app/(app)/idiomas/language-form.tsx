"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input, Select } from "@/components/ui";
import type { Language } from "@/lib/types";
import { updateLanguage } from "./actions";
import { LANGUAGE_STATUS_LABEL as STATUS_LABEL } from "@/lib/labels";

export function LanguageForm({ lang }: { lang: Language }) {
  const [cefr, setCefr] = useState(lang.cefr ?? "");
  return (
    <ActionForm action={updateLanguage.bind(null, lang.id)} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Estado">
          <Select name="status" defaultValue={lang.status}>
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nivel (A1–C2)" hint="No sube por horas.">
          <Select name="cefr" value={cefr} onChange={(e) => setCefr(e.target.value)}>
            <option value="">Sin evaluar</option>
            {["A1", "A2", "B1", "B2", "C1", "C2"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </div>
      {cefr ? (
        <Field label="Evidencia del nivel" hint="Examen, evaluación, certificado o prueba de nivel.">
          <Input name="cefr_evidence" defaultValue={lang.cefr_evidence ?? ""} required maxLength={500} />
        </Field>
      ) : null}
      <SubmitButton size="sm" variant="secondary">
        Guardar
      </SubmitButton>
    </ActionForm>
  );
}
