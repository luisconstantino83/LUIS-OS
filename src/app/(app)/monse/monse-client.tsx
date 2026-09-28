"use client";

import clsx from "clsx";
import { useState, useTransition } from "react";
import { Check, Plus, X } from "lucide-react";
import { ActionForm, Segmented, SubmitButton } from "@/components/forms";
import { Card, CardTitle, Field, Input, ProgressBar, Select, Textarea } from "@/components/ui";
import { ErrorLine } from "../_components/day";
import { SkillPicker, type PickerGroup } from "@/components/skill-picker";
import {
  CAMPAIGN_STATUSES,
  FORMATS,
  PHASES,
  PRODUCTION_STATUSES,
  PRODUCTION_TEMPLATES,
} from "@/lib/monse";
import type { Campaign, CampaignStatus, Milestone, Phase, Production, ProductionStatus, ProductionTask } from "@/lib/types";
import {
  addProductionPiece,
  addTask,
  createCampaign,
  createProduction,
  deleteTask,
  saveProductionReview,
  setMilestoneDone,
  setTaskDone,
  updateCampaign,
  updateProduction,
} from "./actions";

const OWNERS = [
  { value: "monse" as const, label: "Monse" },
  { value: "luis" as const, label: "Luis" },
];

function StatusPipeline<T extends string>({
  name,
  options,
  value,
  onChange,
  cols = 4,
}: {
  name: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  cols?: number;
}) {
  const idx = options.findIndex((o) => o.value === value);
  return (
    <>
      <input type="hidden" name={name} value={value} />
      <div className={clsx("grid gap-1.5", cols === 4 ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-4")}>
        {options.map((o, i) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={clsx(
              "h-9 truncate rounded-lg px-1 text-[13px] font-medium transition",
              o.value === value ? "bg-fg text-bg" : i < idx ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Campañas
// ---------------------------------------------------------------------------
export function NewCampaignForm() {
  return (
    <ActionForm action={createCampaign} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Marca">
          <Input name="brand" required maxLength={80} placeholder="Ej. DAZN" />
        </Field>
        <Field label="Programa">
          <Input name="program" maxLength={80} placeholder="Ej. Playmakers" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Estado">
          <Select name="status" defaultValue="contactada">
            {CAMPAIGN_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fecha límite">
          <Input name="deadline" type="date" />
        </Field>
      </div>
      <SubmitButton className="w-full" pendingText="Creando…">
        Crear campaña
      </SubmitButton>
    </ActionForm>
  );
}

export function CampaignEditor({ c }: { c: Campaign }) {
  const [status, setStatus] = useState<CampaignStatus>(c.status);
  return (
    <ActionForm action={updateCampaign.bind(null, c.id)} className="space-y-4">
      <Card>
        <CardTitle>Estado</CardTitle>
        <StatusPipeline name="status" options={CAMPAIGN_STATUSES} value={status} onChange={setStatus} />
      </Card>
      <Card>
        <CardTitle>Marca y contacto</CardTitle>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Marca">
              <Input name="brand" required maxLength={80} defaultValue={c.brand} />
            </Field>
            <Field label="Programa">
              <Input name="program" maxLength={80} defaultValue={c.program ?? ""} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contacto">
              <Input name="contact_name" maxLength={120} defaultValue={c.contact_name ?? ""} />
            </Field>
            <Field label="Email">
              <Input name="contact_email" type="email" defaultValue={c.contact_email ?? ""} />
            </Field>
          </div>
        </div>
      </Card>
      <Card>
        <CardTitle>Brief y entregables</CardTitle>
        <div className="space-y-3">
          <Field label="Brief">
            <Textarea name="brief" defaultValue={c.brief ?? ""} className="min-h-32" placeholder="Qué quiere la marca, tono, mensajes clave, restricciones…" />
          </Field>
          <Field label="Entregables" hint="Uno por línea. Ej. 1 Reel 30 s · 3 Stories · 1 carrusel">
            <Textarea name="deliverables" defaultValue={c.deliverables ?? ""} />
          </Field>
          <Field label="Fecha límite">
            <Input name="deadline" type="date" defaultValue={c.deadline ?? ""} />
          </Field>
        </div>
      </Card>
      <Card>
        <CardTitle>Pago</CardTitle>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Monto" className="col-span-2">
            <Input name="payment_amount" type="number" inputMode="decimal" step="0.01" min={0} defaultValue={c.payment_amount ?? ""} />
          </Field>
          <Field label="Moneda">
            <Select name="payment_currency" defaultValue={c.payment_currency}>
              <option>MXN</option>
              <option>USD</option>
              <option>EUR</option>
            </Select>
          </Field>
        </div>
        <Field label="Fecha de pago" className="mt-3" hint="Se llena sola al marcar la campaña como Pagada.">
          <Input name="paid_at" type="date" defaultValue={c.paid_at ?? ""} />
        </Field>
      </Card>
      <Card>
        <CardTitle>Links y notas</CardTitle>
        <div className="space-y-3">
          <Field label="Links" hint="Drive, publicaciones, contrato… uno por línea.">
            <Textarea name="links" defaultValue={c.links ?? ""} className="min-h-16" />
          </Field>
          <Field label="Notas">
            <Textarea name="notes" defaultValue={c.notes ?? ""} />
          </Field>
        </div>
      </Card>
      <div className="sticky bottom-20 z-10 md:bottom-4">
        <SubmitButton className="w-full shadow-lg">Guardar campaña</SubmitButton>
      </div>
    </ActionForm>
  );
}

// ---------------------------------------------------------------------------
// Producciones
// ---------------------------------------------------------------------------
const FOCUS_KEYS = ["filmmaking", "postproduction", "photography"];

export function NewProductionForm({
  campaigns,
  groups,
}: {
  campaigns: { id: string; label: string }[];
  groups: PickerGroup[];
}) {
  const [tpl, setTpl] = useState("deportiva");
  const current = PRODUCTION_TEMPLATES.find((t) => t.key === tpl);
  return (
    <ActionForm action={createProduction} className="space-y-3">
      <Field label="Nombre">
        <Input name="title" required maxLength={120} placeholder="Ej. Federado de flag · León" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha del evento">
          <Input name="event_date" type="date" />
        </Field>
        <Field label="Lugar">
          <Input name="location" maxLength={120} placeholder="Ej. León, Gto." />
        </Field>
      </div>
      <Field label="Plantilla" hint={current?.description ?? "Empieza con un checklist vacío."}>
        <Select name="template" value={tpl} onChange={(e) => setTpl(e.target.value)}>
          {PRODUCTION_TEMPLATES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
          <option value="">Sin plantilla</option>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Para">
          <Segmented name="owner" defaultValue="monse" options={OWNERS} />
        </Field>
        <Field label="Campaña (opcional)">
          <Select name="campaign_id" defaultValue="">
            <option value="">Ninguna</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div>
        <p className="mb-1.5 text-[13px] font-medium text-muted">Skills to practice</p>
        <SkillPicker groups={groups} name="skills" openKeys={FOCUS_KEYS.slice(0, 1)} />
      </div>
      <SubmitButton className="w-full" pendingText="Creando…">
        Crear producción
      </SubmitButton>
    </ActionForm>
  );
}

export function ProductionChecklist({ productionId, tasks }: { productionId: string; tasks: ProductionTask[] }) {
  const [list, setList] = useState(tasks);
  const [phase, setPhase] = useState<Phase>(() => {
    const firstOpen = PHASES.find((p) => list.some((t) => t.phase === p.value && !t.done));
    return firstOpen?.value ?? "antes";
  });
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = (t: ProductionTask) => {
    setList((l) => l.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
    start(async () => {
      const r = await setTaskDone(t.id, !t.done);
      if (!r.ok) {
        setList((l) => l.map((x) => (x.id === t.id ? { ...x, done: t.done } : x)));
        setError(r.error);
      }
    });
  };
  const remove = (t: ProductionTask) =>
    start(async () => {
      const r = await deleteTask(t.id);
      if (!r.ok) return setError(r.error);
      setList((l) => l.filter((x) => x.id !== t.id));
    });
  const add = () => {
    const title = draft.trim();
    if (!title) return;
    start(async () => {
      const r = await addTask(productionId, phase, title);
      if (!r.ok) return setError(r.error);
      setList((l) => [
        ...l,
        { id: r.id, production_id: productionId, user_id: "", phase, title, done: false, sort_order: 100 },
      ]);
      setDraft("");
      setError(null);
    });
  };

  const total = list.length;
  const done = list.filter((t) => t.done).length;
  const current = list.filter((t) => t.phase === phase);
  const meta = PHASES.find((p) => p.value === phase)!;

  return (
    <Card>
      <CardTitle action={<span className="tabular text-sm text-muted">{done}/{total}</span>}>Checklist de producción</CardTitle>
      <ProgressBar value={done} max={Math.max(1, total)} tone="success" className="mb-4" />
      <div className="mb-3 grid grid-cols-3 gap-1.5">
        {PHASES.map((p) => {
          const pt = list.filter((t) => t.phase === p.value);
          const pd = pt.filter((t) => t.done).length;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => setPhase(p.value)}
              className={clsx(
                "rounded-xl px-2 py-2 text-left transition",
                phase === p.value ? "bg-fg text-bg" : "bg-surface-2 text-muted hover:text-fg",
              )}
            >
              <span className="block text-sm font-semibold">{p.label}</span>
              <span className="tabular block text-xs opacity-75">
                {pd}/{pt.length}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mb-2 text-[13px] text-muted">{meta.hint}</p>
      <ul className="divide-y divide-border">
        {current.map((t) => (
          <li key={t.id} className="group flex items-center gap-3 py-2">
            <button
              type="button"
              role="checkbox"
              aria-checked={t.done}
              onClick={() => toggle(t)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <span
                className={clsx(
                  "grid size-6 shrink-0 place-items-center rounded-md border transition",
                  t.done ? "border-success bg-success text-bg" : "border-border",
                )}
              >
                {t.done ? <Check size={14} strokeWidth={3} /> : null}
              </span>
              <span className={clsx("text-[15px]", t.done && "text-muted line-through")}>{t.title}</span>
            </button>
            <button
              type="button"
              aria-label={`Quitar ${t.title}`}
              onClick={() => remove(t)}
              className="grid size-8 place-items-center rounded-lg text-faint hover:bg-surface-2 hover:text-danger"
            >
              <X size={15} />
            </button>
          </li>
        ))}
        {current.length === 0 ? <li className="py-3 text-sm text-muted">Sin tareas en esta fase.</li> : null}
      </ul>
      <div className="mt-3 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={`Agregar a "${meta.label}"`}
          maxLength={120}
          className="h-10"
          aria-label="Nueva tarea"
        />
        <button
          type="button"
          onClick={add}
          disabled={pending || !draft.trim()}
          aria-label="Agregar tarea"
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-fg text-bg disabled:opacity-40"
        >
          <Plus size={18} />
        </button>
      </div>
      <ErrorLine error={error} />
    </Card>
  );
}

export function ProductionEditor({
  p,
  campaigns,
  groups,
  focus,
}: {
  p: Production;
  campaigns: { id: string; label: string }[];
  groups: PickerGroup[];
  focus: string[];
}) {
  const [status, setStatus] = useState<ProductionStatus>(p.status);
  const area = (name: keyof Production, label: string, hint?: string, tall = false) => (
    <Field label={label} hint={hint}>
      <Textarea name={name} defaultValue={(p[name] as string | null) ?? ""} className={tall ? "min-h-40" : undefined} />
    </Field>
  );
  return (
    <ActionForm action={updateProduction.bind(null, p.id)} className="space-y-4">
      <Card>
        <CardTitle>Estado</CardTitle>
        <StatusPipeline name="status" options={PRODUCTION_STATUSES} value={status} onChange={setStatus} />
      </Card>
      <Card>
        <CardTitle>Datos</CardTitle>
        <div className="space-y-3">
          <Field label="Nombre">
            <Input name="title" required maxLength={120} defaultValue={p.title} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha">
              <Input name="event_date" type="date" defaultValue={p.event_date ?? ""} />
            </Field>
            <Field label="Lugar">
              <Input name="location" maxLength={120} defaultValue={p.location ?? ""} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Para">
              <Segmented name="owner" defaultValue={p.owner} options={OWNERS} />
            </Field>
            <Field label="Campaña">
              <Select name="campaign_id" defaultValue={p.campaign_id ?? ""}>
                <option value="">Ninguna</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      </Card>
      <Card>
        <CardTitle hint="Investigar → concepto → referencias → guion → hooks → shot list → equipo">Preproducción</CardTitle>
        <div className="space-y-3">
          {area("concept", "Concepto", "¿Qué historia cuentas? ¿Qué debe sentir quien lo vea?")}
          {area("story_beats", "Estructura narrativa", "Un momento por línea.", true)}
          {area("refs", "Referencias", "Links o descripciones.")}
          {area("hooks", "Hooks", "Opciones para los primeros 3 segundos.")}
          {area("shot_list", "Shot list", "Una toma por línea: plano, movimiento, momento.", true)}
          {area("gear", "Equipo")}
          {area("planned_outputs", "Piezas planeadas", "Qué va a salir de esta producción.")}
        </div>
      </Card>
      <Card>
        <CardTitle hint="Monse como laboratorio real: elige qué quieres practicar en esta producción.">Skills to practice</CardTitle>
        <SkillPicker groups={groups} name="skills" defaultSelected={focus} openKeys={focus.length ? [] : FOCUS_KEYS.slice(0, 1)} />
      </Card>
      <div className="sticky bottom-20 z-10 md:bottom-4">
        <SubmitButton className="w-full shadow-lg">Guardar producción</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function PieceForm({ productionId }: { productionId: string }) {
  return (
    <ActionForm action={addProductionPiece.bind(null, productionId)} resetOnSuccess className="space-y-3">
      <Field label="Pieza">
        <Input name="title" required maxLength={140} placeholder="Ej. Mini documental Federado" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Formato">
          <Select name="format" defaultValue="reel">
            {FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Plataforma">
          <Select name="platform" defaultValue="instagram">
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="youtube">YouTube</option>
          </Select>
        </Field>
      </div>
      <SubmitButton variant="secondary">Agregar pieza</SubmitButton>
    </ActionForm>
  );
}

// ---------------------------------------------------------------------------
// Ruta (hitos)
// ---------------------------------------------------------------------------
export function MilestoneList({ items, current }: { items: Milestone[]; current: string }) {
  const [list, setList] = useState(items);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const toggle = (m: Milestone) => {
    setList((l) => l.map((x) => (x.id === m.id ? { ...x, done: !x.done } : x)));
    start(async () => {
      const r = await setMilestoneDone(m.id, !m.done);
      if (!r.ok) setError(r.error);
    });
  };
  return (
    <>
      <ol className="relative space-y-4 border-l border-border pl-5">
        {list.map((m) => {
          const isNow = m.target_date != null && m.target_date >= current && !list.some((x) => x.target_date != null && x.target_date >= current && x.target_date < m.target_date!);
          return (
            <li key={m.id} className="relative">
              <button
                type="button"
                role="checkbox"
                aria-checked={m.done}
                aria-label={`Marcar ${m.title}`}
                onClick={() => toggle(m)}
                className={clsx(
                  "absolute -left-[30px] top-0.5 grid size-5 place-items-center rounded-full border-2 transition",
                  m.done ? "border-success bg-success text-bg" : isNow ? "border-accent bg-surface" : "border-border bg-surface",
                )}
              >
                {m.done ? <Check size={11} strokeWidth={3} /> : null}
              </button>
              <p className={clsx("text-xs font-semibold uppercase tracking-[0.08em]", isNow ? "text-accent" : "text-faint")}>
                {m.period_label}
                {isNow ? " · ahora" : ""}
              </p>
              <p className={clsx("mt-0.5 font-medium", m.done && "text-muted line-through")}>{m.title}</p>
              {m.description ? <p className="mt-0.5 text-sm text-muted">{m.description}</p> : null}
            </li>
          );
        })}
      </ol>
      <ErrorLine error={error} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Revisión post-producción → evidencia de skills
// ---------------------------------------------------------------------------
export function ProductionReview({
  p,
  focus,
  groups,
}: {
  p: Production;
  focus: { id: string; name: string }[];
  groups: PickerGroup[];
}) {
  const [practiced, setPracticed] = useState<string[]>(focus.map((f) => f.id));
  const [extra, setExtra] = useState<string[]>([]);
  const q = (name: keyof Production, label: string) => (
    <Field label={label}>
      <Textarea name={name} defaultValue={(p[name] as string | null) ?? ""} className="min-h-16" />
    </Field>
  );
  return (
    <Card id="revision">
      <CardTitle
        hint={
          p.reviewed_at
            ? "Revisión guardada. Puedes actualizarla."
            : "Al terminar la producción. Tus respuestas se guardan como evidencia en cada skill practicada."
        }
      >
        Post-production review
      </CardTitle>
      <ActionForm action={saveProductionReview.bind(null, p.id)} className="space-y-3">
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-muted">¿Qué habilidades practicaste?</p>
          {focus.length ? (
            <div className="flex flex-wrap gap-1.5">
              {focus.map((f) => {
                const on = practiced.includes(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPracticed(on ? practiced.filter((x) => x !== f.id) : [...practiced, f.id])}
                    className={clsx("rounded-full px-3 py-1 text-sm transition", on ? "bg-fg text-bg" : "bg-surface-2 text-muted")}
                  >
                    {on ? "✓ " : ""}
                    {f.name}
                  </button>
                );
              })}
            </div>
          ) : null}
          {practiced.map((id) => (
            <input key={id} type="hidden" name="practiced" value={id} />
          ))}
          <details className="mt-2">
            <summary className="cursor-pointer text-sm text-accent">{focus.length ? "Agregar otras skills" : "Elegir skills practicadas"}</summary>
            <div className="mt-2">
              <SkillPicker groups={groups} name="practiced" onChange={setExtra} />
            </div>
          </details>
          {extra.length ? <p className="mt-1 text-xs text-muted">+{extra.length} adicionales</p> : null}
        </div>
        {q("learnings", "¿Qué aprendí?")}
        {q("review_failed", "¿Qué falló / qué salió mal?")}
        {q("review_missing_shot", "¿Qué toma me faltó?")}
        {q("review_repeat", "¿Qué repetiría?")}
        {q("review_differently", "¿Qué haría diferente?")}
        <Field label="¿Qué skill necesita más práctica?">
          <Select name="review_next_skill_id" defaultValue={p.review_next_skill_id ?? ""}>
            <option value="">—</option>
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
        <SubmitButton className="w-full">{p.reviewed_at ? "Actualizar revisión" : "Guardar revisión y cerrar producción"}</SubmitButton>
      </ActionForm>
    </Card>
  );
}
