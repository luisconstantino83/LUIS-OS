"use client";

import clsx from "clsx";
import { useState, useTransition } from "react";
import { Check, Lock } from "lucide-react";
import { ActionForm, Segmented, SubmitButton } from "@/components/forms";
import { Field, Input, Select, Textarea, buttonClass } from "@/components/ui";
import { SkillPicker, type PickerGroup } from "@/components/skill-picker";
import { ErrorLine } from "../_components/day";
import {
  EVIDENCE_KINDS,
  EVIDENCE_SUBTYPES,
  LEVELS,
  RESOURCE_KINDS,
  requirementsFor,
  type EvidenceCounts,
  type EvidenceKind,
} from "@/lib/skills";
import type { SkillResource } from "@/lib/types";
import {
  addEvidence,
  addResource,
  completeProject,
  createProject,
  deleteResource,
  saveSkillWeek,
  setResourceActive,
  setSkillLevel,
  startProject,
  updateSkillNotes,
} from "./actions";

type Opt = { id: string; label: string };

// ---------------------------------------------------------------------------
// Nivel con requisitos de evidencia
// ---------------------------------------------------------------------------
export function LevelControl({
  skillId,
  level,
  counts,
  allowed,
}: {
  skillId: string;
  level: number;
  counts: EvidenceCounts;
  allowed: number;
}) {
  const [current, setCurrent] = useState(level);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const next = Math.min(5, current + 1);
  const reqs = current < 5 ? requirementsFor(next, counts) : [];

  const choose = (l: number) =>
    start(async () => {
      const prev = current;
      setCurrent(l);
      setError(null);
      const r = await setSkillLevel(skillId, l);
      if (!r.ok) {
        setCurrent(prev);
        setError(r.error);
      }
    });

  return (
    <div>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {LEVELS.map((l) => {
          const locked = l.value > allowed && l.value > current;
          return (
            <button
              key={l.value}
              type="button"
              disabled={pending || locked}
              onClick={() => choose(l.value)}
              aria-pressed={l.value === current}
              className={clsx(
                "flex h-10 items-center justify-center gap-1 rounded-lg px-1 text-[13px] font-medium transition",
                l.value === current
                  ? "bg-fg text-bg"
                  : l.value < current
                    ? "bg-accent-soft text-accent"
                    : locked
                      ? "bg-surface-2 text-faint"
                      : "bg-surface-2 text-muted hover:text-fg",
              )}
            >
              {locked ? <Lock size={11} /> : null}
              {l.label}
            </button>
          );
        })}
      </div>
      {current < 5 ? (
        <div className="mt-3 rounded-xl bg-surface-2 p-3">
          <p className="text-[13px] font-medium">
            Para llegar a <span className="text-accent">{LEVELS[next].label}</span>:
          </p>
          <ul className="mt-1.5 space-y-1 text-sm">
            {reqs.map((r) => {
              const ok = r.have >= r.need;
              return (
                <li key={r.label} className={clsx("flex items-center gap-2", ok ? "text-muted" : "")}>
                  <span
                    className={clsx(
                      "grid size-4 place-items-center rounded-full border",
                      ok ? "border-success bg-success text-bg" : "border-border",
                    )}
                  >
                    {ok ? <Check size={10} strokeWidth={3} /> : null}
                  </span>
                  <span className="tabular">
                    {Math.min(r.have, r.need)}/{r.need} {r.label}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-muted">Ver un tutorial solo cuenta como aprender. El nivel sube con práctica y trabajo real.</p>
        </div>
      ) : null}
      <ErrorLine error={error} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Registrar evidencia
// ---------------------------------------------------------------------------
export function EvidenceForm({
  skillId,
  today,
  contents,
  productions,
  projects,
  defaultKind = "practice",
  lockKind = false,
  defaultMinutes,
  compact = false,
  subtype,
  showSubtypes = false,
}: {
  subtype?: string;
  showSubtypes?: boolean;
  skillId: string;
  today: string;
  contents: Opt[];
  productions: Opt[];
  projects: Opt[];
  defaultKind?: EvidenceKind;
  lockKind?: boolean;
  defaultMinutes?: number | null;
  compact?: boolean;
}) {
  const [kind, setKind] = useState<EvidenceKind>(defaultKind);
  const meta = EVIDENCE_KINDS.find((k) => k.value === kind)!;
  const subtypes = EVIDENCE_SUBTYPES.filter((x) => x.kind === kind);
  return (
    <ActionForm action={addEvidence.bind(null, skillId)} resetOnSuccess className="space-y-3">
      {subtype ? <input type="hidden" name="subtype" value={subtype} /> : null}
      {lockKind ? (
        <input type="hidden" name="kind" value={kind} />
      ) : (
        <Segmented name="kind" value={kind} onChange={setKind} options={EVIDENCE_KINDS.map((k) => ({ value: k.value, label: k.label }))} />
      )}
      {!compact ? <p className="text-xs text-muted">{meta.hint}</p> : null}
      {showSubtypes && !subtype && subtypes.length ? (
        <Field label="Tipo de evidencia (opcional)">
          <Select name="subtype" defaultValue="" key={kind}>
            <option value="">—</option>
            {subtypes.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      {kind !== "reflect" ? (
        <Field label={kind === "learn" ? "¿Qué aprendiste? (tutorial, curso, tema)" : kind === "practice" ? "¿Qué practicaste?" : "¿Dónde lo aplicaste?"}>
          <Input name="title" maxLength={200} required={kind === "learn"} />
        </Field>
      ) : null}
      {kind === "learn" || kind === "practice" ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Minutos">
            <Input
              name="minutes"
              type="number"
              inputMode="numeric"
              min={1}
              max={1440}
              required={kind === "practice"}
              defaultValue={defaultMinutes ?? undefined}
              key={kind}
            />
          </Field>
          <Field label="Fecha">
            <Input name="occurred_on" type="date" defaultValue={today} max={today} />
          </Field>
        </div>
      ) : null}
      {kind === "apply" ? (
        <div className="space-y-3">
          <p className="text-xs text-muted">Necesita al menos una prueba: pieza, producción, proyecto o link.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pieza">
              <Select name="content_id" defaultValue="">
                <option value="">—</option>
                {contents.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Producción">
              <Select name="production_id" defaultValue="">
                <option value="">—</option>
                {productions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Proyecto">
              <Select name="project_id" defaultValue="">
                <option value="">—</option>
                {projects.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Fecha">
              <Input name="occurred_on" type="date" defaultValue={today} max={today} />
            </Field>
          </div>
          <Field label="Link del resultado">
            <Input name="url" type="url" placeholder="https://" />
          </Field>
        </div>
      ) : null}
      <Field label={kind === "reflect" ? "¿Qué funcionó? ¿Qué mejorarías?" : "Notas (opcional)"}>
        <Textarea name="notes" required={kind === "reflect"} minLength={kind === "reflect" ? 10 : undefined} className="min-h-16" />
      </Field>
      {kind === "reflect" ? <input type="hidden" name="occurred_on" value={today} /> : null}
      <SubmitButton className="w-full">Registrar {meta.label.toLowerCase()}</SubmitButton>
    </ActionForm>
  );
}

export function SkillNotesForm({ skillId, nextGoal, notes }: { skillId: string; nextGoal: string | null; notes: string | null }) {
  return (
    <ActionForm action={updateSkillNotes.bind(null, skillId)} className="space-y-3">
      <Field label="Objetivo siguiente">
        <Input name="next_goal" defaultValue={nextGoal ?? ""} maxLength={300} placeholder="Ej. Hacer un paneo suave con gimbal a 24 fps" />
      </Field>
      <Field label="Notas">
        <Textarea name="notes" defaultValue={notes ?? ""} />
      </Field>
      <SubmitButton variant="secondary">Guardar</SubmitButton>
    </ActionForm>
  );
}

// ---------------------------------------------------------------------------
// Recursos (máx. 3 activos)
// ---------------------------------------------------------------------------
export function Resources({ skillId, items }: { skillId: string; items: SkillResource[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const active = items.filter((r) => r.active);
  const archived = items.filter((r) => !r.active);
  const label = (k: string) => RESOURCE_KINDS.find((x) => x.value === k)?.label ?? k;
  return (
    <div>
      <ul className="divide-y divide-border">
        {active.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              {r.url ? (
                <a href={r.url} target="_blank" rel="noreferrer" className="block truncate text-[15px] text-accent">
                  {r.title}
                </a>
              ) : (
                <p className="truncate text-[15px]">{r.title}</p>
              )}
              <p className="text-xs text-muted">{label(r.kind)}</p>
            </div>
            <button
              type="button"
              disabled={pending}
              className={buttonClass("ghost", "sm")}
              onClick={() => start(async () => void (await setResourceActive(r.id, false)))}
            >
              Archivar
            </button>
          </li>
        ))}
      </ul>
      {active.length < 3 ? (
        <ActionForm action={addResource.bind(null, skillId)} resetOnSuccess className="mt-3 space-y-2">
          <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
            <Select name="kind" defaultValue="youtube" className="h-10">
              {RESOURCE_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </Select>
            <Input name="title" required maxLength={140} placeholder="Título" className="h-10" />
          </div>
          <div className="flex gap-2">
            <Input name="url" type="url" placeholder="https:// (opcional)" className="h-10" />
            <SubmitButton size="sm" variant="secondary" className="h-10">
              Agregar
            </SubmitButton>
          </div>
        </ActionForm>
      ) : (
        <p className="mt-2 text-xs text-muted">3 de 3 recursos activos. Termina o archiva uno antes de sumar otro.</p>
      )}
      {archived.length ? (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted">Archivados ({archived.length})</summary>
          <ul className="mt-1 space-y-1">
            {archived.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <span className="truncate text-muted">{r.title}</span>
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className={buttonClass("ghost", "sm")}
                    onClick={() =>
                      start(async () => {
                        const res = await setResourceActive(r.id, true);
                        if (!res.ok) setError(res.error);
                      })
                    }
                  >
                    Reactivar
                  </button>
                  <button type="button" className={buttonClass("danger", "sm")} onClick={() => start(async () => void (await deleteResource(r.id)))}>
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <ErrorLine error={error} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skill of the Week
// ---------------------------------------------------------------------------
export function SkillWeekForm({
  groups,
  week,
  current,
  track = "general",
}: {
  groups: PickerGroup[];
  track?: "general" | "engineering";
  week: "current" | "next";
  current: { skill_id: string; objective: string | null; micro_lesson: string | null; exercise: string | null; apply_to: string | null } | null;
}) {
  return (
    <ActionForm action={saveSkillWeek} className="space-y-3">
      <input type="hidden" name="week" value={week} />
      <input type="hidden" name="track" value={track} />
      <Field label="Skill">
        <Select name="skill_id" defaultValue={current?.skill_id ?? ""} required>
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
      <Field label="Objetivo" hint="Algo concreto y observable.">
        <Input name="objective" defaultValue={current?.objective ?? ""} maxLength={300} placeholder="Ej. Lograr 3 movimientos de cámara estables" />
      </Field>
      <Field label="Microlección (15 min)" hint="Tus notas de lo que vas a aprender. Aún no hay contenido educativo precargado.">
        <Textarea name="micro_lesson" defaultValue={current?.micro_lesson ?? ""} className="min-h-16" />
      </Field>
      <Field label="Ejercicio (30 min)">
        <Textarea name="exercise" defaultValue={current?.exercise ?? ""} className="min-h-16" placeholder="Ej. Grabar 10 tomas: push-in, pan, tilt, tracking…" />
      </Field>
      <Field label="Dónde aplicarlo">
        <Input name="apply_to" defaultValue={current?.apply_to ?? ""} maxLength={300} placeholder="Ej. Reel de Monse del sábado" />
      </Field>
      <SubmitButton>Guardar</SubmitButton>
    </ActionForm>
  );
}

// ---------------------------------------------------------------------------
// Proyectos
// ---------------------------------------------------------------------------
export function ProjectActions({
  projectId,
  status,
  productionId,
}: {
  projectId: string;
  status: "sugerido" | "activo" | "terminado";
  productionId: string | null;
}) {
  const [owner, setOwner] = useState<"monse" | "luis">("monse");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (status === "terminado") return null;
  if (status === "activo")
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {productionId ? (
          <a href={`/monse/producciones/${productionId}`} className={buttonClass("secondary", "sm")}>
            Abrir producción
          </a>
        ) : null}
        <button
          type="button"
          disabled={pending}
          className={buttonClass("primary", "sm")}
          onClick={() =>
            start(async () => {
              const r = await completeProject(projectId);
              if (!r.ok) setError(r.error);
            })
          }
        >
          Marcar terminado
        </button>
        <ErrorLine error={error} />
      </div>
    );
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Segmented
        size="sm"
        className="w-44"
        value={owner}
        onChange={setOwner}
        options={[
          { value: "monse", label: "Con Monse" },
          { value: "luis", label: "Propio" },
        ]}
      />
      <button
        type="button"
        disabled={pending}
        className={buttonClass("primary", "sm")}
        onClick={() => start(async () => void (await startProject(projectId, owner)))}
      >
        {pending ? "Creando…" : "Empezar como producción"}
      </button>
    </div>
  );
}

export function NewProjectForm({ groups }: { groups: PickerGroup[] }) {
  const [k, setK] = useState(0);
  return (
    <ActionForm action={createProject} resetOnSuccess onSuccess={() => setK((x) => x + 1)} className="space-y-3">
      <Field label="Proyecto">
        <Input name="title" required maxLength={120} placeholder="Ej. Video de 60 s hablando en inglés" />
      </Field>
      <Field label="Objetivo">
        <Input name="objective" maxLength={1000} />
      </Field>
      <div>
        <p className="mb-1.5 text-[13px] font-medium text-muted">Skills que vas a practicar</p>
        <SkillPicker key={k} groups={groups} name="skills" />
      </div>
      <SubmitButton>Crear proyecto</SubmitButton>
    </ActionForm>
  );
}
