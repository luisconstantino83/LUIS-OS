"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { date, dbError, num, oneOf, str } from "@/lib/form";
import { templateByKey } from "@/lib/monse";
import type { ActionState } from "@/components/forms";
import type { Phase } from "@/lib/types";

const CAMPAIGN_STATUS = [
  "contactada",
  "negociacion",
  "aceptada",
  "produccion",
  "enviada",
  "aprobada",
  "publicada",
  "pagada",
] as const;
const PROD_STATUS = ["planeacion", "grabacion", "postproduccion", "terminada"] as const;
const PHASE = ["antes", "durante", "despues"] as const;
const OWNER = ["luis", "monse"] as const;
const PLATFORM = ["youtube", "instagram", "tiktok"] as const;
const FORMAT = ["reel", "tiktok", "short", "carrusel", "foto", "stories", "video", "vlog", "mini_doc"] as const;
const UUID = /^[0-9a-f-]{36}$/i;

function refresh() {
  revalidatePath("/", "layout");
}
const uuidOrNull = (v: string | null) => (v && UUID.test(v) ? v : null);

// ---------------------------------------------------------------------------
// Campañas
// ---------------------------------------------------------------------------
export async function createCampaign(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const brand = str(fd, "brand", 80);
  if (!brand) return { error: "Escribe la marca." };
  const { data, error } = await ctx.supabase
    .from("campaigns")
    .insert({
      user_id: ctx.userId,
      brand,
      program: str(fd, "program", 80),
      deadline: date(fd, "deadline"),
      status: oneOf(fd.get("status"), CAMPAIGN_STATUS) ?? "contactada",
    })
    .select("id")
    .single();
  if (error) return { error: dbError(error) };
  refresh();
  redirect(`/monse/campanas/${data.id}`);
}

export async function updateCampaign(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const brand = str(fd, "brand", 80);
  if (!brand) return { error: "La marca no puede ir vacía." };
  const email = str(fd, "contact_email", 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "El email no parece válido." };
  const status = oneOf(fd.get("status"), CAMPAIGN_STATUS) ?? "contactada";
  let paidAt = date(fd, "paid_at");
  if (status === "pagada" && !paidAt) paidAt = ctx.today;
  const { error } = await ctx.supabase
    .from("campaigns")
    .update({
      brand,
      program: str(fd, "program", 80),
      contact_name: str(fd, "contact_name", 120),
      contact_email: email,
      brief: str(fd, "brief", 10000),
      deliverables: str(fd, "deliverables", 5000),
      deadline: date(fd, "deadline"),
      payment_amount: num(fd, "payment_amount", { min: 0, max: 100_000_000 }),
      payment_currency: oneOf(fd.get("payment_currency"), ["MXN", "USD", "EUR"] as const) ?? "MXN",
      paid_at: paidAt,
      status,
      links: str(fd, "links", 5000),
      notes: str(fd, "notes", 10000),
    })
    .eq("id", id);
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true, message: "Campaña guardada." };
}

export async function deleteCampaign(id: string) {
  const ctx = await getContext();
  await ctx.supabase.from("campaigns").delete().eq("id", id);
  refresh();
  redirect("/monse?tab=campanas");
}

// ---------------------------------------------------------------------------
// Producciones
// ---------------------------------------------------------------------------
export async function createProduction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const title = str(fd, "title", 120);
  if (!title) return { error: "Ponle nombre a la producción." };
  const tpl = templateByKey(str(fd, "template", 20));
  const { data, error } = await ctx.supabase
    .from("productions")
    .insert({
      user_id: ctx.userId,
      title,
      owner: oneOf(fd.get("owner"), OWNER) ?? "monse",
      event_date: date(fd, "event_date"),
      location: str(fd, "location", 120),
      campaign_id: uuidOrNull(str(fd, "campaign_id", 36)),
      story_beats: tpl?.storyBeats ?? null,
      planned_outputs: tpl?.plannedOutputs ?? null,
      gear: tpl?.gear ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: dbError(error) };
  const skillIds = [...new Set(fd.getAll("skills").filter((x): x is string => typeof x === "string" && UUID.test(x)))];
  if (skillIds.length) {
    const { error: es } = await ctx.supabase
      .from("production_skills")
      .insert(skillIds.map((skill_id) => ({ production_id: data.id, user_id: ctx.userId, skill_id })));
    if (es) return { error: dbError(es) };
  }
  if (tpl) {
    const rows = (Object.keys(tpl.tasks) as Phase[]).flatMap((phase) =>
      tpl.tasks[phase].map((t, i) => ({
        production_id: data.id,
        user_id: ctx.userId,
        phase,
        title: t,
        sort_order: i,
      })),
    );
    const { error: e2 } = await ctx.supabase.from("production_tasks").insert(rows);
    if (e2) return { error: dbError(e2) };
  }
  refresh();
  redirect(`/monse/producciones/${data.id}`);
}

