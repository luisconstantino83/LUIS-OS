"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { bool, date, dbError, num, oneOf, str } from "@/lib/form";
import type { ActionState } from "@/components/forms";

const STAGE = ["servicio", "titulacion", "repaso", "cv", "linkedin", "portafolio", "empleo"] as const;
const JOB = ["guardada", "aplicada", "entrevista", "prueba_tecnica", "oferta", "aceptada", "rechazada", "descartada"] as const;
const UUID = /^[0-9a-f-]{36}$/i;

function refresh() {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Configuración y etapas
// ---------------------------------------------------------------------------
export async function saveCareerSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const { error } = await ctx.supabase.from("career_settings").upsert(
    {
      user_id: ctx.userId,
      required_hours: num(fd, "required_hours", { min: 1, max: 5000 }) ?? 480,
      prior_hours: num(fd, "prior_hours", { min: 0, max: 5000 }) ?? 0,
      institution: str(fd, "institution", 120),
      program: str(fd, "program", 120),
      supervisor: str(fd, "supervisor", 120),
      service_start: date(fd, "service_start"),
      target_end: date(fd, "target_end"),
    },
    { onConflict: "user_id" },
  );
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true, message: "Guardado." };
}

export async function setStageStatus(key: string, status: string) {
  const ctx = await getContext();
  const k = oneOf(key, STAGE);
  const s = oneOf(status, ["pendiente", "en_curso", "completado"] as const);
  if (!k || !s) return { ok: false as const, error: "Dato inválido." };
  const { error } = await ctx.supabase
    .from("career_stages")
    .upsert(
      { user_id: ctx.userId, key: k, status: s, completed_on: s === "completado" ? ctx.today : null },
      { onConflict: "user_id,key" },
    );
  if (error) return { ok: false as const, error: dbError(error) };
  refresh();
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Servicio social: horas (también marca el hábito "carrera" de ese día)
// ---------------------------------------------------------------------------
export async function logServiceHours(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const hours = num(fd, "hours", { min: 0.5, max: 24 });
  const d = date(fd, "log_date") ?? ctx.today;
  if (hours == null) return { error: "Escribe las horas (0.5 a 24)." };
  if (d > ctx.today) return { error: "La fecha no puede ser futura." };
  const { error } = await ctx.supabase.from("service_logs").insert({
    user_id: ctx.userId,
    log_date: d,
    hours,
    activity: str(fd, "activity", 500),
    validated: bool(fd, "validated"),
  });
  if (error) return { error: dbError(error) };
  const { data: habit } = await ctx.supabase.from("habits").select("id").eq("key", "carrera").eq("archived", false).maybeSingle();
  if (habit) {
    await ctx.supabase
      .from("habit_logs")
      .upsert({ habit_id: habit.id, user_id: ctx.userId, log_date: d }, { onConflict: "habit_id,log_date", ignoreDuplicates: true });
  }
  refresh();
  return { ok: true, message: `${hours} h registradas.` };
}

export async function toggleServiceValidated(id: string, validated: boolean) {
  const ctx = await getContext();
  await ctx.supabase.from("service_logs").update({ validated }).eq("id", id);
  refresh();
}

export async function deleteServiceLog(id: string) {
  const ctx = await getContext();
  await ctx.supabase.from("service_logs").delete().eq("id", id);
  refresh();
}

// ---------------------------------------------------------------------------
// Pendientes
// ---------------------------------------------------------------------------
export async function addTask(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const stage = oneOf(fd.get("stage_key"), STAGE);
  const title = str(fd, "title", 160);
  if (!stage || !title) return { error: "Escribe el pendiente." };
  const { error } = await ctx.supabase
    .from("career_tasks")
    .insert({ user_id: ctx.userId, stage_key: stage, title, due_date: date(fd, "due_date"), notes: str(fd, "notes", 1000) });
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true };
}

export async function setTaskDone(id: string, done: boolean) {
  const ctx = await getContext();
  const { error } = await ctx.supabase.from("career_tasks").update({ done }).eq("id", id);
  if (error) return { ok: false as const, error: dbError(error) };
  refresh();
  return { ok: true as const };
}

export async function setTaskDue(id: string, due: string | null) {
  const ctx = await getContext();
  const d = due && /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null;
  await ctx.supabase.from("career_tasks").update({ due_date: d }).eq("id", id);
  refresh();
}

export async function deleteTask(id: string) {
  const ctx = await getContext();
  await ctx.supabase.from("career_tasks").delete().eq("id", id);
  refresh();
}

// ---------------------------------------------------------------------------
// Documentos (archivo privado en Storage)
// ---------------------------------------------------------------------------
export async function addDocument(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const stage = oneOf(fd.get("stage_key"), STAGE);
  const name = str(fd, "name", 120);
  if (!stage || !name) return { error: "Escribe el nombre del documento." };
  const path = str(fd, "file_path", 400);
  if (path && !path.startsWith(ctx.userId + "/")) return { error: "Archivo inválido." };
  const url = str(fd, "url", 500);
  if (url && !/^https?:\/\//i.test(url)) return { error: "El link debe empezar con http:// o https://" };
  const { error } = await ctx.supabase.from("career_documents").insert({
    user_id: ctx.userId,
    stage_key: stage,
    name,
    status: oneOf(fd.get("status"), ["pendiente", "en_tramite", "listo"] as const) ?? (path ? "listo" : "pendiente"),
    due_date: date(fd, "due_date"),
    file_path: path,
    file_name: str(fd, "file_path_name", 200),
    url,
    notes: str(fd, "notes", 1000),
  });
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true, message: "Documento guardado." };
}

