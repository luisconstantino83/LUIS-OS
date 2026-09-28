"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { dbError, num, str } from "@/lib/form";
import { addDays, isValidISODate, weekdayOf } from "@/lib/dates";
import type { ActionState } from "@/components/forms";

export async function saveReview(
  weekStartDate: string,
  metrics: Record<string, unknown>,
  _: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const ctx = await getContext();
  if (!isValidISODate(weekStartDate) || weekdayOf(weekStartDate) !== 0 || weekStartDate > ctx.today)
    return { error: "Semana inválida." };
  const priorities = [str(fd, "p1", 140), str(fd, "p2", 140), str(fd, "p3", 140)].filter(Boolean) as string[];
  const rawNext = str(fd, "next_skill_id", 36);
  const nextSkill = rawNext && /^[0-9a-f-]{36}$/i.test(rawNext) ? rawNext : null;
  const { error } = await ctx.supabase.from("weekly_reviews").upsert(
    {
      user_id: ctx.userId,
      week_start: weekStartDate,
      metrics,
      career_progress: str(fd, "career_progress", 2000),
      work_went_well: str(fd, "work_went_well", 2000),
      work_repeated_problem: str(fd, "work_repeated_problem", 2000),
      feeling: str(fd, "feeling", 2000),
      feeling_score: num(fd, "feeling_score", { min: 1, max: 5, int: true }),
      wins: str(fd, "wins", 4000),
      problems: str(fd, "problems", 4000),
      lessons: str(fd, "lessons", 4000),
      next_week: str(fd, "next_week", 4000),
      top_priorities: priorities.slice(0, 3),
      learned_text: str(fd, "learned_text", 4000),
      unexpected_expenses: str(fd, "unexpected_expenses", 2000),
      money_win: str(fd, "money_win", 500),
      money_problem: str(fd, "money_problem", 500),
      next_money_move: str(fd, "next_money_move", 500),
      can_do_now: str(fd, "can_do_now", 2000),
      next_skill_id: nextSkill,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,week_start" },
  );
  if (error) return { error: dbError(error) };
  // La skill elegida se vuelve la Skill of the Week de la semana siguiente.
  if (nextSkill) {
    const { error: e2 } = await ctx.supabase
      .from("skill_weeks")
      .upsert(
        { user_id: ctx.userId, week_start: addDays(weekStartDate, 7), skill_id: nextSkill, track: "general" },
        { onConflict: "user_id,week_start,track" },
      );
    if (e2) return { error: dbError(e2) };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Semana cerrada. Tus 3 prioridades aparecerán en Hoy la próxima semana." };
}
