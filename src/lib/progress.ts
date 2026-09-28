/**
 * Cálculo del progreso semanal. Funciones puras (sin acceso a la BD) para poder probarlas.
 * Filosofía: medir consistencia, no "fracaso". Cada métrica se topa en 100 %.
 */
import type { ContentItem, DailyLog, Habit, HabitLog, Profile, Transaction, Workout } from "./types";
import type { ISODate } from "./dates";

/** Un día cuenta como "higiene cumplida" con al menos este número de pasos (de 10). */
export const HYGIENE_DAY_THRESHOLD = 7;

export interface Metric {
  key: string;
  label: string;
  done: number;
  target: number;
  unit?: string;
  /** Métricas de tipo ✓ (una vez por semana) */
  check?: boolean;
}

export interface WeekData {
  dates: ISODate[]; // 7 fechas de la semana (dom → sáb)
  logs: DailyLog[];
  habits: Habit[];
  habitLogs: HabitLog[];
  workouts: Workout[];
  content: Pick<ContentItem, "status" | "published_date" | "owner">[];
}

export function hygieneStepsDone(dayLogs: HabitLog[], hygieneHabitIds: Set<string>): number {
  return dayLogs.filter((l) => hygieneHabitIds.has(l.habit_id)).length;
}

export function isHygieneDay(
  date: ISODate,
  habitLogs: HabitLog[],
  hygieneHabitIds: Set<string>,
  log: DailyLog | undefined,
): boolean {
  if (log?.exhausted && log.basic_hygiene) return true; // en modo agotado, lo básico cuenta
  const steps = hygieneStepsDone(
    habitLogs.filter((l) => l.log_date === date),
    hygieneHabitIds,
  );
  const threshold = Math.min(HYGIENE_DAY_THRESHOLD, hygieneHabitIds.size);
  return hygieneHabitIds.size > 0 && steps >= threshold;
}

export function weeklyMetrics(profile: Profile, w: WeekData): Metric[] {
  const inWeek = new Set(w.dates);
  const logs = w.logs.filter((l) => inWeek.has(l.log_date));
  const logByDate = new Map(logs.map((l) => [l.log_date, l]));
  const habitLogs = w.habitLogs.filter((l) => inWeek.has(l.log_date));

  const hygieneIds = new Set(w.habits.filter((h) => h.group_key !== "general").map((h) => h.id));
  const byKey = new Map(w.habits.filter((h) => h.key).map((h) => [h.key as string, h]));
  const habitCount = (key: string) => {
    const h = byKey.get(key);
    if (!h) return null;
    return { done: habitLogs.filter((l) => l.habit_id === h.id).length, target: h.target_per_week ?? 1, archived: h.archived };
  };

  const sleepNights = logs.filter((l) => l.sleep_hours != null && l.sleep_hours >= profile.sleep_goal_hours).length;
  const workoutDays = new Set(w.workouts.filter((x) => inWeek.has(x.log_date)).map((x) => x.log_date)).size;
  const pages = logs.reduce((s, l) => s + (l.pages_read || 0), 0);
  const meditationDays = logs.filter((l) => l.meditation_min > 0).length;
  const hygieneDays = w.dates.filter((d) => isHygieneDay(d, habitLogs, hygieneIds, logByDate.get(d))).length;
  const published = w.content.filter(
    (c) => c.status === "publicado" && c.published_date && inWeek.has(c.published_date),
  ).length;

  const metrics: Metric[] = [
    { key: "sueno", label: "Sueño", done: sleepNights, target: profile.sleep_nights_target },
    { key: "ejercicio", label: "Ejercicio", done: workoutDays, target: profile.workouts_target },
  ];
  const ingles = habitCount("ingles");
  if (ingles && !ingles.archived) metrics.push({ key: "ingles", label: "Inglés", done: ingles.done, target: ingles.target });
  const film = habitCount("filmmaking");
  if (film && !film.archived) metrics.push({ key: "filmmaking", label: "Filmmaking", done: film.done, target: film.target });
  metrics.push(
    { key: "lectura", label: "Lectura", done: pages, target: profile.pages_week_target, unit: "páginas" },
    { key: "meditacion", label: "Meditación", done: meditationDays, target: profile.meditation_days_target },
    { key: "higiene", label: "Higiene", done: hygieneDays, target: profile.hygiene_days_target },
    { key: "contenido", label: "Contenido", done: published, target: profile.content_week_target },
  );
  const carrera = habitCount("carrera");
  if (carrera && !carrera.archived)
    metrics.push({ key: "carrera", label: "Carrera", done: carrera.done, target: carrera.target, check: carrera.target === 1 });
  const fin = habitCount("finanzas");
  if (fin && !fin.archived)
    metrics.push({ key: "finanzas", label: "Finanzas", done: fin.done, target: fin.target, check: fin.target === 1 });

  return metrics.filter((m) => m.target > 0);
}

export function metricRatio(m: Metric): number {
  if (m.target <= 0) return 1;
  return Math.min(1, m.done / m.target);
}

/** Porcentaje general = promedio de cada métrica topada a 100 %. */
export function overallPercent(metrics: Metric[]): number {
  if (metrics.length === 0) return 0;
  const avg = metrics.reduce((s, m) => s + metricRatio(m), 0) / metrics.length;
  return Math.round(avg * 100);
}

/** Mensaje sin culpa, orientado a consistencia. */
export function consistencyMessage(percent: number, daysElapsed: number): string {
  if (daysElapsed <= 1) return "La semana apenas empieza. Un registro a la vez.";
  if (percent >= 85) return "Semana muy sólida. Mantén el ritmo, no lo subas.";
  if (percent >= 60) return "Buena consistencia. Lo que ya haces está sumando.";
  if (percent >= 35) return "Vas avanzando. Elige una sola cosa para sostener mañana.";
  return "Semanas así también cuentan. Lo mínimo sigue siendo progreso.";
}

export function bestMetric(metrics: Metric[]): Metric | null {
  const withProgress = metrics.filter((m) => m.done > 0);
  if (withProgress.length === 0) return null;
  return withProgress.reduce((a, b) => (metricRatio(b) > metricRatio(a) ? b : a));
}

export interface MoneySummary {
  income: number;
  expenses: number;
  net: number;
  byCategory: Record<string, number>;
}

export function moneySummary(txs: Transaction[]): MoneySummary {
  let income = 0;
  let expenses = 0;
  const byCategory: Record<string, number> = {};
  for (const t of txs) {
    const amt = Number(t.amount);
    if (t.kind === "ingreso") income += amt;
    else {
      expenses += amt;
      byCategory[t.category] = (byCategory[t.category] ?? 0) + amt;
    }
  }
  return { income: round2(income), expenses: round2(expenses), net: round2(income - expenses), byCategory };
}

export function foodSummary(logs: DailyLog[]) {
  const counts = { excelente: 0, buena: 0, regular: 0, mala: 0 };
  for (const l of logs) if (l.food_quality) counts[l.food_quality]++;
  return counts;
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}
