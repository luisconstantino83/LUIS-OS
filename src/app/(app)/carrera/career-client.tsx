"use client";

import clsx from "clsx";
import { useState, useTransition } from "react";
import { Check, ExternalLink, X } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input, Select, Textarea, buttonClass } from "@/components/ui";
import { FileUpload } from "@/components/file-upload";
import { ErrorLine } from "../_components/day";
import {
  DOC_STATUS,
  INTERVIEW_CATEGORIES,
  JOB_STATUSES,
  STAGES,
  STAGE_STATUS,
} from "@/lib/career";
import {
  addContact,
  addDocument,
  addTask,
  deleteTask,
  documentLink,
  logServiceHours,
  markPracticed,
  saveCareerSettings,
  saveJob,
  saveQuestion,
  setDocumentStatus,
  setStageStatus,
  setTaskDone,
} from "./actions";

const stageOptions = STAGES.map((s) => (
  <option key={s.key} value={s.key}>
    {s.label}
  </option>
));

export function StageStatusSelect({
  stage,
  status,
}: {
  stage: string;
  status: string;
}) {
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Estado de la etapa"
      value={value}
      disabled={pending}
      onChange={(e) => {
        const v = e.target.value;
        setValue(v);
        start(async () => {
          const r = await setStageStatus(stage, v);
          if (!r.ok) setValue(status);
        });
      }}
      className={clsx(
        "h-8 rounded-lg border px-2 text-xs font-medium",
        value === "completado"
          ? "border-transparent bg-success-soft text-success"
          : value === "en_curso"
            ? "border-transparent bg-accent-soft text-accent"
            : "border-border bg-surface-2 text-muted",
      )}
    >
      {STAGE_STATUS.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Servicio social
// ---------------------------------------------------------------------------
export function ServiceForm({ today }: { today: string }) {
  return (
    <ActionForm action={logServiceHours} resetOnSuccess className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Horas">
          <Input
            name="hours"
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0.5"
            max="24"
            required
          />
        </Field>
        <Field label="Fecha">
          <Input name="log_date" type="date" defaultValue={today} max={today} />
        </Field>
      </div>
      <Field label="Actividad">
        <Input name="activity" maxLength={500} placeholder="¿Qué hiciste?" />
      </Field>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          name="validated"
          className="size-4 accent-current"
        />
        Ya está firmada / reconocida por la institución
      </label>
      <SubmitButton className="w-full">Registrar horas</SubmitButton>
    </ActionForm>
  );
}

export function CareerSettingsForm({
  s,
}: {
  s: {
    required_hours: number;
    prior_hours: number;
    institution: string | null;
    program: string | null;
    supervisor: string | null;
    service_start: string | null;
    target_end: string | null;
  };
}) {
  return (
    <ActionForm action={saveCareerSettings} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Horas requeridas">
          <Input
            name="required_hours"
            type="number"
            inputMode="decimal"
            min={1}
            defaultValue={s.required_hours}
          />
        </Field>
        <Field label="Horas ya hechas" hint="Antes de usar la app.">
          <Input
            name="prior_hours"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.5"
            defaultValue={s.prior_hours}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Institución">
          <Input
            name="institution"
            defaultValue={s.institution ?? ""}
            maxLength={120}
          />
        </Field>
        <Field label="Programa">
          <Input
            name="program"
            defaultValue={s.program ?? ""}
            maxLength={120}
          />
        </Field>
      </div>
      <Field label="Responsable / supervisor">
        <Input
          name="supervisor"
          defaultValue={s.supervisor ?? ""}
          maxLength={120}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Inicio">
          <Input
            name="service_start"
            type="date"
            defaultValue={s.service_start ?? ""}
          />
        </Field>
        <Field label="Meta de término">
          <Input
            name="target_end"
            type="date"
            defaultValue={s.target_end ?? ""}
          />
        </Field>
      </div>
      <SubmitButton variant="secondary">Guardar</SubmitButton>
    </ActionForm>
  );
}

// ---------------------------------------------------------------------------
// Pendientes
// ---------------------------------------------------------------------------
export function TaskList({
  tasks,
}: {
  tasks: {
    id: string;
    title: string;
    done: boolean;
    due_date: string | null;
  }[];
}) {
  const [list, setList] = useState(tasks);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  return (
    <>
      <ul className="divide-y divide-border">
        {list.map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-2">
            <button
              type="button"
              role="checkbox"
              aria-checked={t.done}
              onClick={() => {
                setList((l) =>
                  l.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)),
                );
                start(async () => {
                  const r = await setTaskDone(t.id, !t.done);
                  if (!r.ok) setError(r.error);
                });
              }}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <span
                className={clsx(
                  "grid size-6 shrink-0 place-items-center rounded-md border transition",
                  t.done
                    ? "border-success bg-success text-bg"
                    : "border-border",
                )}
              >
                {t.done ? <Check size={14} strokeWidth={3} /> : null}
              </span>
              <span
                className={clsx(
                  "text-[15px]",
                  t.done && "text-muted line-through",
                )}
              >
                {t.title}
              </span>
            </button>
            {t.due_date ? (
              <span className="shrink-0 text-xs text-muted">
                {t.due_date.slice(5).split("-").reverse().join("/")}
              </span>
            ) : null}
            <button
              type="button"
              aria-label={`Quitar ${t.title}`}
              onClick={() => {
                setList((l) => l.filter((x) => x.id !== t.id));
                start(async () => void (await deleteTask(t.id)));
              }}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-faint hover:text-danger"
            >
              <X size={15} />
            </button>
          </li>
        ))}
      </ul>
      <ErrorLine error={error} />
    </>
  );
}

