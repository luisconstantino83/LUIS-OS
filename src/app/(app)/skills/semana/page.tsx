import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { getContext } from "@/lib/session";
import { addDays, formatShort, weekStart } from "@/lib/dates";
import { getSkillTree, getSkillWeek, getWeekEvidenceForSkill } from "@/lib/skill-queries";
import { EVIDENCE_KINDS, LEVELS, stepsDone, stepsFor, trackProgress, type WeekTrack } from "@/lib/skills";
import { Card, CardTitle, PageHeader, ProgressBar } from "@/components/ui";
import { EvidenceForm, SkillWeekForm } from "../skills-client";

export const metadata: Metadata = { title: "Skill of the week" };

export default async function SkillWeekPage(props: PageProps<"/skills/semana">) {
  const ctx = await getContext();
  const sp = await props.searchParams;
  const track: WeekTrack = sp.track === "engineering" ? "engineering" : "general";
  const ws = weekStart(ctx.today);
  const [allGroups, week, next, { data: contents }, { data: prods }, { data: projects }] = await Promise.all([
    getSkillTree(ctx),
    getSkillWeek(ctx, ws, track),
    getSkillWeek(ctx, addDays(ws, 7), track),
    ctx.supabase.from("content_items").select("id,title").order("updated_at", { ascending: false }).limit(50),
    ctx.supabase.from("productions").select("id,title").order("created_at", { ascending: false }).limit(50),
    ctx.supabase.from("skill_projects").select("id,title").neq("status", "terminado"),
  ]);
  const evidence = week ? await getWeekEvidenceForSkill(ctx, week.skill_id, ws, addDays(ws, 6)) : [];
  const groups = track === "engineering" ? allGroups.filter((g) => g.domain === "engineering") : allGroups.filter((g) => g.domain !== "engineering");
  const done = stepsDone(track, evidence);
  const pct = trackProgress(track, evidence);
  const steps = stepsFor(track);
  const opt = (rows: unknown) => ((rows ?? []) as { id: string; title: string }[]).map((r) => ({ id: r.id, label: r.title }));

  return (
    <>
      <Link href={track === "engineering" ? "/mecatronica" : "/skills"} className="mb-3 inline-block text-sm text-muted hover:text-fg">
        ← {track === "engineering" ? "Mecatrónica" : "Skills"}
      </Link>
      <PageHeader title={track === "engineering" ? "Engineering skill of the week" : "Skill of the week"} subtitle={`Semana del ${formatShort(ws)} al ${formatShort(addDays(ws, 6))}`} />
      <div className="space-y-4">
        {week ? (
          <>
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/skills/${week.skill_id}`} className="text-xl font-semibold hover:underline">
                    {week.skills?.name}
                  </Link>
                  <p className="text-sm text-muted">Nivel actual: {LEVELS[week.skills?.level ?? 0].label}</p>
                </div>
                <p className="tabular text-2xl font-semibold">{pct}%</p>
              </div>
              <ProgressBar value={pct} max={100} tone="success" className="mt-3" />
              <dl className="mt-4 space-y-2 text-sm">
                {week.objective ? (
                  <div>
                    <dt className="text-muted">Objetivo</dt>
                    <dd>{week.objective}</dd>
                  </div>
                ) : null}
                {week.micro_lesson ? (
                  <div>
                    <dt className="text-muted">Microlección</dt>
                    <dd className="whitespace-pre-line">{week.micro_lesson}</dd>
                  </div>
                ) : null}
                {week.exercise ? (
                  <div>
                    <dt className="text-muted">Ejercicio</dt>
                    <dd className="whitespace-pre-line">{week.exercise}</dd>
                  </div>
                ) : null}
                {week.apply_to ? (
                  <div>
                    <dt className="text-muted">Dónde aplicarlo</dt>
                    <dd>{week.apply_to}</dd>
                  </div>
                ) : null}
              </dl>
            </Card>

            {steps.map((step, i) => {
              const isDone = done.has(step.id);
              const meta = EVIDENCE_KINDS.find((k) => k.value === step.kind)!;
              const items = evidence.filter((e) =>
                step.subtype ? e.subtype === step.subtype : e.kind === step.kind && !(track === "engineering" && step.id === "practice" && e.subtype === "exercise"),
              );
              return (
                <Card key={step.kind}>
                  <div className="flex items-center gap-3">
                    <span
                      className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${isDone ? "bg-success text-bg" : "bg-surface-2 text-muted"}`}
                    >
                      {isDone ? <Check size={16} strokeWidth={3} /> : i + 1}
                    </span>
                    <div>
                      <p className="font-semibold">
                        {step.label}
                        {step.minutes ? <span className="font-normal text-muted"> · {step.minutes} min</span> : null}
                      </p>
                      <p className="text-[13px] text-muted">{step.hint ?? meta.hint}</p>
                    </div>
                  </div>
                  {items.length ? (
                    <ul className="mt-3 space-y-1 text-sm">
                      {items.map((e) => (
                        <li key={e.id} className="text-muted">
                          ✓ {e.title ?? e.notes?.slice(0, 80)}
                          {e.minutes ? ` · ${e.minutes} min` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {!isDone ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-medium text-accent">Registrar</summary>
                      <div className="mt-3">
                        <EvidenceForm
                          skillId={week.skill_id}
                          today={ctx.today}
                          contents={opt(contents)}
                          productions={opt(prods)}
                          projects={opt(projects)}
                          defaultKind={step.kind}
                          lockKind
                          compact
                          defaultMinutes={step.minutes}
                          subtype={step.subtype}
                        />
                      </div>
                    </details>
                  ) : null}
                </Card>
              );
            })}

            <details className="rounded-2xl border border-border bg-surface p-4">
              <summary className="cursor-pointer text-sm font-medium">Editar la skill de esta semana</summary>
              <div className="mt-3">
                <SkillWeekForm groups={groups} week="current" current={week} track={track} />
              </div>
            </details>
          </>
        ) : (
          <Card>
            <CardTitle
              hint={
                track === "engineering"
                  ? "Learn 30 min → practice 30 → solve 1 exercise → apply mini project → review 10."
                  : "Una sola skill. Aprender 15 min → practicar 30 → aplicar → revisar 10."
              }
            >
              Elige la skill de esta semana
            </CardTitle>
            <SkillWeekForm groups={groups} week="current" current={null} track={track} />
          </Card>
        )}

        <Card>
          <CardTitle hint="También se define al cerrar tu Weekly Reset.">Próxima semana</CardTitle>
          {next ? <p className="mb-3 text-[15px] font-medium">{next.skills?.name}</p> : null}
          <details>
            <summary className="cursor-pointer text-sm font-medium text-accent">{next ? "Cambiar" : "Planear ahora"}</summary>
            <div className="mt-3">
              <SkillWeekForm groups={groups} week="next" current={next} track={track} />
            </div>
          </details>
        </Card>
      </div>
    </>
  );
}
