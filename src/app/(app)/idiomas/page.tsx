import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getContext } from "@/lib/session";
import { weekStart } from "@/lib/dates";
import { LEVELS } from "@/lib/skills";
import { Badge, Card, CardTitle, PageHeader } from "@/components/ui";
import type { Language } from "@/lib/types";
import { LanguageForm } from "./language-form";
import { LANGUAGE_STATUS_LABEL as STATUS_LABEL } from "@/lib/labels";

export const metadata: Metadata = { title: "Idiomas" };

const TONE: Record<string, "accent" | "success" | "neutral" | "warn"> = {
  native: "neutral",
  primary: "accent",
  secondary: "success",
  maintenance: "neutral",
  paused: "warn",
  future: "neutral",
};

export default async function LanguagesPage() {
  const ctx = await getContext();
  const ws = weekStart(ctx.today);
  const [{ data: langs }, { data: skills }, { data: ev }, { data: paths }] = await Promise.all([
    ctx.supabase.from("languages").select("*").order("sort_order"),
    ctx.supabase.from("skills").select("id,name,level,category_id").eq("archived", false).order("sort_order"),
    ctx.supabase.from("skill_evidence").select("skill_id,minutes,kind").gte("occurred_on", ws),
    ctx.supabase.from("learning_paths").select("id,key,title").in("key", ["ingles", "english-mechatronics", "german-academy", "german-engineering"]),
  ]);
  const languages = (langs ?? []) as Language[];
  const allSkills = (skills ?? []) as { id: string; name: string; level: number; category_id: string }[];
  const weekEv = (ev ?? []) as { skill_id: string; minutes: number | null; kind: string }[];
  const active = languages.filter((l) => ["primary", "secondary", "maintenance"].includes(l.status));

  return (
    <>
      <PageHeader title="Idiomas" subtitle="Un idioma principal a la vez. Los demás esperan sin presión." />
      <div className="space-y-4">
        <Card>
          <CardTitle hint="Solo Primary y Secondary piden práctica frecuente. Future no aparece en tu día.">Perfil de idiomas</CardTitle>
          <ul className="divide-y divide-border">
            {languages.map((l) => {
              const ids = new Set(allSkills.filter((s) => s.category_id === l.category_id).map((s) => s.id));
              const mins = weekEv.filter((e) => ids.has(e.skill_id)).reduce((s, e) => s + (e.minutes ?? 0), 0);
              return (
                <li key={l.id} className="py-3">
                  <details>
                    <summary className="flex cursor-pointer items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <span className="text-xl">{l.flag}</span>
                        <span className="font-medium">{l.name}</span>
                        {l.cefr ? <Badge tone="success">{l.cefr}</Badge> : null}
                      </span>
                      <span className="flex items-center gap-2">
                        {mins ? <span className="tabular text-xs text-muted">{mins} min esta semana</span> : null}
                        <Badge tone={TONE[l.status]}>{STATUS_LABEL[l.status]}</Badge>
                      </span>
                    </summary>
                    <div className="mt-3 space-y-3">
                      {l.cefr_evidence ? <p className="text-sm text-muted">Evidencia del nivel: {l.cefr_evidence}</p> : null}
                      <LanguageForm lang={l} />
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </Card>

        {active.map((l) => {
          const list = allSkills.filter((s) => s.category_id === l.category_id);
          if (!list.length) return null;
          return (
            <Card key={l.id}>
              <CardTitle hint="Cada habilidad sube con evidencia, no con horas.">
                {l.flag} {l.name} · {STATUS_LABEL[l.status]}
              </CardTitle>
              <ul className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                {list.map((s) => (
                  <li key={s.id}>
                    <Link href={`/skills/${s.id}`} className="flex items-center justify-between gap-2 py-1.5 text-sm hover:underline">
                      <span className="truncate">{s.name}</span>
                      <span className="text-xs text-muted">{LEVELS[s.level].label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}

        <Card>
          <CardTitle>Rutas</CardTitle>
          <ul className="divide-y divide-border">
            {((paths ?? []) as { id: string; key: string; title: string }[]).map((p) => (
              <li key={p.id}>
                <Link href="/skills?tab=rutas" className="flex items-center justify-between py-2.5 text-[15px]">
                  {p.title}
                  <ChevronRight size={15} className="text-faint" />
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Próximamente (Fase 2): Vocabulary Bank con repetición espaciada y vocabulario técnico DE / EN / ES.
          </p>
        </Card>
      </div>
    </>
  );
}