export function AddTaskForm({ stage }: { stage?: string }) {
  return (
    <ActionForm action={addTask} resetOnSuccess className="space-y-2">
      {stage ? (
        <input type="hidden" name="stage_key" value={stage} />
      ) : (
        <Select name="stage_key" defaultValue="servicio" className="h-10">
          {stageOptions}
        </Select>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Input
          name="title"
          required
          maxLength={160}
          placeholder="Nuevo pendiente"
          className="h-10"
          aria-label="Nuevo pendiente"
        />
        <Input
          name="due_date"
          type="date"
          className="h-10 w-36"
          aria-label="Fecha límite"
        />
      </div>
      <SubmitButton size="sm" variant="secondary">
        Agregar
      </SubmitButton>
    </ActionForm>
  );
}

// ---------------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------------
export function DocumentForm({ userId }: { userId: string }) {
  const [k, setK] = useState(0);
  return (
    <>
      {k > 0 ? (
        <p role="status" className="mb-3 text-sm text-success">
          Documento guardado.
        </p>
      ) : null}
      <ActionForm
        key={k}
        action={addDocument}
        onSuccess={() => setK((x) => x + 1)}
        className="space-y-3"
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Documento">
            <Input
              name="name"
              required
              maxLength={120}
              placeholder="Ej. Carta de aceptación"
            />
          </Field>
          <Field label="Etapa">
            <Select name="stage_key" defaultValue="servicio">
              {stageOptions}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Estado">
            <Select name="status" defaultValue="">
              <option value="">Automático</option>
              {DOC_STATUS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Fecha límite">
            <Input name="due_date" type="date" />
          </Field>
        </div>
        <FileUpload userId={userId} folder="career" />
        <Field label="Link (opcional)">
          <Input name="url" type="url" placeholder="https://" />
        </Field>
        <SubmitButton className="w-full">Guardar documento</SubmitButton>
      </ActionForm>
    </>
  );
}

export function DocumentActions({
  id,
  status,
  hasFile,
}: {
  id: string;
  status: string;
  hasFile: boolean;
}) {
  const [value, setValue] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-1">
      {hasFile ? (
        <button
          type="button"
          disabled={pending}
          className={buttonClass("ghost", "sm")}
          onClick={() =>
            start(async () => {
              const r = await documentLink(id);
              if (r.ok) window.open(r.url, "_blank", "noopener");
              else setError(r.error);
            })
          }
        >
          <ExternalLink size={14} /> Abrir
        </button>
      ) : null}
      <select
        aria-label="Estado del documento"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          start(async () => void (await setDocumentStatus(id, e.target.value)));
        }}
        className="h-8 rounded-lg border border-border bg-surface-2 px-2 text-xs"
      >
        {DOC_STATUS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contactos
// ---------------------------------------------------------------------------
export function ContactForm() {
  return (
    <ActionForm action={addContact} resetOnSuccess className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombre">
          <Input name="name" required maxLength={100} />
        </Field>
        <Field label="Rol">
          <Input
            name="role"
            maxLength={100}
            placeholder="Ej. Coordinador de servicio"
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Organización">
          <Input name="organization" maxLength={120} />
        </Field>
        <Field label="Etapa">
          <Select name="stage_key" defaultValue="servicio">
            {stageOptions}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email">
          <Input name="email" type="email" />
        </Field>
        <Field label="Teléfono">
          <Input name="phone" type="tel" maxLength={40} />
        </Field>
      </div>
      <Field label="Notas">
        <Textarea name="notes" className="min-h-16" />
      </Field>
      <SubmitButton>Guardar contacto</SubmitButton>
    </ActionForm>
  );
}

// ---------------------------------------------------------------------------
// Empleo
// ---------------------------------------------------------------------------
type Job = {
  id: string;
  company: string;
  position: string;
  location: string | null;
  url: string | null;
  status: string;
  applied_on: string | null;
  next_step: string | null;
  next_date: string | null;
  contact: string | null;
  salary_range: string | null;
  language: string | null;
  notes: string | null;
};

export function JobForm({ job, onDone }: { job?: Job; onDone?: () => void }) {
  return (
    <ActionForm
      action={saveJob.bind(null, job?.id ?? null)}
      resetOnSuccess={!job}
      onSuccess={onDone}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Empresa">
          <Input
            name="company"
            required
            maxLength={100}
            defaultValue={job?.company}
          />
        </Field>
        <Field label="Puesto">
          <Input
            name="position"
            required
            maxLength={120}
            defaultValue={job?.position}
            placeholder="Ej. Técnico de mantenimiento"
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Estado">
          <Select name="status" defaultValue={job?.status ?? "guardada"}>
            {JOB_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Idioma de la vacante">
          <Select name="language" defaultValue={job?.language ?? "es"}>
            <option value="es">Español</option>
            <option value="en">Inglés</option>
            <option value="de">Alemán</option>
            <option value="otro">Otro</option>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Siguiente paso">
          <Input
            name="next_step"
            maxLength={200}
            defaultValue={job?.next_step ?? ""}
            placeholder="Ej. Entrevista técnica"
          />
        </Field>
        <Field label="Fecha">
          <Input
            name="next_date"
            type="date"
            defaultValue={job?.next_date ?? ""}
          />
        </Field>
      </div>
      <details className="rounded-xl bg-surface-2 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">
          Más datos
        </summary>
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ubicación">
              <Input
                name="location"
                maxLength={100}
                defaultValue={job?.location ?? ""}
              />
            </Field>
            <Field label="Rango salarial">
              <Input
                name="salary_range"
                maxLength={60}
                defaultValue={job?.salary_range ?? ""}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha de aplicación">
              <Input
                name="applied_on"
                type="date"
                defaultValue={job?.applied_on ?? ""}
              />
            </Field>
            <Field label="Contacto">
              <Input
                name="contact"
                maxLength={120}
                defaultValue={job?.contact ?? ""}
              />
            </Field>
          </div>
          <Field label="Link de la vacante">
            <Input
              name="url"
              type="url"
              defaultValue={job?.url ?? ""}
              placeholder="https://"
            />
          </Field>
          <Field label="Notas">
            <Textarea
              name="notes"
              defaultValue={job?.notes ?? ""}
              className="min-h-16"
            />
          </Field>
        </div>
      </details>
      <SubmitButton>{job ? "Guardar cambios" : "Guardar vacante"}</SubmitButton>
    </ActionForm>
  );
}

export function EditJob({ job }: { job: Job }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={buttonClass("ghost", "sm")}
        onClick={() => setOpen(!open)}
      >
        {open ? "Cerrar" : "Editar"}
      </button>
      {open ? (
        <div className="mt-3 basis-full rounded-xl bg-surface-2 p-3">
          <JobForm job={job} onDone={() => setOpen(false)} />
        </div>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Interview Lab
// ---------------------------------------------------------------------------
export function QuestionForm({
  q,
  skills,
  onDone,
}: {
  q?: {
    id: string;
    category: string;
    question: string;
    my_answer: string | null;
    improved_answer: string | null;
    skill_id: string | null;
    difficulty: number;
  };
  skills: { id: string; label: string }[];
  onDone?: () => void;
}) {
  return (
    <ActionForm
      action={saveQuestion.bind(null, q?.id ?? null)}
      resetOnSuccess={!q}
      onSuccess={onDone}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoría">
          <Select name="category" defaultValue={q?.category ?? "tecnica"}>
            {INTERVIEW_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Dificultad">
          <Select name="difficulty" defaultValue={String(q?.difficulty ?? 2)}>
            <option value="1">Básica</option>
            <option value="2">Media</option>
            <option value="3">Difícil</option>
          </Select>
        </Field>
      </div>
      <Field label="Pregunta">
        <Textarea
          name="question"
          required
          defaultValue={q?.question ?? ""}
          className="min-h-16"
          placeholder="Ej. ¿Cómo diagnosticas un motor trifásico que no arranca?"
        />
      </Field>
      <Field label="Mi respuesta" hint="Con tus palabras, como la dirías hoy.">
        <Textarea name="my_answer" defaultValue={q?.my_answer ?? ""} />
      </Field>
      <Field
        label="Respuesta mejorada"
        hint="Más clara y con un ejemplo real. No para memorizar: para entender."
      >
        <Textarea
          name="improved_answer"
          defaultValue={q?.improved_answer ?? ""}
        />
      </Field>
      <Field label="Skill relacionada">
        <Select name="skill_id" defaultValue={q?.skill_id ?? ""}>
          <option value="">—</option>
          {skills.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
      </Field>
      <SubmitButton>{q ? "Guardar" : "Agregar pregunta"}</SubmitButton>
    </ActionForm>
  );
}

export function PracticeButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={buttonClass("secondary", "sm")}
      onClick={() => start(async () => void (await markPracticed(id)))}
    >
      {pending ? "…" : "Practicada hoy"}
    </button>
  );
}
