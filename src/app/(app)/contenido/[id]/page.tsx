import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext } from "@/lib/session";
import { ConfirmButton } from "@/components/forms";
import type { ContentItem } from "@/lib/types";
import { ContentEditor } from "../content-forms";
import { deleteContent } from "../actions";
import { getSkillTree } from "@/lib/skill-queries";

export const metadata: Metadata = { title: "Contenido" };

export default async function ContentDetail(props: PageProps<"/contenido/[id]">) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await getContext();
  const [{ data }, { data: prods }, { data: camps }, groups, { data: cs }] = await Promise.all([
    ctx.supabase.from("content_items").select("*").eq("id", id).maybeSingle<ContentItem>(),
    ctx.supabase.from("productions").select("id,title,event_date").order("event_date", { ascending: false, nullsFirst: false }),
    ctx.supabase.from("campaigns").select("id,brand,program").order("created_at", { ascending: false }),
    getSkillTree(ctx, { exclude: ["engineering"] }),
    ctx.supabase.from("content_skills").select("skill_id").eq("content_id", id),
  ]);
  if (!data) notFound();
  const productions = ((prods ?? []) as { id: string; title: string }[]).map((p) => ({ id: p.id, label: p.title }));
  const campaigns = ((camps ?? []) as { id: string; brand: string; program: string | null }[]).map((c) => ({
    id: c.id,
    label: c.program ? `${c.brand} · ${c.program}` : c.brand,
  }));
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <Link href="/contenido" className="text-sm text-muted hover:text-fg">
          ← Content Studio
        </Link>
        <ConfirmButton action={deleteContent.bind(null, data.id)} confirmText="¿Eliminar este contenido?">
          Eliminar
        </ConfirmButton>
      </div>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">{data.title}</h1>
      <ContentEditor key={data.id} item={data} today={ctx.today} productions={productions} campaigns={campaigns} groups={groups} skills={((cs ?? []) as { skill_id: string }[]).map((x) => x.skill_id)} />
    </>
  );
}
