import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getContext } from "@/lib/session";
import { addDays, weekStart } from "@/lib/dates";
import { getSkillTree, getSkillWeek, getWeekEvidenceForSkill } from "@/lib/skill-queries";
import { LEVELS, trackProgress, stepsFor, stepsDone } from "@/lib/skills";
import { Badge, Card, CardTitle, EmptyState, LinkButton, PageHeader, ProgressBar, Stat, TabLinks } from "@/components/ui";
import type { FocusItem, LabProject } from "@/lib/types";
import { LabActions, SessionForm, SoftwareToggle } from "./mx-client";

export const metadata: Metadata = { title: "Mechatronics Academy" };

const TABS = [
  { key: "resumen", label: "Resumen" },
  { key: "mapa", label: "Knowledge Map" },
  { key: "lab", label: "Lab" },
  { key: "software", label: "Software" },
];
const LEVEL_NAMES = ["", "Nivel 1 · Bases", "Nivel 2 · Aplicación", "Nivel 3 · Integración", "Nivel 4 · Sistemas"];
const hrs = (m: number) => (m >= 60 ? `${(m / 60).toFixed(1)} h` : `${m} min`);

function LevelBar({ level }: { level: number }) {
  return (
    <span className="flex gap-0.5" aria-label={LEVELS[level].label}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-1.5 w-3 rounded-full ${i <= level ? "bg-accent" : "bg-track"}`} />
      ))}
    </span>
  );
}

export default async function MechatronicsPage(props: PageProps<"/mecatronica">) {
  const ctx = await getContext();
  const sp = await props.searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as string) : "resumen";
  const ws = weekStart(ctx.today);

  const [areas, week, { data: ev }, { data: projs }, { data: projSkills }, { data: season }, { data: software }] = await Promise.all([
    getSkillTree(ctx, { only: ["engineering"] }),
    getSkillWeek(ctx, ws, "engineering"),
    ctx.supabase.from("skill_evidence").select("skill_id,kind,minutes,occurred_on,subtype, skills!inner(category_id, skill_categories!inner(domain))").eq("skills.skill_categories.domain", "engineering"),
    ctx.supabase.from("skill_projects").select("*").eq("domain", "engineering").order("sequence"),
    ctx.supabase.from("skill_project_skills").select("project_id,skill_id"),
    ctx.supabase.from("focus_seasons").select("name, focus_items(label,level)").lte("starts_on", ctx.today).gte("ends_on", ctx.today).maybeSingle(),
    ctx.supabase.from("skills").select("id,name,archived, skill_categories!inner(key)").eq("skill_categories.key", "mx-software").order("sort_order"),
  ]);
  const evidence = (ev ?? []) as unknown as { skill_id: string; kind: string; minutes: number | null; occurred_on: string; subtype: string | null }[];
  const projects = (projs ?? []) as LabProject[];
  const links = (projSkills ?? []) as { project_id: string; skill_id: string }[];
  const weekEv = evidence.filter((e) => e.occurred_on >= ws);
  const sum = (rows: typeof evidence, kind: string) => rows.filter((e) => e.kind === kind).reduce((s, e) => s + (e.minutes ?? 0), 0);
  const skillName = new Map(areas.flatMap((a) => a.skills.map((s) => [s.id, s.name] as const)));
  const practiced = new Set(evidence.map((e) => e.skill_id));
  const current = projects.find((p) => p.status === "activo");
  const completed = projects.filter((p) => p.status === "terminado").length;
  const weekSkillEv = week ? await getWeekEvidenceForSkill(ctx, week.skill_id, ws, addDays(ws, 6)) : [];
  const weekPct = week ? trackProgress("engineering", weekSkillEv) : 0;
  const weekDone = stepsDone("engineering", weekSkillEv);
  const mxFocus = ((season as { focus_items?: FocusItem[] } | null)?.focus_items ?? []).find((f) => f.label.toLowerCase().startsWith("mecha"));

  return (
    <>
      <PageHeader title="Mechatronics Academy" subtitle="Aprender → entender → practicar → aplicar → construir → demostrar." />
      <TabLinks active={tab} tabs={TABS.map((t) => ({ ...t, href: `/mecatronica?tab=${t.key}` }))} />

      {tab === "resumen" ? (
        <div className="space-y-4">
          <Card>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Stat label="Current focus" value={mxFocus ? mxFocus.level.toUpperCase() : "—"} sub={(season as { name?: string } | null)?.name ?? "Sin temporada activa"} />
              <Stat label="Study time" value={hrs(sum(weekEv, "learn"))} sub={`${hrs(sum(evidence, "learn"))} en total`} />
              <Stat label="Practice time" value={hrs(sum(weekEv, "practice"))} sub={`${hrs(sum(evidence, "practice"))} en total`} />
              <Stat label="Skills practiced" value={practiced.size} sub="con evidencia" />
              <Stat label="Projects completed" value={completed} />
              <Stat label="Current project" value={current ? current.title : "—"} />
            </div>
          </Card>

          <Card>
            <CardTitle action={week ? <span className="tabular text-2xl font-semibold">{weekPct}%</span> : null}>Engineering skill of the week</CardTitle>
            {week ? (
              <>
                <p className="text-lg font-semibold">{week.skills?.name}</p>
                <ProgressBar value={weekPct} max={100} tone="success" className="my-3" />
                <div className="grid grid-cols-5 gap-1 text-center text-[11px]">
                  {stepsFor("engineering").map((s) => (
                    <span key={s.id} className={`rounded-lg py-1.5 ${weekDone.has(s.id) ? "bg-success-soft text-success" : "bg-surface-2 text-muted"}`}>
                      {s.label}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">Learn 30 · Practice 30 · Solve 1 · Apply · Review 10. Adáptalo a tu semana.</p>
            )}
            <LinkButton href="/skills/semana?track=engineering" variant={week ? "primary" : "secondary"} className="mt-4 w-full">
              {week ? "Continuar" : "Elegir skill de la semana"}
            </LinkButton>
          </Card>

          <Card>
            <CardTitle hint="Estudio, ejercicio, simulación, troubleshooting… Todo cuenta como evidencia.">Registrar sesión</CardTitle>
            <SessionForm groups={areas.filter((a) => a.key !== "mx-software")} today={ctx.today} />
          </Card>

          <Card>
            <CardTitle hint="Sin porcentaje global: la ingeniería es demasiado amplia. Progreso por áreas.">Knowledge areas</CardTitle>
            <ul className="space-y-2.5">
              {areas
                .filter((a) => a.key !== "mx-software")
                .map((a) => {
                  const started = a.skills.filter((s) => s.level > 0 || practiced.has(s.id)).length;
                  const practicing = a.skills.filter((s) => s.level >= 3).length;
                  return (
                    <li key={a.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate">{a.name}</p>
                        <ProgressBar value={started} max={a.skills.length} className="mt-1" />
                      </div>
                      <span className="tabular text-right text-xs text-muted">
                        {started}/{a.skills.length} iniciadas
                        {practicing ? ` · ${practicing} practicando+` : ""}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </Card>
        </div>
      ) : null}

      {tab === "mapa" ? (
        <div className="space-y-3">
          {areas
            .filter((a) => a.key !== "mx-software")
            .map((a) => {
              const started = a.skills.filter((s) => s.level > 0 || practiced.has(s.id)).length;
              return (
                <details key={a.id} open={started > 0} className="rounded-2xl border border-border bg-surface">
                  <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3.5">
                    <span className="font-semibold">{a.name}</span>
                    <span className="tabular text-sm text-muted">
                      {started}/{a.skills.length}
                    </span>
                  </summary>
                  <ul className="divide-y divide-border border-t border-border">
                    {a.skills.map((s) => (
                      <li key={s.id}>
                        <Link href={`/skills/${s.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-2">
                          <span className="truncate text-[15px]">{s.name}</span>
                          <LevelBar level={s.level} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
        </div>
      ) : null}

      {tab === "lab" ? (
        <div className="space-y-5">
          <p className="px-1 text-sm text-muted">Proyectos progresivos. Cada uno se termina con evidencia (programa, esquema, foto o video) y queda en tu portafolio si lo marcas público.</p>
          {[1, 2, 3, 4].map((lvl) => {
            const list = projects.filter((p) => p.difficulty === lvl);
            if (!list.length) return null;
            return (
              <section key={lvl}>
                <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-faint">{LEVEL_NAMES[lvl]}</p>
                <div className="space-y-2">
                  {list.map((p) => (
                    <Card key={p.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <Link href={`/mecatronica/lab/${p.id}`} className="min-w-0 flex-1">
                          <p className="font-semibold">{p.title}</p>
                          {p.objective ? <p className="text-sm text-muted">{p.objective}</p> : null}
                        </Link>
                        {p.status === "terminado" ? <Badge tone="success">Terminado</Badge> : p.status === "activo" ? <Badge tone="accent">En curso</Badge> : null}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {links
                          .filter((l) => l.project_id === p.id)
                          .map((l) => (
                            <Badge key={l.skill_id}>{skillName.get(l.skill_id) ?? "Skill"}</Badge>
                          ))}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <LabActions id={p.id} status={p.status} />
                        <Link href={`/mecatronica/lab/${p.id}`} className="mt-3 flex items-center text-sm text-accent">
                          Abrir <ChevronRight size={15} />
                        </Link>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
          {projects.length === 0 ? <EmptyState title="Sin proyectos" /> : null}
        </div>
      ) : null}

      {tab === "software" ? (
        <Card>
          <CardTitle hint="No asumimos que usas todos. Activa solo el software que realmente practicas.">Software skills</CardTitle>
          <div className="divide-y divide-border">
            {((software ?? []) as { id: string; name: string; archived: boolean }[]).map((s) => (
              <SoftwareToggle key={s.id} id={s.id} name={s.name} active={!s.archived} />
            ))}
          </div>
        </Card>
      ) : null}
    </>
  );
}
