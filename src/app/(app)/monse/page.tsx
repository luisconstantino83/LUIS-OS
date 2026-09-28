import type { Metadata } from "next";
import Link from "next/link";
import { getContext } from "@/lib/session";
import { addDays, formatISO, formatLong, formatMonthYear, formatShort, monthStart, parseISO } from "@/lib/dates";
import { money } from "@/lib/finance";
import {
  CAMPAIGN_STATUSES,
  FORMATS,
  PRODUCTION_STATUSES,
  isActiveCampaign,
  labelOf,
  pendingPayments,
} from "@/lib/monse";
import { Badge, Card, CardTitle, EmptyState, PageHeader, ProgressBar, Stat, TabLinks } from "@/components/ui";
import type { Campaign, ContentItem, Milestone, Production, ProductionTask } from "@/lib/types";
import { MilestoneList, NewCampaignForm, NewProductionForm } from "./monse-client";
import { getSkillTree } from "@/lib/skill-queries";

export const metadata: Metadata = { title: "Monse × DAZN" };

const TABS = [
  { key: "resumen", label: "Resumen" },
  { key: "campanas", label: "Campañas" },
  { key: "producciones", label: "Producciones" },
  { key: "calendario", label: "Calendario" },
  { key: "portafolio", label: "Portafolio" },
];

