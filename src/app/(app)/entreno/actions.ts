"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { addDays } from "@/lib/dates";
import { date, dbError, num, str } from "@/lib/form";
import type { ActionState } from "@/components/forms";

export async function createWorkout(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const focus = str(fd, "focus", 80);
  const d = date(fd, "log_date") ?? ctx.today;
  if (!focus) return { error: "Elige qué entrenaste." };
  if (d > ctx.today || d < addDays(ctx.today, -60)) return { error: "La fecha debe ser de los últimos 60 días." };
  const { data, error } = await ctx.supabase
    .from("workouts")
    .insert({
      user_id: ctx.userId,
      log_date: d,
      focus,
      duration_min: num(fd, "duration_min", { min: 1, max: 600, int: true }),
      notes: str(fd, "notes", 2000),
    })
    .select("id")
    .single();
  if (error) return { error: dbError(error) };
  revalidatePath("/", "layout");
  redirect(`/entreno/${data.id}`);
}

export async function addSet(workoutId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const exercise = str(fd, "exercise", 80);
  if (!exercise) return { error: "Escribe el ejercicio." };
  const reps = num(fd, "reps", { min: 0, max: 1000, int: true });
  const weight = num(fd, "weight_kg", { min: 0, max: 1000 });
  if (reps == null && weight == null) return { error: "Agrega repeticiones o peso." };
  const { count } = await ctx.supabase
    .from("workout_sets")
    .select("id", { count: "exact", head: true })
    .eq("workout_id", workoutId)
    .ilike("exercise", exercise.replace(/[%_\\]/g, (m) => "\\" + m));
  const { error } = await ctx.supabase.from("workout_sets").insert({
    workout_id: workoutId,
    user_id: ctx.userId,
    exercise,
    set_number: Math.min(50, (count ?? 0) + 1),
    reps,
    weight_kg: weight,
    notes: str(fd, "notes", 500),
  });
  if (error) return { error: dbError(error) };
  revalidatePath(`/entreno/${workoutId}`);
  revalidatePath("/entreno");
  return { ok: true };
}

export async function deleteSet(id: string, workoutId: string) {
  const ctx = await getContext();
  await ctx.supabase.from("workout_sets").delete().eq("id", id);
  revalidatePath(`/entreno/${workoutId}`);
}

export async function updateWorkoutNotes(workoutId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const { error } = await ctx.supabase
    .from("workouts")
    .update({
      notes: str(fd, "notes", 2000),
      duration_min: num(fd, "duration_min", { min: 1, max: 600, int: true }),
    })
    .eq("id", workoutId);
  if (error) return { error: dbError(error) };
  revalidatePath(`/entreno/${workoutId}`);
  return { ok: true, message: "Guardado." };
}

export async function deleteWorkout(id: string) {
  const ctx = await getContext();
  const { error } = await ctx.supabase.from("workouts").delete().eq("id", id);
  if (error) throw new Error(dbError(error));
  revalidatePath("/", "layout");
  redirect("/entreno");
}
