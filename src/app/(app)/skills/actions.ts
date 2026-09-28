"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { addDays, weekStart } from "@/lib/dates";
import { date, num, oneOf, str } from "@/lib/form";
import { templateByKey } from "@/lib/monse";
import { EVIDENCE_SUBTYPES } from "@/lib/skills";
import type { ActionState } from "@/components/forms";
import type { Phase } from "@/lib/types";

const UUID = /^[0-9a-f-]{36}$/i;
const uuidOrNull = (v: string | null) => (v && UUID.test(v) ? v : null);
const KINDS = ["learn", "practice", "apply", "reflect"] as const;

function refresh() {
  revalidatePath("/", "layout");
}

/** Traduce errores de la BD a mensajes claros. */
function skillError(e: { message?: string } | null | undefined): string {
  const m = e?.message ?? "";
  if (m.includes("SKILL_LEVEL")) return "Todavía no hay evidencia suficiente para ese nivel.";
  if (m.includes("SKILL_RESOURCES")) return "Máximo 3 recursos activos por skill. Archiva uno antes de agregar otro.";
  if (m.includes("skill_evidence_check1")) return "La práctica necesita minutos.";
  if (m.includes("skill_evidence_check2")) return "Aplicar necesita prueba: un link, una pieza, una producción o un proyecto.";
  if (m.includes("skill_evidence_check3")) return "Escribe una reflexión de al menos 10 caracteres.";
  if (m.includes("skill_evidence_check")) return "Escribe qué aprendiste (título o nota).";
  if (m.includes("url")) return "El link debe empezar con http:// o https://";
  if (m.includes("duplicate key")) return "Esa evidencia ya estaba registrada.";
  return "No se pudo guardar: " + m;
}

