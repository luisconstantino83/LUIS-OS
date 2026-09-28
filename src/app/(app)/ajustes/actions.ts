"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getContext } from "@/lib/session";
import { dbError, num, oneOf, str } from "@/lib/form";
import type { ActionState } from "@/components/forms";

const DAY_TYPES = ["crecimiento", "mantenimiento", "carrera", "creador", "reset"] as const;

export async function saveProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const tz = str(fd, "timezone", 60) ?? ctx.profile.timezone;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
  } catch {
    return { error: "Zona horaria inválida." };
  }
  const n = (k: string, min: number, max: number, int = true) => num(fd, k, { min, max, int });
  const patch = {
    display_name: str(fd, "display_name", 40) ?? "Luis",
    timezone: tz,
    day_start_hour: n("day_start_hour", 0, 8) ?? 4,
    sleep_goal_hours: n("sleep_goal_hours", 4, 12, false) ?? 7,
    water_goal_glasses: n("water_goal_glasses", 1, 20) ?? 8,
    pages_goal_daily: n("pages_goal_daily", 1, 200) ?? 10,
    meditation_goal_min: n("meditation_goal_min", 1, 120) ?? 10,
    sleep_nights_target: n("sleep_nights_target", 0, 7) ?? 7,
    workouts_target: n("workouts_target", 0, 7) ?? 4,
    pages_week_target: n("pages_week_target", 0, 2000) ?? 50,
    meditation_days_target: n("meditation_days_target", 0, 7) ?? 5,
    hygiene_days_target: n("hygiene_days_target", 0, 7) ?? 7,
    content_week_target: n("content_week_target", 0, 50) ?? 1,
  };
  const { error } = await ctx.supabase.from("profiles").update(patch).eq("id", ctx.userId);
  if (error) return { error: dbError(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Ajustes guardados." };
}

export async function saveTemplate(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const rows = [];
  for (let d = 0; d <= 6; d++) {
    const dayType = oneOf(fd.get(`type_${d}`), DAY_TYPES);
    if (!dayType) return { error: "Tipo de día inválido." };
    const off = fd.get(`off_${d}`) === "on";
    const time = (k: string) => {
      const v = str(fd, k, 5);
      return v && /^\d{2}:\d{2}$/.test(v) ? v : null;
    };
    const start = off ? null : time(`start_${d}`);
    const end = off ? null : time(`end_${d}`);
    if ((start == null) !== (end == null)) return { error: "Cada turno necesita hora de entrada y salida." };
    rows.push({
      user_id: ctx.userId,
      weekday: d,
      day_type: dayType,
      work_start: start,
      work_end: end,
      workout_focus: str(fd, `focus_${d}`, 80),
    });
  }
  const { error } = await ctx.supabase.from("week_template").upsert(rows, { onConflict: "user_id,weekday" });
  if (error) return { error: dbError(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Horario guardado." };
}

export async function setTheme(theme: "light" | "dark" | "system") {
  const c = await cookies();
  if (theme === "system") c.delete("theme");
  else c.set("theme", theme, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
