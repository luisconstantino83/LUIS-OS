import { describe, expect, it } from "vitest";
import {
  EMPTY_COUNTS,
  countsBySkill,
  learningStreak,
  maxLevel,
  outputMessage,
  pathProgress,
  projectReadiness,
  requirementsFor,
  weekLearning,
  weekProgress,
} from "@/lib/skills";

const c = (p: Partial<typeof EMPTY_COUNTS>) => ({ ...EMPTY_COUNTS, ...p });

describe("niveles por evidencia (espejo de skill_max_level en SQL)", () => {
  it("ver tutoriales nunca pasa de Fundamentos", () => {
    expect(maxLevel(c({ learn: 50 }))).toBe(1);
  });
  it("progresión", () => {
    expect(maxLevel(EMPTY_COUNTS)).toBe(0);
    expect(maxLevel(c({ learn: 1, practice: 1 }))).toBe(2);
    expect(maxLevel(c({ learn: 1, practice: 3 }))).toBe(2); // sin aplicación real no llega a Practicando
    expect(maxLevel(c({ learn: 1, practice: 3, apply: 1 }))).toBe(3);
    expect(maxLevel(c({ learn: 1, practice: 3, apply: 3 }))).toBe(3); // sin reflexión no llega a Competente
    expect(maxLevel(c({ learn: 1, practice: 3, apply: 3, reflect: 1 }))).toBe(4);
    expect(maxLevel(c({ learn: 1, practice: 3, apply: 6, reflect: 3, practiceMinutes: 599 }))).toBe(4);
    expect(maxLevel(c({ learn: 1, practice: 3, apply: 6, reflect: 3, practiceMinutes: 600 }))).toBe(5);
  });
  it("requisitos del siguiente nivel", () => {
    const r = requirementsFor(3, c({ learn: 1, practice: 2 }));
    expect(r.find((x) => x.label === "prácticas")).toEqual({ label: "prácticas", have: 2, need: 3 });
  });
  it("cuenta evidencia por skill", () => {
    const m = countsBySkill([
      { skill_id: "a", kind: "practice", minutes: 45, occurred_on: "2026-09-20" },
      { skill_id: "a", kind: "practice", minutes: 30, occurred_on: "2026-09-21" },
      { skill_id: "a", kind: "apply", minutes: null, occurred_on: "2026-09-21" },
    ]);
    expect(m.get("a")).toEqual(c({ practice: 2, practiceMinutes: 75, apply: 1 }));
  });
});

describe("semana y racha", () => {
  it("racha termina hoy o ayer", () => {
    expect(learningStreak(["2026-09-24", "2026-09-25", "2026-09-26"], "2026-09-26")).toBe(3);
    expect(learningStreak(["2026-09-24", "2026-09-25"], "2026-09-26")).toBe(2);
    expect(learningStreak(["2026-09-23"], "2026-09-26")).toBe(0);
  });
  it("skill of the week: 25% por paso", () => {
    expect(weekProgress(new Set(["learn", "practice"]))).toBe(50);
    expect(weekProgress(new Set(["learn", "practice", "apply", "reflect"]))).toBe(100);
  });
  it("output > consumo", () => {
    const w = weekLearning([{ skill_id: "a", kind: "learn", minutes: 120, occurred_on: "x" }]);
    expect(outputMessage(w)).toMatch(/Consumiste más/);
    const w2 = weekLearning([{ skill_id: "a", kind: "apply", minutes: null, occurred_on: "x" }]);
    expect(outputMessage(w2)).toMatch(/Output > consumo/);
  });
  it("rutas y proyectos", () => {
    expect(pathProgress([3, 4, 1, 0], 3)).toEqual({ done: 2, total: 4, percent: 50 });
    expect(projectReadiness([2, 2, 2, 0, 0, 0]).recommended).toBe(true);
    expect(projectReadiness([2, 0, 0, 0, 0, 0]).recommended).toBe(false);
  });
});

import { stepsDone, trackProgress } from "@/lib/skills";

describe("engineering skill of the week", () => {
  it("solve cuenta solo con ejercicio; practice no cuenta el ejercicio", () => {
    const ev = [{ kind: "practice" as const, subtype: "exercise" }];
    expect([...stepsDone("engineering", ev)]).toEqual(["solve"]);
    expect(trackProgress("engineering", ev)).toBe(20);
    const ev2 = [...ev, { kind: "practice" as const, subtype: "session" }, { kind: "learn" as const, subtype: null }];
    expect(trackProgress("engineering", ev2)).toBe(60);
    expect(trackProgress("general", [{ kind: "practice" as const, subtype: "exercise" }])).toBe(25);
  });
});
