import { describe, expect, it } from "vitest";
import { hoursInRange, serviceProjection } from "@/lib/career";

describe("serviceProjection", () => {
  const today = "2026-09-26";
  it("sin ritmo no inventa fecha", () => {
    const p = serviceProjection({ required: 480, prior: 100, logs: [], today, targetEnd: null });
    expect(p).toMatchObject({ done: 100, remaining: 380, percent: 21, avgWeekly: 0, estimatedEnd: null, weeklyNeeded: null });
  });
  it("proyecta con el ritmo de las últimas 4 semanas", () => {
    const logs = [
      { log_date: "2026-09-25", hours: 10 },
      { log_date: "2026-09-10", hours: 10 },
      { log_date: "2026-07-01", hours: 20 }, // fuera de la ventana: cuenta al total, no al ritmo
    ];
    const p = serviceProjection({ required: 480, prior: 0, logs, today, targetEnd: "2026-12-26" });
    expect(p.done).toBe(40);
    expect(p.avgWeekly).toBe(5);
    expect(p.estimatedEnd).toBe("2028-06-03"); // 88 semanas
    expect(p.weeklyNeeded).toBeCloseTo(33.8, 1); // 440 h en 13 semanas
  });
  it("completo", () => {
    const p = serviceProjection({ required: 480, prior: 480, logs: [], today, targetEnd: "2026-10-01" });
    expect(p).toMatchObject({ remaining: 0, percent: 100, estimatedEnd: today, weeklyNeeded: null });
  });
  it("hoursInRange", () => {
    expect(hoursInRange([{ log_date: "2026-09-20", hours: 2.5 }, { log_date: "2026-09-27", hours: 3 }], "2026-09-20", "2026-09-26")).toBe(2.5);
  });
});
