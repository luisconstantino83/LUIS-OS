import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext } from "@/lib/session";
import { formatShort } from "@/lib/dates";
import { EVIDENCE_SUBTYPES, LEVELS } from "@/lib/skills";
import { Badge, Card, CardTitle, EmptyState } from "@/components/ui";
import type { LabProject, SkillEvidence } from "@/lib/types";
import { LabActions, LabProjectEditor, ProjectEvidenceForm } from "../../mx-client";

export const metadata: Metadata = { title: "Lab" };

export default async function LabProjectPage(props: PageProps<"/mecatronica/lab/[id]">) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await getContext();
  const [{ data: p }, { data: links }, { data: ev }] = await Promise.all([
    ctx.supabase.from("skill_projects").select("*").eq("id", id).maybeSingle<LabProject>(),
    ctx.supabase.from("skill_project_skills").select("skill_id, skills(name, level)").eq("project_id", id),
    ctx.supabase.from("skill_evidence").select("*, skills(name)").eq("project_id", id).order("created_at", { ascending: false }),
  ]);
  if (!p) notFound();
  const skills = ((links ?? []) as unknown as { skill_id: string; skills: { name: string; level: number } | null }[]).map((l) => ({
    id: l.skill_id,
    name: l.skills?.name ?? "Skill",
    level: l.skills?.level ?? 0,
  }));
  const evidence = (ev ?? []) as (SkillEvidence & { skills: { name: string } | null })[];

  return (
    <>
      <Link href="/mecatronica?tab=lab" className="mb-3 inline-block text-sm text-muted hover:text-fg">
        ← Lab
      </Link>
      <p className="text-sm text-muted">Mechatronics Lab · nivel {p.difficulty}</p>
      <div className="mb-4 flex items-start justify-between gap-3">
        <h1 className="text-[26px] font-semibold tracking-tight">{p.title}</h1>
        {p.status === "terminado" ? <Badge tone="success">Terminado</Badge> : p.status === "activo" ? <Badge tone="accent">En curso</Badge> : <Badge>Sugerido</Badge>}
      </div>
      <div className="space-y-4">
        <Card>
          <CardTitle>Skills</CardTitle>
          <ul className="space-y-1.5">
            {skills.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <Link href={`/skills/${s.id}`} className="hover:underline">
                  {s.name}
                </Link>
                <span className="text-muted">{LEVELS[s.level].label}</span>
              </li>
            ))}
          </ul>
          <LabActions id={p.id} status={p.status} />
        </Card>

        <Card>
          <CardTitle hint="Programa, esquema, foto, video o caso resuelto. Sin evidencia no se puede terminar.">Evidence</CardTitle>
          {evidence.length ? (
            <ul className="mb-4 divide-y divide-border">
              {evidence.map((e) => (
                <li key={e.id} className="py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="success">{EVIDENCE_SUBTYPES.find((x) => x.value === e.subtype)?.label ?? "Aplicación"}</Badge>
                    <span className="text-muted">
                      {e.skills?.name} · {formatShort(e.occurred_on)}
                    </span>
                  </div>
                  {e.title ? <p className="mt-1">{e.title}</p> : null}
                  {e.url ? (
                    <a href={e.url} target="_blank" rel="noreferrer" className="text-accent">
                      Ver evidencia ↗
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="mb-4">
              <EmptyState title="Sin evidencia todavía" />
            </div>
          )}
          <ProjectEvidenceForm projectId={p.id} skills={skills} today={ctx.today} />
        </Card>

        <Card>
          <CardTitle>Proyecto</CardTitle>
          <LabProjectEditor p={p} />
        </Card>
      </div>
    </>
  );
}
