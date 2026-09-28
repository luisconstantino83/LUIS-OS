import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext } from "@/lib/session";
import { formatShort } from "@/lib/dates";
import { EVIDENCE_KINDS, EVIDENCE_SUBTYPES, LEVELS, countsBySkill, maxLevel, EMPTY_COUNTS } from "@/lib/skills";
import { Badge, Card, CardTitle, EmptyState, Stat } from "@/components/ui";
import { ConfirmButton } from "@/components/forms";
import type { Skill, SkillEvidence, SkillResource } from "@/lib/types";
import { EvidenceForm, LevelControl, Resources, SkillNotesForm } from "../skills-client";
import { deleteEvidence } from "../actions";

export const metadata: Metadata = { title: "Skill" };

const hours = (min: number) => (min >= 60 ? `${(min / 60).toFixed(1)} h` : `${min} min`);
const KIND_TONE = { learn: "neutral", practice: "accent", apply: "success", reflect: "warn" } as const;

export default async function SkillPage(props: PageProps<"/skills/[id]">) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await getContext();
  const [{ data: skill }, { data: ev }, { data: res }, { data: prodLinks }, { data: contentLinks }, { data: contents }, { data: prods }, { data: projects }, { data: pathSteps }] =
    await Promise.all([
      ctx.supabase.from("skills").select("*, skill_categories(name)").eq("id", id).maybeSingle(),
      ctx.supabase.from("skill_evidence").select("*").eq("skill_id", id).order("occurred_on", { ascending: false }).order("created_at", { ascending: false }),
      ctx.supabase.from("skill_resources").select("*").eq("skill_id", id).order("created_at"),
      ctx.supabase.from("production_skills").select("productions(id,title,event_date)").eq("skill_id", id),
      ctx.supabase.from("content_skills").select("content_items(id,title,status)").eq("skill_id", id),
      ctx.supabase.from("content_items").select("id,title").order("updated_at", { ascending: false }).limit(50),
      ctx.supabase.from("productions").select("id,title").order("created_at", { ascending: false }).limit(50),
      ctx.supabase.from("skill_projects").select("id,title").neq("status", "terminado"),
      ctx.supabase.from("learning_path_steps").select("learning_paths(id,title)").eq("skill_id", id),
    ]);
  if (!skill) notFound();
  const s = skill as Skill & { skill_categories: { name: string } | null };
  const evidence = (ev ?? []) as SkillEvidence[];
  const counts = countsBySkill(evidence).get(id) ?? EMPTY_COUNTS;
  const learnMin = evidence.filter((e) => e.kind === "learn").reduce((a, e) => a + (e.minutes ?? 0), 0);
  const lastPractice = evidence.find((e) => e.kind === "practice" || e.kind === "apply")?.occurred_on;

  type P = { id: string; title: string; event_date?: string | null; status?: string };
  const usedIn = new Map<string, P & { kind: "prod" | "content" }>();
  for (const r of (prodLinks ?? []) as unknown as { productions: P | null }[]) if (r.productions) usedIn.set(r.productions.id, { ...r.productions, kind: "prod" });
  for (const r of (contentLinks ?? []) as unknown as { content_items: P | null }[]) if (r.content_items) usedIn.set(r.content_items.id, { ...r.content_items, kind: "content" });
  const contentTitle = new Map(((contents ?? []) as P[]).map((c) => [c.id, c.title]));
  const prodTitle = new Map(((prods ?? []) as P[]).map((c) => [c.id, c.title]));
  for (const e of evidence) {
    if (e.production_id && !usedIn.has(e.production_id) && prodTitle.has(e.production_id))
      usedIn.set(e.production_id, { id: e.production_id, title: prodTitle.get(e.production_id)!, kind: "prod" });
    if (e.content_id && !usedIn.has(e.content_id) && contentTitle.has(e.content_id))
      usedIn.set(e.content_id, { id: e.content_id, title: contentTitle.get(e.content_id)!, kind: "content" });
  }
  const paths = ((pathSteps ?? []) as unknown as { learning_paths: { id: string; title: string } | null }[])
    .map((p) => p.learning_paths)
    .filter(Boolean) as { id: string; title: string }[];
  const opt = (rows: unknown) => ((rows ?? []) as { id: string; title: string }[]).map((r) => ({ id: r.id, label: r.title }));

  return (
    <>
      <Link href="/skills?tab=arbol" className="mb-3 inline-block text-sm text-muted hover:text-fg">
        ← Skill Tree
      </Link>
      {s.archived ? (
        <p className="mb-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">Esta skill está desactivada. Actívala desde Mecatrónica → Software.</p>
      ) : null}
      <p className="text-sm text-muted">{s.skill_categories?.name}</p>
      <h1 className="text-[26px] font-semibold tracking-tight">{s.name}</h1>
      <p className="mb-4 mt-0.5 text-sm">
        <Badge tone={s.level >= 3 ? "success" : s.level > 0 ? "accent" : "neutral"}>{LEVELS[s.level].label}</Badge>
      </p>
      <div className="space-y-4">
        <Card>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Horas estudiadas" value={hours(learnMin)} />
            <Stat label="Horas practicadas" value={hours(counts.practiceMinutes)} />
            <Stat label="Aplicaciones" value={counts.apply} sub={`${counts.reflect} reflexiones`} />
            <Stat label="Última práctica" value={lastPractice ? formatShort(lastPractice) : "—"} />
          </div>
        </Card>

        <Card>
          <CardTitle>Nivel</CardTitle>
          <LevelControl key={s.level} skillId={s.id} level={s.level} counts={counts} allowed={maxLevel(counts)} />
        </Card>

        <Card>
          <CardTitle>Registrar evidencia</CardTitle>
          <EvidenceForm skillId={s.id} today={ctx.today} contents={opt(contents)} productions={opt(prods)} projects={opt(projects)} showSubtypes />
        </Card>

        <Card>
          <CardTitle>Evidencia</CardTitle>
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            {(["learn", "practice", "apply"] as const).map((k) => (
              <div key={k} className="rounded-xl bg-surface-2 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{k === "learn" ? "Learn" : k === "practice" ? "Practice" : "Apply"}</p>
                <p className="tabular text-lg font-semibold">{evidence.filter((e) => e.kind === k).length}</p>
              </div>
            ))}
          </div>
          {evidence.length === 0 ? (
            <EmptyState title="Sin evidencia todavía">Empieza con 15 minutos de aprender y una práctica.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {evidence.map((e) => {
                const k = EVIDENCE_KINDS.find((x) => x.value === e.kind)!;
                const link = e.content_id ? `/contenido/${e.content_id}` : e.production_id ? `/monse/producciones/${e.production_id}` : null;
                return (
                  <li key={e.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge tone={KIND_TONE[e.kind]}>{k.verb}</Badge>
                        {e.subtype ? <Badge>{EVIDENCE_SUBTYPES.find((x) => x.value === e.subtype)?.label ?? e.subtype}</Badge> : null}
                        <span className="text-xs text-muted">
                          {formatShort(e.occurred_on)}
                          {e.minutes ? ` · ${e.minutes} min` : ""}
                        </span>
                      </div>
                      {e.title ? <p className="mt-1 text-[15px]">{e.title}</p> : null}
                      {e.notes ? <p className="mt-0.5 whitespace-pre-line text-sm text-muted">{e.notes}</p> : null}
                      <div className="mt-0.5 flex flex-wrap gap-x-3 text-sm">
                        {link ? (
                          <Link href={link} className="text-accent">
                            {e.content_id ? contentTitle.get(e.content_id) ?? "Ver pieza" : prodTitle.get(e.production_id!) ?? "Ver producción"}
                          </Link>
                        ) : null}
                        {e.url ? (
                          <a href={e.url} target="_blank" rel="noreferrer" className="text-accent">
                            Resultado ↗
                          </a>
                        ) : null}
                      </div>
                    </div>
                    <ConfirmButton action={deleteEvidence.bind(null, e.id)} confirmText="¿Eliminar esta evidencia?">
                      ✕
                    </ConfirmButton>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle hint="Producciones y piezas donde usaste esta skill.">Proyectos y contenido</CardTitle>
          {usedIn.size === 0 ? (
            <p className="text-sm text-muted">Aún no la has usado en una producción o pieza.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {[...usedIn.values()].map((u) => (
                <li key={u.id}>
                  <Link href={u.kind === "prod" ? `/monse/producciones/${u.id}` : `/contenido/${u.id}`} className="hover:underline">
                    {u.kind === "prod" ? "🎬 " : "▶︎ "}
                    {u.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {paths.length ? (
            <p className="mt-3 border-t border-border pt-3 text-sm text-muted">Rutas: {paths.map((p) => p.title).join(" · ")}</p>
          ) : null}
        </Card>

        <Card>
          <CardTitle hint="Máximo 3 activos. Menos biblioteca, más práctica.">Recursos</CardTitle>
          <Resources skillId={s.id} items={(res ?? []) as SkillResource[]} />
        </Card>

        <Card>
          <CardTitle>Objetivo y notas</CardTitle>
          <SkillNotesForm skillId={s.id} nextGoal={s.next_goal} notes={s.notes} />
        </Card>
      </div>
    </>
  );
}
