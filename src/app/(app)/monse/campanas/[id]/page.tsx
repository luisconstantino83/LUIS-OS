import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext } from "@/lib/session";
import { formatShort } from "@/lib/dates";
import { FORMATS, PRODUCTION_STATUSES, labelOf, lines } from "@/lib/monse";
import { Badge, Card, CardTitle } from "@/components/ui";
import { ConfirmButton } from "@/components/forms";
import type { Campaign, ContentItem, Production } from "@/lib/types";
import { CampaignEditor } from "../../monse-client";
import { deleteCampaign } from "../../actions";

export const metadata: Metadata = { title: "Campaña" };

export default async function CampaignPage(props: PageProps<"/monse/campanas/[id]">) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await getContext();
  const [{ data: c }, { data: prods }, { data: pieces }] = await Promise.all([
    ctx.supabase.from("campaigns").select("*").eq("id", id).maybeSingle<Campaign>(),
    ctx.supabase.from("productions").select("id,title,event_date,status").eq("campaign_id", id),
    ctx.supabase.from("content_items").select("id,title,status,format,published_date").eq("campaign_id", id),
  ]);
  if (!c) notFound();
  const deliverables = lines(c.deliverables);
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <Link href="/monse?tab=campanas" className="text-sm text-muted hover:text-fg">
          ← Campañas
        </Link>
        <ConfirmButton action={deleteCampaign.bind(null, c.id)} confirmText="¿Eliminar esta campaña? Las piezas y producciones ligadas se conservan.">
          Eliminar
        </ConfirmButton>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{c.brand}</h1>
      <p className="mb-4 text-sm text-muted">{c.program ?? "Campaña"}{c.deadline ? ` · entrega ${formatShort(c.deadline)}` : ""}</p>
      <div className="space-y-4">
        {deliverables.length || (prods ?? []).length || (pieces ?? []).length ? (
          <Card>
            <CardTitle>Producción y entregables</CardTitle>
            {deliverables.length ? (
              <ul className="mb-3 space-y-1 text-sm">
                {deliverables.map((d, i) => (
                  <li key={i}>· {d}</li>
                ))}
              </ul>
            ) : null}
            <ul className="divide-y divide-border">
              {((prods ?? []) as Pick<Production, "id" | "title" | "event_date" | "status">[]).map((p) => (
                <li key={p.id}>
                  <Link href={`/monse/producciones/${p.id}`} className="flex items-center justify-between gap-2 py-2 text-sm hover:underline">
                    <span>🎬 {p.title}{p.event_date ? ` · ${formatShort(p.event_date)}` : ""}</span>
                    <Badge>{labelOf(PRODUCTION_STATUSES, p.status)}</Badge>
                  </Link>
                </li>
              ))}
              {((pieces ?? []) as Pick<ContentItem, "id" | "title" | "status" | "format" | "published_date">[]).map((p) => (
                <li key={p.id}>
                  <Link href={`/contenido/${p.id}`} className="flex items-center justify-between gap-2 py-2 text-sm hover:underline">
                    <span>{p.title}{p.format ? ` · ${labelOf(FORMATS, p.format)}` : ""}</span>
                    <Badge tone={p.status === "publicado" ? "success" : "neutral"}>{p.status}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
        <CampaignEditor key={c.id} c={c} />
      </div>
    </>
  );
}