// ---------------------------------------------------------------------------
// Evidencia
// ---------------------------------------------------------------------------
export async function addEvidence(skillId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const subtype = oneOf(fd.get("subtype"), EVIDENCE_SUBTYPES.map((x) => x.value));
  const kind = subtype ? EVIDENCE_SUBTYPES.find((x) => x.value === subtype)!.kind : oneOf(fd.get("kind"), KINDS);
  if (!kind) return { error: "Elige el tipo de evidencia." };
  const d = date(fd, "occurred_on") ?? ctx.today;
  if (d > ctx.today) return { error: "La fecha no puede ser futura." };
  const url = str(fd, "url", 500);
  if (url && !/^https?:\/\//i.test(url)) return { error: "El link debe empezar con http:// o https://" };
  const { error } = await ctx.supabase.from("skill_evidence").insert({
    user_id: ctx.userId,
    skill_id: skillId,
    kind,
    occurred_on: d,
    minutes: num(fd, "minutes", { min: 1, max: 1440, int: true }),
    title: str(fd, "title", 200),
    notes: str(fd, "notes", 5000),
    url,
    content_id: uuidOrNull(str(fd, "content_id", 36)),
    production_id: uuidOrNull(str(fd, "production_id", 36)),
    project_id: uuidOrNull(str(fd, "project_id", 36)),
    subtype,
  });
  if (error) return { error: skillError(error) };
  refresh();
  return { ok: true, message: "Evidencia registrada." };
}

export async function deleteEvidence(id: string) {
  const ctx = await getContext();
  await ctx.supabase.from("skill_evidence").delete().eq("id", id);
  refresh();
}

// ---------------------------------------------------------------------------
// Nivel, notas, objetivo
// ---------------------------------------------------------------------------
export async function setSkillLevel(skillId: string, level: number) {
  const ctx = await getContext();
  if (!Number.isInteger(level) || level < 0 || level > 5) return { ok: false as const, error: "Nivel inválido." };
  const { error } = await ctx.supabase.from("skills").update({ level }).eq("id", skillId);
  if (error) return { ok: false as const, error: skillError(error) };
  refresh();
  return { ok: true as const };
}

export async function updateSkillNotes(skillId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const { error } = await ctx.supabase
    .from("skills")
    .update({ next_goal: str(fd, "next_goal", 300), notes: str(fd, "notes", 10000) })
    .eq("id", skillId);
  if (error) return { error: skillError(error) };
  refresh();
  return { ok: true, message: "Guardado." };
}

// ---------------------------------------------------------------------------
// Recursos (máx. 3 activos)
// ---------------------------------------------------------------------------
export async function addResource(skillId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const title = str(fd, "title", 140);
  const kind = oneOf(fd.get("kind"), ["youtube", "curso", "libro", "articulo", "notas", "ejercicio"] as const);
  if (!title || !kind) return { error: "Escribe el título y elige el tipo." };
  const url = str(fd, "url", 500);
  if (url && !/^https?:\/\//i.test(url)) return { error: "El link debe empezar con http:// o https://" };
  const { error } = await ctx.supabase
    .from("skill_resources")
    .insert({ user_id: ctx.userId, skill_id: skillId, kind, title, url });
  if (error) return { error: skillError(error) };
  refresh();
  return { ok: true };
}

export async function setResourceActive(id: string, active: boolean) {
  const ctx = await getContext();
  const { error } = await ctx.supabase.from("skill_resources").update({ active }).eq("id", id);
  if (error) return { ok: false as const, error: skillError(error) };
  refresh();
  return { ok: true as const };
}

export async function deleteResource(id: string) {
  const ctx = await getContext();
  await ctx.supabase.from("skill_resources").delete().eq("id", id);
  refresh();
}

// ---------------------------------------------------------------------------
// Skill of the Week
// ---------------------------------------------------------------------------
export async function saveSkillWeek(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const skillId = uuidOrNull(str(fd, "skill_id", 36));
  if (!skillId) return { error: "Elige una skill." };
  const which = fd.get("week") === "next" ? "next" : "current";
  const track = fd.get("track") === "engineering" ? "engineering" : "general";
  const ws = which === "next" ? addDays(weekStart(ctx.today), 7) : weekStart(ctx.today);
  const { error } = await ctx.supabase.from("skill_weeks").upsert(
    {
      user_id: ctx.userId,
      week_start: ws,
      track,
      skill_id: skillId,
      objective: str(fd, "objective", 300),
      micro_lesson: str(fd, "micro_lesson", 3000),
      exercise: str(fd, "exercise", 2000),
      apply_to: str(fd, "apply_to", 300),
    },
    { onConflict: "user_id,week_start,track" },
  );
  if (error) return { error: skillError(error) };
  refresh();
  return { ok: true, message: "Skill de la semana guardada." };
}

// ---------------------------------------------------------------------------
// Proyectos
// ---------------------------------------------------------------------------
export async function startProject(projectId: string, owner: "luis" | "monse") {
  const ctx = await getContext();
  const [{ data: project, error: e1 }, { data: links }] = await Promise.all([
    ctx.supabase.from("skill_projects").select("*").eq("id", projectId).single(),
    ctx.supabase.from("skill_project_skills").select("skill_id").eq("project_id", projectId),
  ]);
  if (e1 || !project) throw new Error("Proyecto no encontrado");
  if (project.production_id) redirect(`/monse/producciones/${project.production_id}`);

  const tpl = templateByKey("rapida")!;
  const { data: prod, error: e2 } = await ctx.supabase
    .from("productions")
    .insert({
      user_id: ctx.userId,
      owner: owner === "luis" ? "luis" : "monse",
      title: project.title,
      concept: project.objective,
    })
    .select("id")
    .single();
  if (e2 || !prod) throw new Error(skillError(e2));
  const tasks = (Object.keys(tpl.tasks) as Phase[]).flatMap((phase) =>
    tpl.tasks[phase].map((t, i) => ({ production_id: prod.id, user_id: ctx.userId, phase, title: t, sort_order: i })),
  );
  const skillRows = (links ?? []).map((l) => ({ production_id: prod.id, user_id: ctx.userId, skill_id: l.skill_id }));
  await Promise.all([
    ctx.supabase.from("production_tasks").insert(tasks),
    skillRows.length ? ctx.supabase.from("production_skills").insert(skillRows) : Promise.resolve(),
    ctx.supabase
      .from("skill_projects")
      .update({ status: "activo", production_id: prod.id, started_on: ctx.today })
      .eq("id", projectId),
  ]);
  refresh();
  redirect(`/monse/producciones/${prod.id}`);
}

export async function completeProject(projectId: string) {
  const ctx = await getContext();
  const { data: p } = await ctx.supabase
    .from("skill_projects")
    .select("production_id")
    .eq("id", projectId)
    .single();
  // Evidencia: la producción debe tener revisión post-producción, o el proyecto una aplicación registrada.
  let hasEvidence = false;
  if (p?.production_id) {
    const { data: prod } = await ctx.supabase.from("productions").select("reviewed_at").eq("id", p.production_id).single();
    hasEvidence = !!prod?.reviewed_at;
  }
  if (!hasEvidence) {
    const { count } = await ctx.supabase
      .from("skill_evidence")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("kind", "apply");
    hasEvidence = (count ?? 0) > 0;
  }
  if (!hasEvidence)
    return { ok: false as const, error: "Para terminarlo, completa la revisión post-producción de su producción." };
  const { error } = await ctx.supabase
    .from("skill_projects")
    .update({ status: "terminado", completed_on: ctx.today })
    .eq("id", projectId);
  if (error) return { ok: false as const, error: skillError(error) };
  refresh();
  return { ok: true as const };
}

export async function createProject(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const title = str(fd, "title", 120);
  if (!title) return { error: "Ponle nombre al proyecto." };
  const skills = fd.getAll("skills").filter((s): s is string => typeof s === "string" && UUID.test(s));
  if (skills.length === 0) return { error: "Elige al menos una skill que vas a practicar." };
  const { data, error } = await ctx.supabase
    .from("skill_projects")
    .insert({ user_id: ctx.userId, title, objective: str(fd, "objective", 1000) })
    .select("id")
    .single();
  if (error) return { error: skillError(error) };
  const { error: e2 } = await ctx.supabase
    .from("skill_project_skills")
    .insert([...new Set(skills)].map((s) => ({ project_id: data.id, user_id: ctx.userId, skill_id: s })));
  if (e2) return { error: skillError(e2) };
  refresh();
  return { ok: true, message: "Proyecto creado." };
}

// ---------------------------------------------------------------------------
// Mecatrónica: Lab, sesiones de estudio y software
// ---------------------------------------------------------------------------
export async function startLabProject(projectId: string) {
  const ctx = await getContext();
  const { error } = await ctx.supabase
    .from("skill_projects")
    .update({ status: "activo", started_on: ctx.today })
    .eq("id", projectId)
    .eq("status", "sugerido");
  if (error) return { ok: false as const, error: skillError(error) };
  refresh();
  return { ok: true as const };
}

export async function updateLabProject(projectId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const f = (k: string, max = 10000) => str(fd, k, max);
  const { error } = await ctx.supabase
    .from("skill_projects")
    .update({
      objective: f("objective", 2000),
      problem: f("problem"),
      components: f("components"),
      theory: f("theory"),
      diagram: f("diagram"),
      steps: f("steps"),
      safety: f("safety"),
      code: f("code", 50000),
      results: f("results"),
      lessons: f("lessons"),
      tools: f("tools"),
      visibility: fd.get("visibility") === "public" ? "public" : "private",
    })
    .eq("id", projectId);
  if (error) return { error: skillError(error) };
  refresh();
  return { ok: true, message: "Proyecto guardado." };
}

/** Sesión de estudio / práctica = evidencia (no hay tabla aparte). */
export async function logStudySession(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const skillId = uuidOrNull(str(fd, "skill_id", 36));
  if (!skillId) return { error: "Elige la skill." };
  const subtype = oneOf(fd.get("subtype"), EVIDENCE_SUBTYPES.map((x) => x.value)) ?? "session";
  const kind = EVIDENCE_SUBTYPES.find((x) => x.value === subtype)!.kind;
  const minutes = num(fd, "minutes", { min: 1, max: 1440, int: true });
  const title = str(fd, "title", 200);
  if (kind === "practice" && !minutes) return { error: "Escribe los minutos de práctica." };
  if (kind === "learn" && !title) return { error: "Escribe qué estudiaste." };
  const url = str(fd, "url", 500);
  if (kind === "apply" && !url) return { error: "Para evidencia aplicada agrega un link (o regístrala desde un proyecto del Lab)." };
  const { error } = await ctx.supabase.from("skill_evidence").insert({
    user_id: ctx.userId,
    skill_id: skillId,
    kind,
    subtype,
    minutes,
    title,
    url,
    notes: str(fd, "notes", 5000),
    occurred_on: date(fd, "occurred_on") ?? ctx.today,
  });
  if (error) return { error: skillError(error) };
  refresh();
  return { ok: true, message: "Sesión registrada." };
}

export async function setSkillActive(skillId: string, active: boolean) {
  const ctx = await getContext();
  const { error } = await ctx.supabase.from("skills").update({ archived: !active }).eq("id", skillId);
  if (error) return { ok: false as const, error: skillError(error) };
  refresh();
  return { ok: true as const };
}