export async function updateProduction(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const title = str(fd, "title", 120);
  if (!title) return { error: "El nombre no puede ir vacío." };
  const { error } = await ctx.supabase
    .from("productions")
    .update({
      title,
      owner: oneOf(fd.get("owner"), OWNER) ?? "monse",
      event_date: date(fd, "event_date"),
      location: str(fd, "location", 120),
      status: oneOf(fd.get("status"), PROD_STATUS) ?? "planeacion",
      campaign_id: uuidOrNull(str(fd, "campaign_id", 36)),
      concept: str(fd, "concept", 5000),
      story_beats: str(fd, "story_beats", 5000),
      refs: str(fd, "refs", 5000),
      hooks: str(fd, "hooks", 5000),
      shot_list: str(fd, "shot_list", 10000),
      gear: str(fd, "gear", 3000),
      planned_outputs: str(fd, "planned_outputs", 3000),
    })
    .eq("id", id);
  if (error) return { error: dbError(error) };
  const skillErr = await replaceProductionSkills(ctx, id, fd.getAll("skills"));
  if (skillErr) return { error: skillErr };
  refresh();
  return { ok: true, message: "Producción guardada." };
}

async function replaceProductionSkills(
  ctx: Awaited<ReturnType<typeof getContext>>,
  productionId: string,
  raw: FormDataEntryValue[],
): Promise<string | null> {
  const ids = [...new Set(raw.filter((x): x is string => typeof x === "string" && UUID.test(x)))];
  const { error: e1 } = await ctx.supabase.from("production_skills").delete().eq("production_id", productionId);
  if (e1) return dbError(e1);
  if (!ids.length) return null;
  const { error: e2 } = await ctx.supabase
    .from("production_skills")
    .insert(ids.map((skill_id) => ({ production_id: productionId, user_id: ctx.userId, skill_id })));
  return e2 ? dbError(e2) : null;
}

/**
 * Revisión post-producción. Guarda la reflexión y convierte las skills practicadas
 * en evidencia: una aplicación real (la producción) + una reflexión por skill.
 */
