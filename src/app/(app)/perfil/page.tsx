import type { Metadata } from "next";
import Link from "next/link";
import { getContext } from "@/lib/session";
import { LEVELS, countsBySkill, type EvidenceRow } from "@/lib/skills";
import { Badge, Card, CardTitle, PageHeader, Stat } from "@/components/ui";
import type { Language, SkillCategory } from "@/lib/types";

export const metadata: Metadata = { title: "Knowledge Profile" };

const DOMAINS = [
  { key: "engineering", label: "Engineering" },
  { key: "creative", label: "Creative" },
  { key: "languages", label: "Languages" },
  { key: "business", label: "Business" },
  { key: "spiritual", label: "Spiritual" },
] as const;

export default async function KnowledgeProfile() {
  const ctx = await getContext();
  const [{ data: cats }, { data: skills }, { data: ev }, { data: langs }, { data: projects }] = await Promise.all([
    ctx.supabase.from("skill_categories").select("*").order("sort_order"),
    ctx.supabase.from("skills").select("id,name,level,category_id").gt("level", 0).order("level", { ascending: false }),
    ctx.supabase.from("skill_evidence").select("skill_id,kind,minutes,occurred_on"),
    ctx.supabase.from("languages").select("*").order("sort_order"),
    ctx.supabase.from("skill_projects").select("id,status,domain").eq("status", "terminado"),
  ]);
  const categories = (cats ?? []) as SkillCategory[];
  const shown = (skills ?? []) as { id: string; name: string; level: number; category_id: string }[];
  const evidence = (ev ?? []) as EvidenceRow[];
  const counts = countsBySkill(evidence);
  const languages = (langs ?? []) as Language[];
  const applied = evidence.filter((e) => e.kind === "apply").length;
  const practiceH = Math.round(evidence.filter((e) => e.kind === "practice").reduce((s, e) => s + (e.minutes ?? 0), 0) / 6) / 10;

  return (
    <>
      <PageHeader title="Luis Knowledge Profile" subtitle="Solo aparece lo que tiene evidencia. Progreso acumulativo, sin prisa." />
      <div className="space-y-4">
        <Card>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Skills con evidencia" value={shown.length} />
            <Stat label="Aplicaciones reales" value={applied} />
            <Stat label="Horas de práctica" value={practiceH} />
            <Stat label="Proyectos terminados" value={(projects ?? []).length} />
          </div>
        </Card>

        <Card>
          <CardTitle>Languages</CardTitle>
          <ul className="divide-y divide-border">
            {languages.map((l) => (
              <li key={l.id} className="flex items-center justify-between py-2">
                <span>
                  {l.flag} {l.name}
                </span>
                <span className="text-sm text-muted">
                  {l.status === "native" ? "Native" : l.cefr ? <Badge tone="success">{l.cefr}</Badge> : "Sin nivel evaluado"}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        {DOMAINS.map((d) => {
          const dcats = categories.filter((c) => c.domain === d.key);
          const list = shown.filter((s) => dcats.some((c) => c.id === s.category_id));
          return (
            <Card key={d.key}>
              <CardTitle>{d.label}</CardTitle>
              {list.length === 0 ? (
                <p className="text-sm text-muted">Aún sin niveles alcanzados en esta área.</p>
              ) : (
                <div className="space-y-3">
                  {dcats.map((c) => {
                    const cs = list.filter((s) => s.category_id === c.id);
                    if (!cs.length) return null;
                    return (
                      <div key={c.id}>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-faint">{c.name}</p>
                        <ul className="space-y-1">
                          {cs.map((s) => {
                            const k = counts.get(s.id);
                            return (
                              <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                                <Link href={`/skills/${s.id}`} className="truncate hover:underline">
                                  {s.name}
                                </Link>
                                <span className="shrink-0 text-muted">
                                  {LEVELS[s.level].label}
                                  {k ? ` · ${k.apply} aplic.` : ""}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
