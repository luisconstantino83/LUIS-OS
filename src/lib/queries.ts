import "server-only";
import type { AppContext } from "./session";
import { addDays, weekDates, type ISODate } from "./dates";
import type {
  ContentItem,
  DailyLog,
  Habit,
  HabitLog,
  Priority,
  WeekTemplateRow,
  WeeklyReview,
  Workout,
} from "./types";
import type { WeekData } from "./progress";

function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Error cargando ${what}: ${res.error.message}`);
  return (res.data ?? ([] as unknown)) as T;
}

export async function getWeekTemplate(ctx: AppContext): Promise<WeekTemplateRow[]> {
  const res = await ctx.supabase.from("week_template").select("*").order("weekday");
  return must(res, "horario");
}

export async function getDailyLog(ctx: AppContext, date: ISODate): Promise<DailyLog | null> {
  const res = await ctx.supabase.from("daily_logs").select("*").eq("log_date", date).maybeSingle<DailyLog>();
  if (res.error) throw new Error("Error cargando registro diario: " + res.error.message);
  return res.data;
}

export async function getDailyLogs(ctx: AppContext, from: ISODate, to: ISODate): Promise<DailyLog[]> {
  const res = await ctx.supabase.from("daily_logs").select("*").gte("log_date", from).lte("log_date", to);
  return must(res, "registros");
}

export async function getHabits(ctx: AppContext, includeArchived = false): Promise<Habit[]> {
  let q = ctx.supabase.from("habits").select("*").order("group_key").order("sort_order").order("created_at");
  if (!includeArchived) q = q.eq("archived", false);
  return must(await q, "hábitos");
}

export async function getHabitLogs(ctx: AppContext, from: ISODate, to: ISODate): Promise<HabitLog[]> {
  const res = await ctx.supabase
    .from("habit_logs")
    .select("habit_id,user_id,log_date")
    .gte("log_date", from)
    .lte("log_date", to);
  return must(res, "registros de hábitos");
}

export async function getPriorities(ctx: AppContext, date: ISODate): Promise<Priority[]> {
  const res = await ctx.supabase.from("priorities").select("*").eq("log_date", date).order("position");
  return must(res, "prioridades");
}

export async function getWorkouts(ctx: AppContext, from: ISODate, to: ISODate): Promise<Workout[]> {
  const res = await ctx.supabase
    .from("workouts")
    .select("*")
    .gte("log_date", from)
    .lte("log_date", to)
    .order("log_date", { ascending: false });
  return must(res, "entrenamientos");
}

export async function getWeekData(ctx: AppContext, start: ISODate): Promise<WeekData> {
  const end = addDays(start, 6);
  const [logs, habits, habitLogs, workouts, contentRes] = await Promise.all([
    getDailyLogs(ctx, start, end),
    getHabits(ctx),
    getHabitLogs(ctx, start, end),
    getWorkouts(ctx, start, end),
    ctx.supabase
      .from("content_items")
      .select("status,published_date,owner")
      .eq("status", "publicado")
      .gte("published_date", start)
      .lte("published_date", end),
  ]);
  const content = must(contentRes, "contenido") as Pick<ContentItem, "status" | "published_date" | "owner">[];
  return { dates: weekDates(start), logs, habits, habitLogs, workouts, content };
}

/** Prioridades de la semana, definidas en el Weekly Reset de la semana anterior. */
export async function getWeeklyFocus(ctx: AppContext, currentWeekStart: ISODate): Promise<string[]> {
  const res = await ctx.supabase
    .from("weekly_reviews")
    .select("top_priorities")
    .eq("week_start", addDays(currentWeekStart, -7))
    .maybeSingle<Pick<WeeklyReview, "top_priorities">>();
  if (res.error) return [];
  return (res.data?.top_priorities ?? []).filter(Boolean);
}
