import { describe, expect, it } from "vitest";
import { addDays, logicalToday, monthDiff, weekStart, weekdayOf, isValidISODate } from "@/lib/dates";
import { msiRemaining, msiSummary, commitmentLevel } from "@/lib/finance";
import { isDoubleShift, isLightDay } from "@/lib/schedule";
import { overallPercent, weeklyMetrics, isHygieneDay, moneySummary } from "@/lib/progress";
import type { DailyLog, Habit, Profile, WeekTemplateRow } from "@/lib/types";

describe("fechas lógicas", () => {
  it("antes de las 4 am cuenta para el día anterior", () => {
    // 2026-09-27 01:30 en Matamoros (UTC-5) = 06:30 UTC
    expect(logicalToday("America/Matamoros", 4, new Date("2026-09-27T06:30:00Z"))).toBe("2026-09-26");
    expect(logicalToday("America/Matamoros", 4, new Date("2026-09-27T10:00:00Z"))).toBe("2026-09-27");
    expect(logicalToday("America/Matamoros", 0, new Date("2026-09-27T06:30:00Z"))).toBe("2026-09-27");
  });
  it("semana domingo → sábado", () => {
    expect(weekdayOf("2026-09-26")).toBe(6);
    expect(weekStart("2026-09-26")).toBe("2026-09-20");
    expect(weekStart("2026-09-20")).toBe("2026-09-20");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("valida fechas", () => {
    expect(isValidISODate("2026-02-30")).toBe(false);
    expect(isValidISODate("2026-02-28")).toBe(true);
    expect(monthDiff("2026-10-01", "2027-01-15")).toBe(3);
  });
});

describe("horario", () => {
  const row = (s: string | null, e: string | null, t: WeekTemplateRow["day_type"] = "crecimiento"): WeekTemplateRow => ({
    user_id: "u", weekday: 1, day_type: t, work_start: s, work_end: e, workout_focus: null,
  });
  it("detecta doble turno que cruza medianoche", () => {
    expect(isDoubleShift(row("10:00:00", "01:00:00"))).toBe(true);
    expect(isDoubleShift(row("17:00:00", "01:00:00"))).toBe(false);
    expect(isLightDay(row("17:00:00", "01:00:00", "mantenimiento"))).toBe(true);
    expect(isLightDay(row(null, null, "reset"))).toBe(false);
  });
});

describe("MSI", () => {
  const p = { start_date: "2026-09-01", months: 12, monthly_payment: 1000 };
  it("meses restantes", () => {
    expect(msiRemaining(p, "2026-09-26")).toBe(12);
    expect(msiRemaining(p, "2026-10-05")).toBe(11);
    expect(msiRemaining(p, "2027-09-01")).toBe(0);
    expect(msiRemaining({ start_date: "2026-12-01", months: 6 }, "2026-09-26")).toBe(6);
  });
  it("resumen y % del ingreso", () => {
    const s = msiSummary([p, { start_date: "2026-12-01", months: 6, monthly_payment: 500 }], "2026-09-26", 20000);
    expect(s.monthlyCommitted).toBe(1000); // la compra futura aún no pesa este mes
    expect(s.totalRemaining).toBe(12000 + 3000);
    expect(s.percentOfIncome).toBe(5);
    expect(commitmentLevel(35)?.tone).toBe("high");
    expect(msiSummary([p], "2026-09-26", null).percentOfIncome).toBeNull();
  });
});

describe("progreso semanal", () => {
  const profile = {
    sleep_goal_hours: 7, sleep_nights_target: 7, workouts_target: 4, pages_week_target: 50,
    meditation_days_target: 5, hygiene_days_target: 7, content_week_target: 1,
  } as Profile;
  const dates = Array.from({ length: 7 }, (_, i) => addDays("2026-09-20", i));
  const hyg: Habit[] = Array.from({ length: 10 }, (_, i) => ({
    id: "h" + i, user_id: "u", key: "k" + i, name: "x", group_key: i < 6 ? "manana" : "noche",
    active_days: [0, 1, 2, 3, 4, 5, 6], target_per_week: null, sort_order: i, archived: false,
  }));
  const ingles: Habit = { ...hyg[0], id: "en", key: "ingles", group_key: "general", target_per_week: 4 };
  const log = (d: string, p: Partial<DailyLog>): DailyLog => ({
    user_id: "u", log_date: d, sleep_hours: null, water_glasses: 0, food_quality: null, energy: null,
    pages_read: 0, meditation_min: 0, exhausted: false, basic_hygiene: false, ate_decently: false,
    going_to_sleep: false, note: null, ...p,
  });

  it("topa cada métrica en 100% y promedia", () => {
    const m = weeklyMetrics(profile, {
      dates,
      logs: [log(dates[0], { sleep_hours: 8, pages_read: 60, meditation_min: 10 }), log(dates[1], { sleep_hours: 6 })],
      habits: [...hyg, ingles],
      habitLogs: [{ habit_id: "en", user_id: "u", log_date: dates[0] }],
      workouts: [],
      content: [],
    });
    const by = Object.fromEntries(m.map((x) => [x.key, x]));
    expect(by.sueno.done).toBe(1);
    expect(by.lectura.done).toBe(60);
    expect(by.ingles.done).toBe(1);
    expect(by.filmmaking).toBeUndefined();
    const pct = overallPercent(m);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThanOrEqual(100);
  });

  it("higiene: 7 de 10 pasos o modo agotado con higiene básica", () => {
    const ids = new Set(hyg.map((h) => h.id));
    const logs7 = hyg.slice(0, 7).map((h) => ({ habit_id: h.id, user_id: "u", log_date: dates[0] }));
    expect(isHygieneDay(dates[0], logs7, ids, undefined)).toBe(true);
    expect(isHygieneDay(dates[0], logs7.slice(0, 6), ids, undefined)).toBe(false);
    expect(isHygieneDay(dates[1], [], ids, log(dates[1], { exhausted: true, basic_hygiene: true }))).toBe(true);
  });

  it("dinero", () => {
    const s = moneySummary([
      { id: "1", user_id: "u", tx_date: dates[0], kind: "ingreso", category: "propinas", amount: 1500, note: null },
      { id: "2", user_id: "u", tx_date: dates[0], kind: "gasto", category: "comida", amount: 320.5, note: null },
    ]);
    expect(s.net).toBe(1179.5);
    expect(s.byCategory.comida).toBe(320.5);
  });
});