export async function saveProductionReview(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const learned = str(fd, "learnings", 5000);
  const failed = str(fd, "review_failed", 5000);
  const missing = str(fd, "review_missing_shot", 5000);
  const repeat = str(fd, "review_repeat", 5000);
  const differently = str(fd, "review_differently", 5000);
  const nextSkill = uuidOrNull(str(fd, "review_next_skill_id", 36));
  const practiced = [...new Set(fd.getAll("practiced").filter((x): x is string => typeof x === "string" && UUID.test(x)))];
  if (!learned && !failed && !differently) return { error: "Responde al menos qué aprendiste, qué falló o qué harías diferente." };

  const { data: prod, error: e0 } = await ctx.supabase
    .from("productions")
    .select("title,event_date")
    .eq("id", id)
    .single();
  if (e0 || !prod) return { error: dbError(e0) };

  const { error } = await ctx.supabase
    .from("productions")
    .update({
      learnings: learned,
      review_failed: failed,
      review_missing_shot: missing,
      review_repeat: repeat,
      review_differently: differently,
      review_next_skill_id: nextSkill,
      reviewed_at: new Date().toISOString(),
      status: "terminada",
    })
    .eq("id", id);
  if (error) return { error: dbError(error) };

  const skillErr = await replaceProductionSkills(ctx, id, practiced);
  if (skillErr) return { error: skillErr };

  if (practiced.length) {
    const { data: project } = await ctx.supabase.from("skill_projects").select("id").eq("production_id", id).maybeSingle();
    const occurred = prod.event_date && prod.event_date <= ctx.today ? prod.event_date : ctx.today;
    const reflection = [
      learned && `Aprendí: ${learned}`,
      failed && `Falló: ${failed}`,
      missing && `Toma que faltó: ${missing}`,
      repeat && `Repetiría: ${repeat}`,
      differently && `Haría diferente: ${differently}`,
    ]
      .filter(Boolean)
      .join("\n");
    const base = { user_id: ctx.userId, production_id: id, project_id: project?.id ?? null, occurred_on: occurred };
    const { error: ea } = await ctx.supabase.from("skill_evidence").upsert(
      practiced.map((skill_id) => ({ ...base, skill_id, kind: "apply", title: prod.title })),
      { onConflict: "skill_id,kind,production_id", ignoreDuplicates: true },
    );
    if (ea) return { error: dbError(ea) };
    if (reflection.length >= 10) {
      const { error: er } = await ctx.supabase.from("skill_evidence").upsert(
        practiced.map((skill_id) => ({ ...base, skill_id, kind: "reflect", title: `Revisión: ${prod.title}`, notes: reflection })),
        { onConflict: "skill_id,kind,production_id" },
      );
      if (er) return { error: dbError(er) };
    }
  }
  refresh();
  return {
    ok: true,
    message: practiced.length
      ? `Revisión guardada. Se registró evidencia en ${practiced.length} skill${practiced.length > 1 ? "s" : ""}.`
      : "Revisión guardada.",
  };
}

export async function deleteProduction(id: string) {
  const ctx = await getContext();
  await ctx.supabase.from("productions").delete().eq("id", id);
  refresh();
  redirect("/monse?tab=producciones");
}

export async function setTaskDone(taskId: string, done: boolean) {
  const ctx = await getContext();
  const { error } = await ctx.supabase.from("production_tasks").update({ done }).eq("id", taskId);
  if (error) return { ok: false as const, error: dbError(error) };
  refresh();
  return { ok: true as const };
}

export async function addTask(productionId: string, phase: string, title: string) {
  const ctx = await getContext();
  const p = oneOf(phase, PHASE);
  const t = title.trim().slice(0, 120);
  if (!p || !t) return { ok: false as const, error: "Escribe la tarea." };
  const { data, error } = await ctx.supabase
    .from("production_tasks")
    .insert({ production_id: productionId, user_id: ctx.userId, phase: p, title: t, sort_order: 100 })
    .select("id")
    .single();
  if (error) return { ok: false as const, error: dbError(error) };
  refresh();
  return { ok: true as const, id: data.id as string };
}

export async function deleteTask(taskId: string) {
  const ctx = await getContext();
  const { error } = await ctx.supabase.from("production_tasks").delete().eq("id", taskId);
  if (error) return { ok: false as const, error: dbError(error) };
  refresh();
  return { ok: true as const };
}

/** Crea una pieza de contenido ligada a la producción (y su campaña, si tiene). */
export async function addProductionPiece(productionId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const title = str(fd, "title", 140);
  const platform = oneOf(fd.get("platform"), PLATFORM);
  if (!title || !platform) return { error: "Escribe el título y elige plataforma." };
  const { data: prod, error: e1 } = await ctx.supabase
    .from("productions")
    .select("owner,campaign_id")
    .eq("id", productionId)
    .single();
  if (e1 || !prod) return { error: dbError(e1) };
  const { error } = await ctx.supabase.from("content_items").insert({
    user_id: ctx.userId,
    title,
    platform,
    format: oneOf(fd.get("format"), FORMAT),
    owner: prod.owner,
    production_id: productionId,
    campaign_id: prod.campaign_id,
  });
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true, message: "Pieza agregada." };
}

// ---------------------------------------------------------------------------
// Hitos
// ---------------------------------------------------------------------------
export async function setMilestoneDone(id: string, done: boolean) {
  const ctx = await getContext();
  const { error } = await ctx.supabase.from("milestones").update({ done }).eq("id", id);
  if (error) return { ok: false as const, error: dbError(error) };
  refresh();
  return { ok: true as const };
}
