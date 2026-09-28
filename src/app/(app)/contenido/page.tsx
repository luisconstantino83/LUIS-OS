import type { Metadata } from "next";
import Link from "next/link";
import { getContext } from "@/lib/session";
import { formatShort } from "@/lib/dates";
import { Badge, Card, CardTitle, EmptyState, PageHeader, Stat, TabLinks } from "@/components/ui";
import type { ContentItem } from "@/lib/types";
import { QuickAdd } from "./content-forms";
import { PLATFORMS, STATUSES, label } from "./constants";

export const metadata: Metadata = { title: "Content Studio" };

export default async function ContentPage(props: PageProps<"/contenido">) {
  const ctx = await getContext();
  const sp = await props.searchParams;
  const owner = sp.owner === "luis" || sp.owner === "monse" ? sp.owner : "todos";
  const platform = PLATFORMS.some((p) => p.value === sp.platform) ? (sp.platform as string) : null;

  let q = ctx.supabase.from("content_items").select("*").order("updated_at", { ascending: false });
  if (owner !== "todos") q = q.eq("owner", owner);
  if (platform) q = q.eq("platform", platform);
  const { data } = await q;
  const items = (data ?? []) as ContentItem[];

  const published = items.filter((i) => i.status === "publicado");
  const withEng = published.filter((i) => i.engagement_rate != null);
  const avg = (list: ContentItem[]) =>
    list.length ? list.reduce((s, i) => s + Number(i.engagement_rate), 0) / list.length : null;
  const byPlatform = PLATFORMS.map((p) => {
    const list = withEng.filter((i) => i.platform === p.value);
    return { ...p, n: list.length, avg: avg(list) };
  }).filter((p) => p.n > 0);
  const top = [...withEng].sort((a, b) => Number(b.engagement_rate) - Number(a.engagement_rate)).slice(0, 3);
  const followers = published.reduce((s, i) => s + (i.followers_gained ?? 0), 0);
  const views = published.reduce((s, i) => s + (i.views ?? 0), 0);

  const href = (o: string, p: string | null) =>
    `/contenido?owner=${o}${p ? `&platform=${p}` : ""}`;

  return (
    <>
      <PageHeader
        title="Content Studio"
        subtitle="De la idea al análisis. Descubre qué funciona."
        action={
          <Link href="/monse" className="text-sm text-accent">
            Monse × DAZN →
          </Link>
        }
      />
      <TabLinks
        active={owner}
        tabs={[
          { key: "todos", label: "Todos", href: href("todos", platform) },
          { key: "luis", label: "Luis", href: href("luis", platform) },
          { key: "monse", label: "Monse", href: href("monse", platform) },
        ]}
      />
      <div className="no-scrollbar -mt-2 mb-4 flex gap-1.5 overflow-x-auto">
        {[{ value: null, label: "Todas" }, ...PLATFORMS].map((p) => (
          <Link
            key={p.label}
            href={href(owner, p.value)}
            scroll={false}
            className={`rounded-full px-3 py-1 text-sm ${platform === p.value ? "bg-surface-2 text-fg ring-1 ring-border" : "text-muted"}`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <div className="space-y-4">
        <Card>
          <CardTitle>Nueva idea</CardTitle>
          <QuickAdd defaultOwner={owner === "monse" ? "monse" : "luis"} />
        </Card>

        {published.length > 0 ? (
          <Card>
            <CardTitle hint="Solo contenido publicado con views registradas.">Qué funciona</CardTitle>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Publicados" value={published.length} />
              <Stat label="Views" value={views.toLocaleString("es-MX")} />
              <Stat label="Seguidores" value={(followers >= 0 ? "+" : "") + followers.toLocaleString("es-MX")} />
            </div>
            {byPlatform.length ? (
              <ul className="mt-4 space-y-1.5 text-sm">
                {byPlatform.map((p) => (
                  <li key={p.value} className="flex justify-between">
                    <span>{p.label}</span>
                    <span className="tabular text-muted">
                      {p.avg!.toFixed(1)}% promedio · {p.n}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {top.length ? (
              <div className="mt-4 border-t border-border pt-3">
                <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.08em] text-faint">Top engagement</p>
                <ol className="space-y-1 text-sm">
                  {top.map((t, i) => (
                    <li key={t.id} className="flex justify-between gap-2">
                      <Link href={`/contenido/${t.id}`} className="truncate hover:underline">
                        {i + 1}. {t.title}
                      </Link>
                      <span className="tabular shrink-0 text-muted">{Number(t.engagement_rate).toFixed(1)}%</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </Card>
        ) : null}

        {items.length === 0 ? (
          <EmptyState title="Sin contenido todavía">Guarda tu primera idea arriba.</EmptyState>
        ) : (
          STATUSES.map((s) => {
            const list = items.filter((i) => i.status === s.value);
            if (list.length === 0) return null;
            return (
              <Card key={s.value}>
                <CardTitle action={<span className="tabular text-sm text-muted">{list.length}</span>}>{s.label}</CardTitle>
                <ul className="divide-y divide-border">
                  {list.map((i) => (
                    <li key={i.id}>
                      <Link href={`/contenido/${i.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-2">
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-medium">{i.title}</p>
                          <p className="text-xs text-muted">
                            {label(PLATFORMS, i.platform)}
                            {i.scheduled_date && i.status !== "publicado" ? ` · ${formatShort(i.scheduled_date)}` : ""}
                            {i.published_date && i.status === "publicado" ? ` · ${formatShort(i.published_date)}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {i.engagement_rate != null ? <span className="tabular text-sm text-muted">{Number(i.engagement_rate).toFixed(1)}%</span> : null}
                          <Badge tone={i.owner === "monse" ? "warn" : "accent"}>{i.owner === "monse" ? "Monse" : "Luis"}</Badge>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })
        )}
      </div>
    </>
  );
}
