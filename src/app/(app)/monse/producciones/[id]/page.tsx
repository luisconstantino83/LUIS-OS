import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext } from "@/lib/session";
import { formatLong } from "@/lib/dates";
import { FORMATS, labelOf } from "@/lib/monse";
import { Badge, Card, CardTitle, EmptyState } from "@/components/ui";
import { ConfirmButton } from "@/components/forms";
import type { Campaign, ContentItem, Production, ProductionTask } from "@/lib/types";
import { PieceForm, ProductionChecklist, ProductionEditor, ProductionReview } from "../../monse-client";
import { getSkillTree } from "@/lib/skill-queries";
import { deleteProduction } from "../../actions";

export const metadata: Metadata = { title: "Producción" };

const STATUS_LABEL: Record<string, string> = {
  idea: "Idea", guion: "Guion", grabacion: "Grabación", edicion: "Edición", programado: "Programado", publicado: "Publicado",
};

export default async function ProductionPage(props: PageProps<"/monse/producciones/[id]">) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await getContext();
  const [{ data: p }, { data: tasks }, { data: pieces }, { data: camps }, { data: focusRows }, groups] = await Promise.all([
    ctx.supabase.from("productions").select("*").eq("id", id).maybeSingle<Production>(),
    ctx.supabase.from("production_tasks").select("*").eq("production_id", id).order("sort_order").order("created_at"),
    ctx.supabase.from("content_items").select("*").eq("production_id", id).order("created_at"),
    ctx.supabase.from("campaigns").select("id,brand,program,status"),
    ctx.supabase.from("production_skills").select("skill_id, skills(name)").eq("production_id", id),
    getSkillTree(ctx, { exclude: ["engineering"] }),
  ]);
  if (!p) notFound();
  const campaigns = ((camps ?? []) as Pick<Campaign, "id" | "brand" | "program" | "status">[]).map((c) => ({
    id: c.id,
    label: c.program ? `${c.brand} · ${c.program}` : c.brand,
  }));
  const camp = campaigns.find((c) => c.id === p.campaign_id);
  const items = (pieces ?? []) as ContentItem[];
  const focus = ((focusRows ?? []) as unknown as { skill_id: string; skills: { name: string } | null }[]).map((f) => ({
    id: f.skill_id,
    name: f.skills?.name ?? "Skill",
  }));
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <Link href="/monse?tab=producciones" className="text-sm text-muted hover:text-fg">
          ← Producciones
        </Link>
        <ConfirmButton action={deleteProduction.bind(null, p.id)} confirmText="¿Eliminar esta producción y su checklist? Las piezas de contenido se conservan.">
          Eliminar
        </ConfirmButton>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{p.title}</h1>
      <p className="mb-4 text-sm text-muted">
        {p.event_date ? formatLong(p.event_date) : "Sin fecha"}
        {p.location ? ` · ${p.location}` : ""}
        {camp ? (
          <>
            {" · "}
            <Link href={`/monse/campanas/${p.campaign_id}`} className="text-accent">
              {camp.label}
            </Link>
          </>
        ) : null}
      </p>
      {focus.length ? (
        <div className="-mt-2 mb-4 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">Focus skills</span>
          {focus.map((f) => (
            <Link key={f.id} href={`/skills/${f.id}`}>
              <Badge tone="accent">{f.name}</Badge>
            </Link>
          ))}
        </div>
      ) : null}
      <div className="space-y-4">
        <ProductionChecklist productionId={p.id} tasks={(tasks ?? []) as ProductionTask[]} />
        <Card>
          <CardTitle hint="Cada pieza aparece en Content Studio y en el calendario.">Piezas que salen de aquí</CardTitle>
          {items.length ? (
            <ul className="mb-4 divide-y divide-border">
              {items.map((c) => (
                <li key={c.id}>
                  <Link href={`/contenido/${c.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-2">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-medium">{c.title}</p>
                      <p className="text-xs text-muted">
                        {c.format ? labelOf(FORMATS, c.format) + " · " : ""}
                        {c.platform}
                        {c.in_portfolio ? " · portafolio" : ""}
                      </p>
                    </div>
                    <Badge tone={c.status === "publicado" ? "success" : "neutral"}>{STATUS_LABEL[c.status]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mb-4">
              <EmptyState title="Aún no hay piezas">Agrega el vlog, los Reels, el carrusel o el mini documental.</EmptyState>
            </div>
          )}
          <PieceForm productionId={p.id} />
        </Card>
        <ProductionEditor key={p.id + p.status} p={p} campaigns={campaigns} groups={groups} focus={focus.map((f) => f.id)} />
        <ProductionReview key={"r" + p.id} p={p} focus={focus} groups={groups} />
      </div>
    </>
  );
}