export async function setDocumentStatus(id: string, status: string) {
  const ctx = await getContext();
  const s = oneOf(status, ["pendiente", "en_tramite", "listo"] as const);
  if (!s) return;
  await ctx.supabase.from("career_documents").update({ status: s }).eq("id", id);
  refresh();
}

/** Link temporal (60 s) para abrir un archivo privado. */
export async function documentLink(id: string) {
  const ctx = await getContext();
  const { data: doc } = await ctx.supabase.from("career_documents").select("file_path").eq("id", id).single();
  if (!doc?.file_path) return { ok: false as const, error: "Sin archivo." };
  const { data, error } = await ctx.supabase.storage.from("private").createSignedUrl(doc.file_path, 60);
  if (error || !data) return { ok: false as const, error: "No se pudo abrir el archivo." };
  return { ok: true as const, url: data.signedUrl };
}

export async function deleteDocument(id: string) {
  const ctx = await getContext();
  const { data: doc } = await ctx.supabase.from("career_documents").select("file_path").eq("id", id).single();
  if (doc?.file_path) await ctx.supabase.storage.from("private").remove([doc.file_path]);
  await ctx.supabase.from("career_documents").delete().eq("id", id);
  refresh();
}

// ---------------------------------------------------------------------------
// Contactos
// ---------------------------------------------------------------------------
export async function addContact(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const name = str(fd, "name", 100);
  if (!name) return { error: "Escribe el nombre." };
  const email = str(fd, "email", 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "El email no parece válido." };
  const { error } = await ctx.supabase.from("career_contacts").insert({
    user_id: ctx.userId,
    name,
    role: str(fd, "role", 100),
    organization: str(fd, "organization", 120),
    email,
    phone: str(fd, "phone", 40),
    stage_key: oneOf(fd.get("stage_key"), STAGE),
    last_contact: date(fd, "last_contact"),
    notes: str(fd, "notes", 2000),
  });
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true, message: "Contacto guardado." };
}

export async function touchContact(id: string) {
  const ctx = await getContext();
  await ctx.supabase.from("career_contacts").update({ last_contact: ctx.today }).eq("id", id);
  refresh();
}

export async function deleteContact(id: string) {
  const ctx = await getContext();
  await ctx.supabase.from("career_contacts").delete().eq("id", id);
  refresh();
}

// ---------------------------------------------------------------------------
// Empleo
// ---------------------------------------------------------------------------
function jobFields(fd: FormData) {
  return {
    company: str(fd, "company", 100),
    position: str(fd, "position", 120),
    location: str(fd, "location", 100),
    url: str(fd, "url", 500),
    status: oneOf(fd.get("status"), JOB) ?? "guardada",
    applied_on: date(fd, "applied_on"),
    next_step: str(fd, "next_step", 200),
    next_date: date(fd, "next_date"),
    contact: str(fd, "contact", 120),
    salary_range: str(fd, "salary_range", 60),
    language: oneOf(fd.get("language"), ["es", "en", "de", "otro"] as const),
    notes: str(fd, "notes", 3000),
  };
}

export async function saveJob(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const f = jobFields(fd);
  if (!f.company || !f.position) return { error: "Escribe empresa y puesto." };
  if (f.url && !/^https?:\/\//i.test(f.url)) return { error: "El link debe empezar con http:// o https://" };
  if (f.status !== "guardada" && !f.applied_on) f.applied_on = ctx.today;
  const { error } = id
    ? await ctx.supabase.from("job_applications").update(f).eq("id", id)
    : await ctx.supabase.from("job_applications").insert({ ...f, user_id: ctx.userId });
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true, message: id ? "Actualizada." : "Vacante guardada." };
}

export async function deleteJob(id: string) {
  const ctx = await getContext();
  await ctx.supabase.from("job_applications").delete().eq("id", id);
  refresh();
}

// ---------------------------------------------------------------------------
// Interview Lab
// ---------------------------------------------------------------------------
export async function saveQuestion(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const question = str(fd, "question", 500);
  if (!question) return { error: "Escribe la pregunta." };
  const skill = str(fd, "skill_id", 36);
  const row = {
    category: oneOf(fd.get("category"), ["tecnica", "conductual", "troubleshooting", "ingles"] as const) ?? "tecnica",
    question,
    my_answer: str(fd, "my_answer", 5000),
    improved_answer: str(fd, "improved_answer", 5000),
    skill_id: skill && UUID.test(skill) ? skill : null,
    difficulty: num(fd, "difficulty", { min: 1, max: 3, int: true }) ?? 2,
  };
  const { error } = id
    ? await ctx.supabase.from("interview_questions").update(row).eq("id", id)
    : await ctx.supabase.from("interview_questions").insert({ ...row, user_id: ctx.userId });
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true, message: "Guardada." };
}

export async function markPracticed(id: string) {
  const ctx = await getContext();
  const { data } = await ctx.supabase.from("interview_questions").select("practiced_count").eq("id", id).single();
  await ctx.supabase
    .from("interview_questions")
    .update({ practiced_count: Math.min(32000, (data?.practiced_count ?? 0) + 1), last_practiced: ctx.today })
    .eq("id", id);
  refresh();
}

export async function deleteQuestion(id: string) {
  const ctx = await getContext();
  await ctx.supabase.from("interview_questions").delete().eq("id", id);
  refresh();
}
