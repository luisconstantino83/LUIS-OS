import "server-only";
import type { AppContext } from "./session";
import type { Skill, SkillCategory, SkillEvidence, SkillWeek } from "./types";
import type { EvidenceRow } from "./skills";

export interface SkillOption {
  id: string;
  name: string;
  category: string;
  level: number;
}

export interface SkillGroup {
  id: string;
  key: string;
  name: string;
  domain: string;
  skills: { id: string; name: string; level: number }[];
}

/** Árbol completo (categorías con sus skills) para selectores. */
export async function getSkillTree(
  ctx: AppContext,
  opts: { exclude?: string[]; only?: string[] } = {},
): Promise<SkillGroup[]> {
  const [{ data: cats, error: e1 }, { data: skills, error: e2 }] = await Promise.all([
    ctx.supabase.from("skill_categories").select("*").order("sort_order"),
    ctx.supabase.from("skills").select("id,category_id,name,level,sort_order").eq("archived", false).order("sort_order"),
  ]);
  if (e1 || e2) throw new Error("Error cargando skills: " + (e1 ?? e2)!.message);
  return ((cats ?? []) as SkillCategory[])
    .filter((c) => (!opts.exclude || !opts.exclude.includes(c.domain)) && (!opts.only || opts.only.includes(c.domain)))
    .map((c) => ({
    id: c.id,
    key: c.key,
    name: c.name,
    domain: c.domain,
    skills: ((skills ?? []) as Pick<Skill, "id" | "category_id" | "name" | "level">[])
      .filter((s) => s.category_id === c.id)
      .map((s) => ({ id: s.id, name: s.name, level: s.level })),
  }));
}

export async function getEvidenceRows(ctx: AppContext, from?: string, to?: string): Promise<EvidenceRow[]> {
  let q = ctx.supabase.from("skill_evidence").select("skill_id,kind,minutes,occurred_on");
  if (from) q = q.gte("occurred_on", from);
  if (to) q = q.lte("occurred_on", to);
  const { data, error } = await q;
  if (error) throw new Error("Error cargando evidencia: " + error.message);
  return (data ?? []) as EvidenceRow[];
}

export async function getSkillWeek(ctx: AppContext, weekStart: string, track: "general" | "engineering" = "general") {
  const { data } = await ctx.supabase
    .from("skill_weeks")
    .select("*, skills(name, level)")
    .eq("week_start", weekStart)
    .eq("track", track)
    .maybeSingle();
  return data as (SkillWeek & { skills: { name: string; level: number } | null }) | null;
}

export async function getWeekEvidenceForSkill(ctx: AppContext, skillId: string, from: string, to: string) {
  const { data } = await ctx.supabase
    .from("skill_evidence")
    .select("*")
    .eq("skill_id", skillId)
    .gte("occurred_on", from)
    .lte("occurred_on", to)
    .order("created_at");
  return (data ?? []) as SkillEvidence[];
}
