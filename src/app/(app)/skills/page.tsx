import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getContext } from "@/lib/session";
import { addDays, weekStart } from "@/lib/dates";
import { getEvidenceRows, getSkillTree, getSkillWeek } from "@/lib/skill-queries";
import {
  LEVELS,
  WEEK_STEPS,
  countsBySkill,
  learningStreak,
  pathProgress,
  projectReadiness,
  weekLearning,
  weekProgress,
  type EvidenceKind,
} from "@/lib/skills";
import { Badge, Card, CardTitle, EmptyState, LinkButton, PageHeader, ProgressBar, Stat, TabLinks } from "@/components/ui";
import type { LearningPath, SkillProject } from "@/lib/types";
import { NewProjectForm, ProjectActions } from "./skills-client";

export const metadata: Metadata = { title: "Skills" };

const TABS = [
  { key: "resumen", label: "Resumen" },
  { key: "arbol", label: "Skill Tree" },
  { key: "rutas", label: "Rutas" },
  { key: "proyectos", label: "Proyectos" },
];

function LevelBar({ level }: { level: number }) {
  return (
    <span className="flex gap-0.5" aria-label={LEVELS[level].label}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-1.5 w-3 rounded-full ${i <= level ? "bg-accent" : "bg-track"}`} />
      ))}
    </span>
  );
}

const hours = (min: number) => (min >= 60 ? `${(min / 60).toFixed(min % 60 ? 1 : 0)} h` : `${min} min`);

export default async function SkillsPage(props: PageProps<"/skills">) {
  const ctx = await getContext();
  const sp = await props.searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as string) : "resumen";
  const ws = weekStart(ctx.today);

  const [groups, evidence, week, pathsRes, stepsRes, projectsRes, projSkillsRes, logRes, reviewRes] = await Promise.all([
    getSkillTree(ctx),
    getEvidenceRows(ctx),
    getSkillWeek(ctx, ws),
    ctx.supabase.from("learning_paths").select("*").order("sort_order"),
    ctx.supabase.from("learning_path_steps").select("path_id,skill_id,position").order("position"),
    ctx.supabase.from("skill_projects").select("*").order("sequence", { nullsFirst: false }).order("created_at"),
    ctx.supabase.from("skill_project_skills").select("project_id,skill_id"),
    ctx.supabase.from("skill_level_log").select("skill_id,from_level,to_level,changed_at").gte("changed_at", ws),
    ctx.supabase
      .from("productions")
      .select("title,review_next_skill_id,reviewed_at")
      .not("reviewed_at", "is", null)
      .order("reviewed_at", { ascending: false })
      .limit(1),
  ]);

  const skillById = new Map(groups.flatMap((g) => g.skills.map((s) => [s.id, { ...s, category: g.name }] as const)));
  const counts = countsBySkill(evidence);
  const weekRows = evidence.filter((e) => e.occurred_on >= ws);
  const wl = weekLearning(weekRows);
  const active = new Set(evidence.filter((e) => e.occurred_on >= addDays(ctx.today, -30)).map((e) => e.skill_id));
  const improved = new Set(((logRes.data ?? []) as { skill_id: string; from_level: number; to_level: number }[]).filter((l) => l.to_level > l.from_level).map((l) => l.skill_id));
  const streak = learningStreak(evidence.map((e) => e.occurred_on), ctx.today);
  const paths = (pathsRes.data ?? []) as LearningPath[];
  const steps = (stepsRes.data ?? []) as { path_id: string; skill_id: string; position: number }[];
  const projects = (projectsRes.data ?? []) as SkillProject[];
  const projSkills = (projSkillsRes.data ?? []) as { project_id: string; skill_id: string }[];
  const completed = projects.filter((p) => p.status === "terminado").length;
  const treeGroups = groups.filter((g) => g.domain !== "engineering");
  const engineeringCount = groups.filter((g) => g.domain === "engineering").reduce((s, g) => s + g.skills.length, 0);

  // Skill of the week
  const weekKinds = new Set<EvidenceKind>(
    week ? weekRows.filter((e) => e.skill_id === week.skill_id).map((e) => e.kind) : [],
  );
  const weekPct = week ? weekProgress(weekKinds) : 0;

  // Proyectos: secuencia + recomendación
  const levelsOf = (pid: string) => projSkills.filter((x) => x.project_id === pid).map((x) => skillById.get(x.skill_id)?.level ?? 0);
  const creative = projects.filter((p) => ((p as SkillProject & { domain?: string }).domain ?? "creative") === "creative");
  const sequenced = creative.filter((p) => p.sequence != null);
  const custom = creative.filter((p) => p.sequence == null);
  const nextInSequence = sequenced.find((p) => p.status !== "terminado");
  const activeProject = projects.find((p) => p.status === "activo");
  const recommended =
    nextInSequence && nextInSequence.status === "sugerido" && projectReadiness(levelsOf(nextInSequence.id)).recommended
      ? nextInSequence
      : null;

  const lastReview = (reviewRes.data ?? [])[0] as { title: string; review_next_skill_id: string | null } | undefined;
  const nextGoal = activeProject
    ? { text: `Terminar el proyecto “${activeProject.title}”`, href: "/skills?tab=proyectos" }
    : week?.objective
      ? { text: week.objective, href: "/skills/semana" }
      : lastReview?.review_next_skill_id && skillById.get(lastReview.review_next_skill_id)
        ? {
            text: `Practicar ${skillById.get(lastReview.review_next_skill_id)!.name} (según la revisión de ${lastReview.title})`,
            href: `/skills/${lastReview.review_next_skill_id}`,
          }
        : recommended
          ? { text: `Empezar “${recommended.title}”`, href: "/skills?tab=proyectos" }
          : null;

  const projectCard = (p: SkillProject, locked: boolean) => {
    const lv = levelsOf(p.id);
    const rd = projectReadiness(lv);
    const names = projSkills.filter((x) => x.project_id === p.id).map((x) => skillById.get(x.skill_id)?.name).filter(Boolean);
    return (
      <Card key={p.id} className={locked ? "opacity-60" : ""}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {p.sequence ? <p className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">Proyecto {p.sequence}</p> : null}
            <p className="font-semibold">{p.title}</p>
            {p.objective ? <p className="mt-0.5 text-sm text-muted">{p.objective}</p> : null}
          </div>
          {p.status === "terminado" ? (
            <Badge tone="success">Terminado</Badge>
          ) : p.status === "activo" ? (
            <Badge tone="accent">En curso</Badge>
          ) : recommended?.id === p.id ? (
            <Badge tone="accent">Recomendado</Badge>
          ) : locked ? (
            <Badge>Después</Badge>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {names.map((n) => (
            <Badge key={n}>{n}</Badge>
          ))}
        </div>
        {p.status === "sugerido" ? (
          <p className="tabular mt-2 text-xs text-muted">
            {rd.ready}/{rd.total} skills en Aprendiendo o más
            {!rd.recommended ? " · se recomienda al llegar a la mitad" : ""}
          </p>
        ) : null}
        {!locked ? <ProjectActions projectId={p.id} status={p.status} productionId={p.production_id} /> : null}
      </Card>
    );
  };

  return (
    <>
      <PageHeader title="Skills" subtitle="Aprender → practicar → crear → publicar → analizar." />
      <TabLinks active={tab} tabs={TABS.map((t) => ({ ...t, href: `/skills?tab=${t.key}` }))} />

      {tab === "resumen" ? (
        <div className="space-y-4">
          <Card>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Stat label="Habilidades activas" value={active.size} sub="últimos 30 días" />
              <Stat label="Práctica esta semana" value={hours(wl.practiceMin)} sub={wl.learnMin ? `+ ${hours(wl.learnMin)} aprendiendo` : undefined} />
              <Stat label="Aplicaciones reales" value={wl.applied} sub="esta semana" />
              <Stat label="Skills mejoradas" value={improved.size} sub="esta semana" />
              <Stat label="Proyectos completados" value={completed} />
              <Stat label="Racha de aprendizaje" value={`${streak} ${streak === 1 ? "día" : "días"}`} />
            </div>
          </Card>

          <Card>
            <CardTitle action={week ? <span className="tabular text-2xl font-semibold">{weekPct}%</span> : null}>Skill of the week</CardTitle>
            {week ? (
              <>
                <p className="text-lg font-semibold">{week.skills?.name}</p>
                {week.objective ? <p className="text-sm text-muted">{week.objective}</p> : null}
                <ProgressBar value={weekPct} max={100} tone="success" className="my-3" />
                <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                  {WEEK_STEPS.map((s) => (
                    <span
                      key={s.kind}
                      className={`rounded-lg py-1.5 ${weekKinds.has(s.kind) ? "bg-success-soft text-success" : "bg-surface-2 text-muted"}`}
                    >
                      {s.label}
                    </span>
                  ))}
                </div>
                <LinkButton href="/skills/semana" className="mt-4 w-full">
                  Continuar
                </LinkButton>
              </>
            ) : (
              <>
                <p className="text-sm text-muted">Una sola skill por semana: aprender 15 min, practicar 30, aplicar y revisar 10.</p>
                <LinkButton href="/skills/semana" className="mt-3" variant="secondary">
                  Elegir skill de la semana
                </LinkButton>
              </>
            )}
          </Card>

          <Card>
            <CardTitle>Próximo objetivo</CardTitle>
            {nextGoal ? (
              <Link href={nextGoal.href} className="flex items-center justify-between gap-3 text-[15px] font-medium hover:underline">
                {nextGoal.text}
                <ChevronRight size={16} className="shrink-0 text-faint" />
              </Link>
            ) : (
              <p className="text-sm text-muted">Elige una skill de la semana o empieza un proyecto.</p>
            )}
          </Card>

          {recommended ? (
            <div>
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-faint">Proyecto recomendado</p>
              {projectCard(recommended, false)}
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "arbol" ? (
        <div className="space-y-3">
          <Link href="/mecatronica?tab=mapa" className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3.5 hover:bg-surface-2">
            <span>
              <span className="block font-semibold">Mechatronics Knowledge Map</span>
              <span className="block text-sm text-muted">{engineeringCount} skills en 23 áreas</span>
            </span>
            <ChevronRight size={16} className="text-faint" />
          </Link>
          {treeGroups.map((g) => {
            const started = g.skills.filter((s) => s.level > 0 || counts.has(s.id)).length;
            return (
              <details key={g.id} open={started > 0} className="rounded-2xl border border-border bg-surface">
                <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3.5">
                  <span className="font-semibold">{g.name}</span>
                  <span className="tabular text-sm text-muted">
                    {started}/{g.skills.length}
                  </span>
                </summary>
                <ul className="divide-y divide-border border-t border-border">
                  {g.skills.map((s) => {
                    const c = counts.get(s.id);
                    return (
                      <li key={s.id}>
                        <Link href={`/skills/${s.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-2">
                          <div className="min-w-0">
                            <p className="truncate text-[15px]">{s.name}</p>
                            <p className="text-xs text-muted">
                              {LEVELS[s.level].label}
                              {c ? ` · ${c.practice} práct. · ${c.apply} aplic.` : ""}
                            </p>
                          </div>
                          <LevelBar level={s.level} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </details>
            );
          })}
        </div>
      ) : null}

      {tab === "rutas" ? (
        <div className="space-y-4">
          {paths.map((p) => {
            const ps = steps.filter((s) => s.path_id === p.id);
            const lv = ps.map((s) => skillById.get(s.skill_id)?.level ?? 0);
            const pr = pathProgress(lv, p.target_level);
            const nextStep = ps.find((s) => (skillById.get(s.skill_id)?.level ?? 0) < p.target_level);
            return (
              <Card key={p.id}>
                <CardTitle action={<span className="tabular text-sm text-muted">{pr.percent}%</span>} hint={p.goal ?? undefined}>
                  {p.title}
                </CardTitle>
                <ProgressBar value={pr.done} max={Math.max(1, pr.total)} tone="success" className="mb-3" />
                <ol className="space-y-1">
                  {ps.map((s, i) => {
                    const sk = skillById.get(s.skill_id);
                    if (!sk) return null;
                    const done = sk.level >= p.target_level;
                    const isNext = nextStep?.skill_id === s.skill_id;
                    return (
                      <li key={s.skill_id}>
                        <Link href={`/skills/${s.skill_id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                          <span className={`text-sm ${done ? "text-muted line-through" : isNext ? "font-semibold" : ""}`}>
                            <span className="tabular mr-2 text-faint">{i + 1}</span>
                            {sk.name}
                            {isNext ? <span className="ml-2 text-xs text-accent">siguiente</span> : null}
                          </span>
                          <LevelBar level={sk.level} />
                        </Link>
                      </li>
                    );
                  })}
                </ol>
                <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
                  {p.practice_project ? (
                    <p>
                      <span className="text-muted">Proyecto práctico: </span>
                      {p.practice_project}
                    </p>
                  ) : null}
                  {p.expected_result ? (
                    <p>
                      <span className="text-muted">Resultado esperado: </span>
                      {p.expected_result}
                    </p>
                  ) : null}
                  <p className="text-xs text-faint">Un paso cuenta cuando la skill llega a {LEVELS[p.target_level].label}.</p>
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}

      {tab === "proyectos" ? (
        <div className="space-y-4">
          <p className="px-1 text-sm text-muted">
            Construye skills y portafolio al mismo tiempo. Cada proyecto se vuelve una producción con checklist y revisión final.
          </p>
          {sequenced.map((p) => {
            const prev = sequenced.filter((x) => (x.sequence ?? 0) < (p.sequence ?? 0));
            const locked = p.status === "sugerido" && prev.some((x) => x.status !== "terminado");
            return projectCard(p, locked);
          })}
          {custom.length ? (
            <>
              <p className="px-1 pt-2 text-xs font-semibold uppercase tracking-[0.08em] text-faint">Proyectos personales</p>
              {custom.map((p) => projectCard(p, false))}
            </>
          ) : null}
          <Card>
            <CardTitle>Nuevo proyecto personal</CardTitle>
            <NewProjectForm groups={groups} />
          </Card>
          {projects.length === 0 ? <EmptyState title="Sin proyectos" /> : null}
        </div>
      ) : null}
    </>
  );
}
