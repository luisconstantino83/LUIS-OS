"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { date, dbError, oneOf, str } from "@/lib/form";
import type { ActionState } from "@/components/forms";

const LEVELS = ["primary", "secondary", "maintenance", "future"] as const;

export async function createSeason(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const name = str(fd, "name", 60);
  const starts = date(fd, "starts_on");
  const ends = date(fd, "ends_on");
  if (!name || !starts || !ends) return { error: "Completa nombre y fechas." };
  if (ends < starts) return { error: "La fecha final debe ser después del inicio." };
  const { data, error } = await ctx.supabase
    .from("focus_seasons")
    .insert({ user_id: ctx.userId, name, starts_on: starts, ends_on: ends, notes: str(fd, "notes", 1000) })
    .select("id")
    .single();
  if (error || !data) return { error: dbError(error) };
  // Copia los elementos de la temporada anterior para no empezar de cero
  const from = str(fd, "copy_from", 36);
  if (from && /^[0-9a-f-]{36}$/i.test(from)) {
    const { data: items } = await ctx.supabase.from("focus_items").select("label,level,sort_order").eq("season_id", from);
    if (items?.length)
      await ctx.supabase.from("focus_items").insert(items.map((i) => ({ ...i, season_id: data.id, user_id: ctx.userId })));
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Temporada creada." };
}

export async function addFocusItem(seasonId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const label = str(fd, "label", 60);
  const level = oneOf(fd.get("level"), LEVELS) ?? "primary";
  if (!label) return { error: "Escribe el área." };
  const { error } = await ctx.supabase.from("focus_items").insert({ season_id: seasonId, user_id: ctx.userId, label, level, sort_order: 50 });
  if (error) return { error: dbError(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setFocusLevel(id: string, level: string) {
  const ctx = await getContext();
  const l = oneOf(level, LEVELS);
  if (!l) return { ok: false as const, error: "Nivel inválido." };
  const { error } = await ctx.supabase.from("focus_items").update({ level: l }).eq("id", id);
  if (error) return { ok: false as const, error: dbError(error) };
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function deleteFocusItem(id: string) {
  const ctx = await getContext();
  await ctx.supabase.from("focus_items").delete().eq("id", id);
  revalidatePath("/", "layout");
}