const PLATFORM_LABEL: Record<string, string> = { youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok" };

function shiftMonth(iso: string, delta: number) {
  const d = parseISO(iso);
  d.setUTCMonth(d.getUTCMonth() + delta, 1);
  return formatISO(d);
}

type AgendaItem = { date: string; kind: "produccion" | "deadline" | "contenido"; title: string; href: string; sub: string };

export default async function MonsePage(props: PageProps<"/monse">) {
  const ctx = await getContext();
  const sp = await props.searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as string) : "resumen";

  const [campRes, prodRes, taskRes, contentRes, msRes, skillGroups, csRes] = await Promise.all([
    ctx.supabase.from("campaigns").select("*").order("deadline", { ascending: true, nullsFirst: false }),
    ctx.supabase.from("productions").select("*").order("event_date", { ascending: true, nullsFirst: false }),
    ctx.supabase.from("production_tasks").select("production_id,done"),
    ctx.supabase
      .from("content_items")
      .select(
        "id,title,owner,platform,format,status,scheduled_date,published_date,production_id,campaign_id,in_portfolio,portfolio_note,roles,views,likes,comments,shares,saves,followers_gained,engagement_rate,url",
      ),
    ctx.supabase.from("milestones").select("*").eq("area", "monse").order("target_date"),
    getSkillTree(ctx, { exclude: ["engineering"] }),
    ctx.supabase.from("content_skills").select("content_id, skill_id, skills(name)"),
  ]);
  const contentSkills = (csRes.data ?? []) as unknown as { content_id: string; skill_id: string; skills: { name: string } | null }[];
  const campaigns = (campRes.data ?? []) as Campaign[];
  const productions = (prodRes.data ?? []) as Production[];
  const tasks = (taskRes.data ?? []) as Pick<ProductionTask, "production_id" | "done">[];
  const content = (contentRes.data ?? []) as ContentItem[];
  const milestones = (msRes.data ?? []) as Milestone[];

  const progress = (id: string) => {
    const t = tasks.filter((x) => x.production_id === id);
    return { done: t.filter((x) => x.done).length, total: t.length };
  };
  const campaignLabel = (c: Campaign) => (c.program ? `${c.brand} · ${c.program}` : c.brand);
  const campaignOptions = campaigns.filter((c) => c.status !== "pagada").map((c) => ({ id: c.id, label: campaignLabel(c) }));
  const monseContent = content.filter((c) => c.owner === "monse");

  // Agenda (producciones, fechas límite y contenido de Monse)
  const agenda: AgendaItem[] = [
    ...productions
      .filter((p) => p.event_date)
      .map((p) => ({
        date: p.event_date!,
        kind: "produccion" as const,
        title: p.title,
        href: `/monse/producciones/${p.id}`,
        sub: `Producción${p.location ? ` · ${p.location}` : ""}`,
      })),
    ...campaigns
      .filter((c) => c.deadline && c.status !== "pagada")
      .map((c) => ({
        date: c.deadline!,
        kind: "deadline" as const,
        title: campaignLabel(c),
        href: `/monse/campanas/${c.id}`,
        sub: `Fecha límite · ${labelOf(CAMPAIGN_STATUSES, c.status)}`,
      })),
    ...monseContent
      .filter((c) => (c.status === "publicado" ? c.published_date : c.scheduled_date))
      .map((c) => ({
        date: (c.status === "publicado" ? c.published_date : c.scheduled_date)!,
        kind: "contenido" as const,
        title: c.title,
        href: `/contenido/${c.id}`,
        sub: `${PLATFORM_LABEL[c.platform]}${c.format ? ` · ${labelOf(FORMATS, c.format)}` : ""} · ${c.status === "publicado" ? "Publicado" : "Programado"}`,
      })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const upcoming = agenda.filter((a) => a.date >= ctx.today && a.date <= addDays(ctx.today, 14));
  const nextProduction = productions.find((p) => p.status !== "terminada" && (!p.event_date || p.event_date >= ctx.today));
  const activeCampaigns = campaigns.filter((c) => isActiveCampaign(c.status));
  const pending = pendingPayments(campaigns);
  const portfolio = content.filter((c) => c.in_portfolio);

  const kindBadge = (k: AgendaItem["kind"]) =>
    k === "produccion" ? <Badge tone="accent">Producción</Badge> : k === "deadline" ? <Badge tone="warn">Entrega</Badge> : <Badge>Contenido</Badge>;

  const agendaList = (items: AgendaItem[]) => {
    const byDate = new Map<string, AgendaItem[]>();
    for (const i of items) byDate.set(i.date, [...(byDate.get(i.date) ?? []), i]);
    return (
      <div className="space-y-4">
        {[...byDate.entries()].map(([d, list]) => (
          <div key={d}>
            <p className={`mb-1 text-xs font-semibold uppercase tracking-[0.08em] ${d === ctx.today ? "text-accent" : "text-faint"}`}>
              {d === ctx.today ? "Hoy · " : ""}
              {formatLong(d)}
            </p>
            <ul className="divide-y divide-border">
              {list.map((i, n) => (
                <li key={n}>
                  <Link href={i.href} className="-mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-medium">{i.title}</p>
                      <p className="truncate text-xs text-muted">{i.sub}</p>
                    </div>
                    {kindBadge(i.kind)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  };

  // Calendario por mes
  const mesParam = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? `${sp.mes}-01` : null;
  const month = mesParam ?? monthStart(ctx.today);
  const monthEnd = shiftMonth(month, 1);
  const monthItems = agenda.filter((a) => a.date >= month && a.date < monthEnd);

  return (
    <>
      <PageHeader title="Monse × DAZN" subtitle="Tu primer proyecto profesional de portafolio: filmmaker, editor y estratega." />
      <TabLinks active={tab} tabs={TABS.map((t) => ({ ...t, href: `/monse?tab=${t.key}` }))} />

      {tab === "resumen" ? (
        <div className="space-y-4">
          <Card>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Campañas activas" value={activeCampaigns.length} />
              <Stat
                label="Por cobrar"
                value={Object.keys(pending).length ? Object.entries(pending).map(([cur, v]) => `${money(v)}${cur !== "MXN" ? " " + cur : ""}`).join(" + ") : "—"}
              />
              <Stat label="En portafolio" value={portfolio.length} sub="piezas" />
            </div>
          </Card>

          <Card>
            <CardTitle action={<Link href="/monse?tab=producciones" className="text-sm text-accent">Todas</Link>}>Próxima producción</CardTitle>
            {nextProduction ? (
              <Link href={`/monse/producciones/${nextProduction.id}`} className="-mx-2 block rounded-xl px-2 py-1 hover:bg-surface-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold">{nextProduction.title}</p>
                    <p className="text-sm text-muted">
                      {nextProduction.event_date ? formatLong(nextProduction.event_date) : "Sin fecha"}
                      {nextProduction.location ? ` · ${nextProduction.location}` : ""}
                    </p>
                  </div>
                  <Badge tone="accent">{labelOf(PRODUCTION_STATUSES, nextProduction.status)}</Badge>
                </div>
                {progress(nextProduction.id).total ? (
                  <div className="mt-3">
                    <ProgressBar value={progress(nextProduction.id).done} max={progress(nextProduction.id).total} tone="success" />
                    <p className="tabular mt-1 text-xs text-muted">
                      {progress(nextProduction.id).done}/{progress(nextProduction.id).total} del checklist
                    </p>
                  </div>
                ) : null}
              </Link>
            ) : (
              <EmptyState title="Sin producciones próximas">Crea una en la pestaña Producciones.</EmptyState>
            )}
          </Card>

          <Card>
            <CardTitle hint="Producciones, entregas y contenido de Monse.">Próximos 14 días</CardTitle>
            {upcoming.length ? agendaList(upcoming) : <p className="text-sm text-muted">Nada agendado. Buen momento para planear.</p>}
          </Card>

          <Card>
            <CardTitle hint="Proyecto aspiracional: guía el trabajo, no promete resultados.">Ruta hacia el Super Bowl 2027</CardTitle>
            <MilestoneList items={milestones} current={ctx.today} />
          </Card>
        </div>
      ) : null}

      {tab === "campanas" ? (
        <div className="space-y-4">
          <Card>
            <CardTitle hint="DAZN Playmakers, Prime Video / Kreatornow, marcas.">Nueva campaña</CardTitle>
            <NewCampaignForm />
          </Card>
          {campaigns.length === 0 ? (
            <EmptyState title="Sin campañas todavía" />
          ) : (
            CAMPAIGN_STATUSES.map((s) => {
              const list = campaigns.filter((c) => c.status === s.value);
              if (!list.length) return null;
              return (
                <Card key={s.value}>
                  <CardTitle action={<span className="tabular text-sm text-muted">{list.length}</span>}>{s.label}</CardTitle>
                  <ul className="divide-y divide-border">
                    {list.map((c) => (
                      <li key={c.id}>
                        <Link href={`/monse/campanas/${c.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-2">
                          <div className="min-w-0">
                            <p className="truncate text-[15px] font-medium">{campaignLabel(c)}</p>
                            <p className="text-xs text-muted">
                              {c.deadline ? `Entrega ${formatShort(c.deadline)}` : "Sin fecha límite"}
                              {c.payment_amount != null ? ` · ${money(c.payment_amount)} ${c.payment_currency}` : ""}
                            </p>
                          </div>
                          {c.deadline && c.deadline < ctx.today && !["publicada", "pagada"].includes(c.status) ? (
                            <Badge tone="warn">Vencida</Badge>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })
          )}
        </div>
      ) : null}

      {tab === "producciones" ? (
        <div className="space-y-4">
          <Card>
            <CardTitle hint="Cada evento como una producción completa: antes, durante y después.">Nueva producción</CardTitle>
            <NewProductionForm campaigns={campaignOptions} groups={skillGroups} />
          </Card>
          {productions.length === 0 ? (
            <EmptyState title="Sin producciones todavía" />
          ) : (
            <Card>
              <CardTitle>Producciones</CardTitle>
              <ul className="divide-y divide-border">
                {productions.map((p) => {
                  const pr = progress(p.id);
                  const pieces = content.filter((c) => c.production_id === p.id).length;
                  return (
                    <li key={p.id}>
                      <Link href={`/monse/producciones/${p.id}`} className="-mx-2 block rounded-xl px-2 py-3 hover:bg-surface-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[15px] font-medium">{p.title}</p>
                            <p className="text-xs text-muted">
                              {p.event_date ? formatShort(p.event_date) : "Sin fecha"}
                              {p.location ? ` · ${p.location}` : ""}
                              {pieces ? ` · ${pieces} piezas` : ""}
                              {p.owner === "luis" ? " · Luis" : ""}
                            </p>
                          </div>
                          <Badge tone={p.status === "terminada" ? "success" : "neutral"}>{labelOf(PRODUCTION_STATUSES, p.status)}</Badge>
                        </div>
                        {pr.total ? <ProgressBar value={pr.done} max={pr.total} tone="success" className="mt-2" /> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
      ) : null}

      {tab === "calendario" ? (
        <Card>
          <CardTitle
            action={
              <div className="flex items-center gap-1 text-sm">
                <Link scroll={false} className="rounded-lg px-2 py-1 text-muted hover:bg-surface-2" href={`/monse?tab=calendario&mes=${shiftMonth(month, -1).slice(0, 7)}`}>
                  ‹
                </Link>
                <span className="capitalize">{formatMonthYear(month)}</span>
                <Link scroll={false} className="rounded-lg px-2 py-1 text-muted hover:bg-surface-2" href={`/monse?tab=calendario&mes=${shiftMonth(month, 1).slice(0, 7)}`}>
                  ›
                </Link>
              </div>
            }
            hint="Calendario independiente de Monse. Programa fechas en cada pieza de Content Studio."
          >
            Calendario
          </CardTitle>
          {monthItems.length ? agendaList(monthItems) : <EmptyState title="Nada este mes" />}
        </Card>
      ) : null}

      {tab === "portafolio" ? (
        <div className="space-y-4">
          <Card className="border-transparent bg-surface-2">
            <p className="text-sm text-muted">
              Marca una pieza como <b className="text-fg">portafolio</b> desde su editor en Content Studio. Anota qué hiciste
              (cámara, edición, color…) y sus resultados: esto es lo que mostrarás a marcas y clientes.
            </p>
          </Card>
          {portfolio.length === 0 ? (
            <EmptyState title="Tu portafolio está vacío">Cuando publiques algo de lo que estés orgulloso, márcalo aquí.</EmptyState>
          ) : (
            portfolio.map((c) => {
              const prod = productions.find((p) => p.id === c.production_id);
              const camp = campaigns.find((x) => x.id === c.campaign_id);
              return (
                <Card key={c.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/contenido/${c.id}`} className="block truncate font-semibold hover:underline">
                        {c.title}
                      </Link>
                      <p className="text-xs text-muted">
                        {c.owner === "monse" ? "Monse" : "Luis"} · {PLATFORM_LABEL[c.platform]}
                        {c.format ? ` · ${labelOf(FORMATS, c.format)}` : ""}
                        {c.published_date ? ` · ${formatShort(c.published_date)}` : ""}
                      </p>
                      {prod || camp ? (
                        <p className="text-xs text-muted">
                          {prod ? `Producción: ${prod.title}` : ""}
                          {prod && camp ? " · " : ""}
                          {camp ? `Campaña: ${campaignLabel(camp)}` : ""}
                        </p>
                      ) : null}
                    </div>
                    {c.engagement_rate != null ? (
                      <div className="text-right">
                        <p className="tabular font-semibold">{Number(c.engagement_rate).toFixed(1)}%</p>
                        <p className="text-[11px] text-muted">engagement</p>
                      </div>
                    ) : null}
                  </div>
                  {c.roles?.length ? (
                    <div className="mt-3 flex flex-wrap items-center gap-1">
                      <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">Role</span>
                      {c.roles.map((r) => (
                        <Badge key={r}>{r}</Badge>
                      ))}
                    </div>
                  ) : null}
                  {contentSkills.some((x) => x.content_id === c.id) ? (
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">Skills demonstrated</span>
                      {contentSkills
                        .filter((x) => x.content_id === c.id)
                        .map((x) => (
                          <Link key={x.skill_id} href={`/skills/${x.skill_id}`}>
                            <Badge tone="accent">{x.skills?.name}</Badge>
                          </Link>
                        ))}
                    </div>
                  ) : null}
                  {c.portfolio_note ? <p className="mt-3 text-sm">{c.portfolio_note}</p> : null}
                  <div className="tabular mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                    {c.views != null ? <span>{c.views.toLocaleString("es-MX")} views</span> : null}
                    {c.likes != null ? <span>{c.likes.toLocaleString("es-MX")} likes</span> : null}
                    {c.shares != null ? <span>{c.shares.toLocaleString("es-MX")} shares</span> : null}
                    {c.saves != null ? <span>{c.saves.toLocaleString("es-MX")} saves</span> : null}
                    {c.followers_gained ? <span>+{c.followers_gained} seguidores</span> : null}
                    {c.url ? (
                      <a href={c.url} target="_blank" rel="noreferrer" className="text-accent">
                        Ver publicación ↗
                      </a>
                    ) : null}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      ) : null}
    </>
  );
}
