"use client";

import clsx from "clsx";
import { useState, useTransition } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input, Select, Textarea, buttonClass } from "@/components/ui";
import { ErrorLine } from "../_components/day";
import { EVIDENCE_SUBTYPES } from "@/lib/skills";
import type { SkillGroup } from "@/lib/skill-queries";
import type { LabProject } from "@/lib/types";
import {
  addEvidence,
  completeProject,
  logStudySession,
  setSkillActive,
  startLabProject,
  updateLabProject,
} from "../skills/actions";

export function SessionForm({ groups, today }: { groups: SkillGroup[]; today: string }) {
  const [subtype, setSubtype] = useState("session");
  const kind = EVIDENCE_SUBTYPES.find((x) => x.value === subtype)?.kind;
  return (
    <ActionForm action={logStudySession} resetOnSuccess className="space-y-3">
      <Field label="Skill">
        <Select name="skill_id" required defaultValue="">
          <option value="" disabled>
            Elige una skill…
          </option>
          {groups.map((g) => (
            <optgroup key={g.id} label={g.name}>
              {g.skills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo">
          <Select name="subtype" value={subtype} onChange={(e) => setSubtype(e.target.value)}>
            {EVIDENCE_SUBTYPES.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Minutos">
          <Input name="minutes" type="number" inputMode="numeric" min={1} max={1440} required={kind === "practice"} />
        </Field>
      </div>
      <Field label={kind === "learn" ? "¿Qué estudiaste?" : kind === "practice" ? "¿Qué practicaste o resolviste?" : "¿Qué construiste o diagnosticaste?"}>
        <Input name="title" maxLength={200} required={kind === "learn"} />
      </Field>
      {kind === "apply" ? (
        <Field label="Link de la evidencia" hint="Programa, esquema, foto o video (Drive, GitHub, YouTube…).">
          <Input name="url" type="url" required placeholder="https://" />
        </Field>
      ) : null}
      <Field label="Notas (errores, lecciones)">
        <Textarea name="notes" className="min-h-16" />
      </Field>
      <input type="hidden" name="occurred_on" value={today} />
      <SubmitButton className="w-full">Registrar sesión</SubmitButton>
    </ActionForm>
  );
}

export function LabActions({ id, status }: { id: string; status: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (status === "terminado") return null;
  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={pending}
        className={buttonClass(status === "activo" ? "primary" : "secondary", "sm")}
        onClick={() =>
          start(async () => {
            const r = status === "activo" ? await completeProject(id) : await startLabProject(id);
            if (!r.ok) setError(r.error);
          })
        }
      >
        {status === "activo" ? "Marcar terminado" : "Empezar proyecto"}
      </button>
      <ErrorLine error={error} />
    </div>
  );
}

export function LabProjectEditor({ p }: { p: LabProject }) {
  const area = (name: keyof LabProject, label: string, hint?: string, tall = false) => (
    <Field label={label} hint={hint}>
      <Textarea name={name} defaultValue={(p[name] as string | null) ?? ""} className={clsx(tall && "min-h-32", name === "code" && "font-mono text-sm")} />
    </Field>
  );
  return (
    <ActionForm action={updateLabProject.bind(null, p.id)} className="space-y-3">
      <Field label="Objetivo">
        <Input name="objective" defaultValue={p.objective ?? ""} maxLength={2000} />
      </Field>
      {area("problem", "Problema", "¿Qué necesidad o falla resuelve?")}
      {area("components", "Componentes", "Uno por línea.")}
      {area("tools", "Herramientas / software")}
      {area("theory", "Teoría", "Lo que necesitas entender (y cuándo usar cada fórmula).")}
      {area("diagram", "Diagrama", "Descríbelo o pega un link al esquema.")}
      {area("steps", "Pasos", undefined, true)}
      {area("safety", "Seguridad", "Riesgos, LOTO, EPP, protecciones.")}
      {area("code", "Código", undefined, true)}
      {area("results", "Resultados")}
      {area("lessons", "Lecciones aprendidas", "Errores y qué harías distinto.")}
      <Field label="Portafolio">
        <Select name="visibility" defaultValue={p.visibility}>
          <option value="private">Privado</option>
          <option value="public">Portafolio público</option>
        </Select>
      </Field>
      <div className="sticky bottom-20 z-10 md:bottom-4">
        <SubmitButton className="w-full shadow-lg">Guardar proyecto</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ProjectEvidenceForm({ projectId, skills, today }: { projectId: string; skills: { id: string; name: string }[]; today: string }) {
  const [skillId, setSkillId] = useState(skills[0]?.id ?? "");
  if (!skills.length) return <p className="text-sm text-muted">Este proyecto no tiene skills asociadas.</p>;
  return (
    <ActionForm key={skillId} action={addEvidence.bind(null, skillId)} resetOnSuccess className="space-y-3">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="occurred_on" value={today} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Skill demostrada">
          <Select value={skillId} onChange={(e) => setSkillId(e.target.value)}>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Evidencia">
          <Select name="subtype" defaultValue="project">
            {EVIDENCE_SUBTYPES.filter((x) => x.kind === "apply").map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="¿Qué construiste / resolviste?">
        <Input name="title" maxLength={200} />
      </Field>
      <Field label="Link (opcional)" hint="Programa, esquema, foto o video.">
        <Input name="url" type="url" placeholder="https://" />
      </Field>
      <Field label="Notas">
        <Textarea name="notes" className="min-h-16" />
      </Field>
      <SubmitButton variant="secondary" className="w-full">
        Registrar evidencia del proyecto
      </SubmitButton>
    </ActionForm>
  );
}

export function SoftwareToggle({ id, name, active }: { id: string; name: string; active: boolean }) {
  const [on, setOn] = useState(active);
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center justify-between gap-3 py-2.5">
      <span className={clsx("text-[15px]", !on && "text-muted")}>{name}</span>
      <input
        type="checkbox"
        role="switch"
        aria-label={`Usar ${name}`}
        checked={on}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.checked;
          setOn(v);
          start(async () => {
            const r = await setSkillActive(id, v);
            if (!r.ok) setOn(!v);
          });
        }}
        className="size-5 accent-current"
      />
    </label>
  );
}
