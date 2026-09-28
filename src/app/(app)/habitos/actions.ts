"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { dbError, num, oneOf, str } from "@/lib/form";
import type { ActionState } from "@/components/forms";

export async function createHabit(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const name = str(fd, "name", 80);
  if (!name) return { error: "Escribe el nombre del hábito." };
  const group = oneOf(fd.get("group_key"), ["manana", "noche", "general"] as const) ?? "general";
  const days = fd
    .getAll("days")
    .map((d) => Number(d))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  if (days.length === 0) return { error: "Elige al menos un día." };
  const target = group === "general" ? num(fd, "target", { min: 1, max: 7, int: true }) : null;
  const { error } = await ctx.supabase.from("habits").insert({
    user_id: ctx.userId,
    name,
    group_key: group,
    active_days: [...new Set(days)].sort(),
    target_per_week: target,
    sort_order: 50,
  });
  if (error) return { error: dbError(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Hábito agregado." };
}

export async function setHabitArchived(id: string, archived: boolean) {
  const ctx = await getContext();
  const { error } = await ctx.supabase.from("habits").update({ archived }).eq("id", id);
  if (error) return { ok: false as const, error: dbError(error) };
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function updateHabitDays(id: string, days: number[], target: number | null) {
  const ctx = await getContext();
  const clean = [...new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  if (clean.length === 0) return { ok: false as const, error: "Elige al menos un día." };
  const t = target != null && Number.isInteger(target) && target >= 1 && target <= 7 ? target : null;
  const { error } = await ctx.supabase
    .from("habits")
    .update({ active_days: clean, target_per_week: t })
    .eq("id", id);
  if (error) return { ok: false as const, error: dbError(error) };
  revalidatePath("/", "layout");
  return { ok: true as const };
}
