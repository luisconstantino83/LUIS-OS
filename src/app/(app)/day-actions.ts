"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { addDays, isValidISODate } from "@/lib/dates";
import { dbError } from "@/lib/form";
import type { DailyLog, FoodQuality } from "@/lib/types";

type Result = { ok: true; id?: string } | { ok: false; error: string };

/** Solo se permite registrar desde hace 60 días hasta hoy (día lógico). */
async function validDate(date: string) {
  const ctx = await getContext();
  if (!isValidISODate(date)) throw new Error("Fecha inválida");
  if (date > ctx.today || date < addDays(ctx.today, -60)) throw new Error("Fecha fuera de rango");
  return ctx;
}

function refresh() {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Registro diario
// ---------------------------------------------------------------------------
export type DailyPatch = Partial<
  Pick<
    DailyLog,
    | "sleep_hours"
    | "water_glasses"
    | "food_quality"
    | "energy"
    | "pages_read"
    | "meditation_min"
    | "exhausted"
    | "basic_hygiene"
    | "ate_decently"
    | "going_to_sleep"
  >
>;

const FOOD: FoodQuality[] = ["excelente", "buena", "regular", "mala"];

function sanitizePatch(p: DailyPatch): DailyPatch {
  const out: DailyPatch = {};
  const intIn = (v: unknown, min: number, max: number) =>
    typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
  if ("sleep_hours" in p) {
    const v = p.sleep_hours;
    if (v === null || (typeof v === "number" && v >= 0 && v <= 16)) out.sleep_hours = v === null ? null : Math.round(v * 2) / 2;
  }
  if ("water_glasses" in p && intIn(p.water_glasses, 0, 30)) out.water_glasses = p.water_glasses;
  if ("food_quality" in p && (p.food_quality === null || FOOD.includes(p.food_quality as FoodQuality)))
    out.food_quality = p.food_quality;
  if ("energy" in p && (p.energy === null || intIn(p.energy, 1, 5))) out.energy = p.energy;
  if ("pages_read" in p && intIn(p.pages_read, 0, 1000)) out.pages_read = p.pages_read;
  if ("meditation_min" in p && intIn(p.meditation_min, 0, 600)) out.meditation_min = p.meditation_min;
  for (const k of ["exhausted", "basic_hygiene", "ate_decently", "going_to_sleep"] as const) {
    if (k in p && typeof p[k] === "boolean") out[k] = p[k];
  }
  return out;
}

export async function updateDailyLog(date: string, patch: DailyPatch): Promise<Result> {
  const ctx = await validDate(date);
  const clean = sanitizePatch(patch);
  if (Object.keys(clean).length === 0) return { ok: false, error: "Nada que guardar" };
  const { error } = await ctx.supabase
    .from("daily_logs")
    .upsert({ user_id: ctx.userId, log_date: date, ...clean }, { onConflict: "user_id,log_date" });
  if (error) return { ok: false, error: dbError(error) };
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Hábitos
// ---------------------------------------------------------------------------
export async function setHabitDone(habitId: string, date: string, done: boolean): Promise<Result> {
  const ctx = await validDate(date);
  const q = done
    ? ctx.supabase
        .from("habit_logs")
        .upsert({ habit_id: habitId, user_id: ctx.userId, log_date: date }, { onConflict: "habit_id,log_date" })
    : ctx.supabase.from("habit_logs").delete().eq("habit_id", habitId).eq("log_date", date);
  const { error } = await q;
  if (error) return { ok: false, error: dbError(error) };
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Prioridades (máximo 3, lo impone la BD)
// ---------------------------------------------------------------------------
export async function savePriority(date: string, position: number, title: string): Promise<Result> {
  const ctx = await validDate(date);
  const t = title.trim().slice(0, 140);
  if (![1, 2, 3].includes(position)) return { ok: false, error: "Solo hay 3 lugares para prioridades." };
  if (!t) {
    const { error } = await ctx.supabase.from("priorities").delete().eq("log_date", date).eq("position", position);
    if (error) return { ok: false, error: dbError(error) };
  } else {
    const { data, error } = await ctx.supabase
      .from("priorities")
      .upsert({ user_id: ctx.userId, log_date: date, position, title: t }, { onConflict: "user_id,log_date,position" })
      .select("id")
      .single();
    if (error) return { ok: false, error: dbError(error) };
    refresh();
    return { ok: true, id: data.id as string };
  }
  refresh();
  return { ok: true };
}

export async function setPriorityDone(id: string, done: boolean): Promise<Result> {
  const ctx = await getContext();
  const { error } = await ctx.supabase.from("priorities").update({ done }).eq("id", id);
  if (error) return { ok: false, error: dbError(error) };
  refresh();
  return { ok: true };
}

/** Copia las prioridades no terminadas de ayer a los lugares libres de hoy. */
export async function carryOverPriorities(): Promise<
  { ok: true; rows?: { id: string; position: number; title: string }[] } | { ok: false; error: string }
> {
  const ctx = await getContext();
  const yesterday = addDays(ctx.today, -1);
  const [{ data: prev, error: e1 }, { data: cur, error: e2 }] = await Promise.all([
    ctx.supabase.from("priorities").select("title,done,position").eq("log_date", yesterday).order("position"),
    ctx.supabase.from("priorities").select("position").eq("log_date", ctx.today),
  ]);
  if (e1 || e2) return { ok: false, error: dbError(e1 ?? e2) };
  const taken = new Set((cur ?? []).map((p) => p.position));
  const free = [1, 2, 3].filter((p) => !taken.has(p));
  const pending = (prev ?? []).filter((p) => !p.done).slice(0, free.length);
  if (pending.length === 0) return { ok: true };
  const rows = pending.map((p, i) => ({ user_id: ctx.userId, log_date: ctx.today, position: free[i], title: p.title }));
  const { data, error } = await ctx.supabase.from("priorities").insert(rows).select("id,position,title");
  if (error) return { ok: false, error: dbError(error) };
  refresh();
  return { ok: true, rows: (data ?? []) as { id: string; position: number; title: string }[] };
}
