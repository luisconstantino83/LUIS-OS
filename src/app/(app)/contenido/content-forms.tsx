"use client";

import { useState } from "react";
import { ActionForm, Segmented, SubmitButton } from "@/components/forms";
import { Card, CardTitle, Field, Input, Select, Textarea } from "@/components/ui";
import type { ContentItem, ContentStatus } from "@/lib/types";
import { createContent, updateContent } from "./actions";
import { OWNERS, PLATFORMS, STATUSES } from "./constants";
import { FORMATS, ROLES } from "@/lib/monse";
import { SkillPicker, type PickerGroup } from "@/components/skill-picker";

export function QuickAdd({ defaultOwner }: { defaultOwner: "luis" | "monse" }) {
  return (
    <ActionForm action={createContent} className="space-y-3">
      <Field label="Idea">
        <Input name="title" required maxLength={140} placeholder="Ej. Un día en el restaurante en 60 s" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Para">
          <Segmented name="owner" defaultValue={defaultOwner} options={OWNERS} />
        </Field>
        <Field label="Plataforma">
          <Select name="platform" defaultValue="tiktok">
            {PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <SubmitButton className="w-full" pendingText="Creando…">
        Guardar idea
      </SubmitButton>
    </ActionForm>
  );
}

export function ContentEditor({
  item,
  today,
  productions = [],
  campaigns = [],
  groups = [],
  skills = [],
}: {
  item: ContentItem;
  today: string;
  productions?: { id: string; label: string }[];
  campaigns?: { id: string; label: string }[];
  groups?: PickerGroup[];
  skills?: string[];
}) {
  const [status, setStatus] = useState<ContentStatus>(item.status);
  const [portfolio, setPortfolio] = useState(item.in_portfolio);
  const [roles, setRoles] = useState<string[]>(item.roles ?? []);
  const [m, setM] = useState({
    views: item.views?.toString() ?? "",
    likes: item.likes?.toString() ?? "",
    comments: item.comments?.toString() ?? "",
    shares: item.shares?.toString() ?? "",
    saves: item.saves?.toString() ?? "",
  });
  const n = (s: string) => Number(s) || 0;
  const views = n(m.views);
  const eng = views > 0 ? ((n(m.likes) + n(m.comments) + n(m.shares) + n(m.saves)) / views) * 100 : null;
  const metric = (key: keyof typeof m, label: string) => (
    <Field label={label}>
      <Input
        name={key}
        type="number"
        inputMode="numeric"
        min={0}
        value={m[key]}
        onChange={(e) => setM({ ...m, [key]: e.target.value })}
      />
    </Field>
  );
  return (
    <ActionForm action={updateContent.bind(null, item.id)} className="space-y-4">
      <Card>
        <CardTitle>Estado</CardTitle>
        <input type="hidden" name="status" value={status} />
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          {STATUSES.map((s, i) => {
            const idx = STATUSES.findIndex((x) => x.value === status);
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => setStatus(s.value)}
                className={`h-9 rounded-lg text-sm font-medium transition ${
                  s.value === status ? "bg-fg text-bg" : i < idx ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardTitle>Idea</CardTitle>
        <div className="space-y-3">
          <Field label="Título">
            <Input name="title" required maxLength={140} defaultValue={item.title} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Para">
              <Segmented name="owner" defaultValue={item.owner} options={OWNERS} />
            </Field>
            <Field label="Plataforma">
              <Select name="platform" defaultValue={item.platform}>
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Formato">
              <Select name="format" defaultValue={item.format ?? ""}>
                <option value="">—</option>
                {FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Producción">
              <Select name="production_id" defaultValue={item.production_id ?? ""}>
                <option value="">Ninguna</option>
                {productions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Campaña">
            <Select name="campaign_id" defaultValue={item.campaign_id ?? ""}>
              <option value="">Ninguna</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Hook" hint="Los primeros 3 segundos.">
            <Textarea name="hook" defaultValue={item.hook ?? ""} className="min-h-16" />
          </Field>
          <Field label="Concepto">
            <Textarea name="concept" defaultValue={item.concept ?? ""} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle>Producción</CardTitle>
        <div className="space-y-3">
          <Field label="Guion">
            <Textarea name="script" defaultValue={item.script ?? ""} className="min-h-40" />
          </Field>
          <Field label="Shot list" hint="Una toma por línea.">
            <Textarea name="shot_list" defaultValue={item.shot_list ?? ""} className="min-h-32" />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle>Publicación</CardTitle>
        <div className="space-y-3">
          <Field label="Caption">
            <Textarea name="caption" defaultValue={item.caption ?? ""} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="CTA">
              <Input name="cta" defaultValue={item.cta ?? ""} placeholder="Ej. Sígueme para la parte 2" />
            </Field>
            <Field label="Hashtags">
              <Input name="hashtags" defaultValue={item.hashtags ?? ""} placeholder="#filmmaking" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha programada">
              <Input name="scheduled_date" type="date" defaultValue={item.scheduled_date ?? ""} />
            </Field>
            <Field label="Fecha de publicación">
              <Input
                name="published_date"
                type="date"
                defaultValue={item.published_date ?? (status === "publicado" ? today : "")}
                key={status === "publicado" ? "p" : "n"}
              />
            </Field>
          </div>
          <Field label="URL">
            <Input name="url" type="url" defaultValue={item.url ?? ""} placeholder="https://" />
          </Field>
        </div>
      </Card>

      <Card className={status === "publicado" ? "" : "opacity-70"}>
        <CardTitle
          hint={status === "publicado" ? "Actualízalos a los 7 días para comparar parejo." : "Disponible al publicar."}
          action={
            eng != null ? (
              <div className="text-right">
                <p className="tabular text-xl font-semibold">{eng.toFixed(1)}%</p>
                <p className="text-[11px] text-muted">engagement aprox.</p>
              </div>
            ) : null
          }
        >
          Resultados
        </CardTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {metric("views", "Views")}
          {metric("likes", "Likes")}
          {metric("comments", "Comments")}
          {metric("shares", "Shares")}
          {metric("saves", "Saves")}
          <Field label="Followers gained">
            <Input name="followers_gained" type="number" inputMode="numeric" defaultValue={item.followers_gained ?? ""} />
          </Field>
        </div>
        <p className="mt-3 text-xs text-faint">Engagement = (likes + comments + shares + saves) ÷ views × 100.</p>
      </Card>

      <Card>
        <CardTitle hint="Al publicar, cada skill marcada registra una aplicación real con esta pieza como evidencia.">
          Skills demonstrated
        </CardTitle>
        <SkillPicker groups={groups} name="skills" defaultSelected={skills} />
      </Card>

      <Card>
        <CardTitle hint="Lo que muestras a marcas y clientes como filmmaker / social media manager.">Portafolio</CardTitle>
        <label className="flex items-center justify-between gap-3">
          <span className="text-[15px] font-medium">Incluir en mi portafolio</span>
          <input
            type="checkbox"
            name="in_portfolio"
            checked={portfolio}
            onChange={(e) => setPortfolio(e.target.checked)}
            className="size-5 accent-current"
          />
        </label>
        {portfolio ? (
          <div className="mt-4 space-y-3">
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-muted">Role</p>
              <div className="flex flex-wrap gap-1.5">
                {ROLES.map((r) => {
                  const on = roles.includes(r);
                  return (
                    <label
                      key={r}
                      className={`cursor-pointer select-none rounded-full px-3 py-1 text-sm transition ${on ? "bg-fg text-bg" : "bg-surface-2 text-muted"}`}
                    >
                      <input
                        type="checkbox"
                        name="roles"
                        value={r}
                        checked={on}
                        onChange={() => setRoles(on ? roles.filter((x) => x !== r) : [...roles, r])}
                        className="sr-only"
                      />
                      {r}
                    </label>
                  );
                })}
              </div>
            </div>
            <Field label="Nota para el portafolio" hint="Reto, decisión creativa o resultado que quieras destacar.">
              <Textarea name="portfolio_note" defaultValue={item.portfolio_note ?? ""} className="min-h-16" />
            </Field>
          </div>
        ) : null}
      </Card>

      <div className="sticky bottom-20 z-10 md:bottom-4">
        <SubmitButton className="w-full shadow-lg">Guardar cambios</SubmitButton>
      </div>
    </ActionForm>
  );
}
