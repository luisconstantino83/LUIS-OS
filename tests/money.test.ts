import { describe, expect, it } from "vitest";
import {
  autoDistribute,
  cardsCoverage,
  emergencyStatus,
  goalMath,
  goalScenarios,
  isFirstWeekOfMonth,
  msiSchedule,
  netSavings,
  nextDayOfMonth,
  payoffScenario,
  planSummary,
  planningMonth,
  purchaseScenarios,
  utilization,
  weeklyIncome,
} from "@/lib/money";

describe("plan semanal", () => {
  it("ingreso semanal desde movimientos", () => {
    const r = weeklyIncome([
      { kind: "ingreso", category: "salario", amount: 2500 },
      { kind: "ingreso", category: "propinas", amount: 1800 },
      { kind: "ingreso", category: "filmmaking", amount: 700 },
      { kind: "gasto", category: "comida", amount: 300 },
    ]);
    expect(r).toEqual({ fijo: 2500, propinas: 1800, extra: 700, otros: 0, total: 5000 });
  });
  it("ingreso − compromisos − ahorro − metas − gustos = libre", () => {
    const s = planSummary(5000, [
      { category: "tarjetas", planned: 2000, actual: null },
      { category: "casa", planned: 800, actual: null },
      { category: "ahorro", planned: 500, actual: null },
      { category: "viajes", planned: 300, actual: null },
      { category: "gustos", planned: 400, actual: null },
    ]);
    expect(s).toMatchObject({ compromisos: 2800, ahorro: 500, metas: 300, gustos: 400, libre: 1000 });
  });
  it("primera semana del mes", () => {
    expect(isFirstWeekOfMonth("2026-09-27")).toBe(true); // 27 sep – 3 oct contiene el 1 oct
    expect(isFirstWeekOfMonth("2026-10-04")).toBe(false);
    expect(planningMonth("2026-09-27")).toBe("2026-10-01");
  });
  it("reparto automático cubre tarjetas primero", () => {
    const d = autoDistribute(5000, { ahorro: 10, casa: 20 }, 3000, true);
    expect(d.tarjetas).toBe(3000);
    expect(d.ahorro).toBe(200);
    expect(d.casa).toBe(400);
    const d2 = autoDistribute(5000, { ahorro: 10 }, 3000, false);
    expect(d2.tarjetas).toBeUndefined();
    expect(d2.ahorro).toBe(500);
  });
  it("cobertura de tarjetas", () => {
    expect(cardsCoverage(4000, 3000, 1000).isCovered).toBe(true);
    expect(cardsCoverage(4000, 1000, 0)).toMatchObject({ diff: -3000, isCovered: false });
  });
});

describe("tarjetas", () => {
  it("utilización y fechas", () => {
    expect(utilization({ balance: 5000, credit_limit: 20000 })).toBe(25);
    expect(utilization({ balance: 5000, credit_limit: null })).toBeNull();
    expect(nextDayOfMonth(13, "2026-09-26")).toBe("2026-10-13");
    expect(nextDayOfMonth(31, "2026-09-26")).toBe("2026-09-30");
    expect(nextDayOfMonth(5, "2026-12-20")).toBe("2027-01-05");
  });
});

describe("metas", () => {
  it("ejemplo del spec: $12,000, $4,700, 8 semanas → $912.50/semana", () => {
    const m = goalMath(12000, 4700, "2026-11-21", "2026-09-26");
    expect(m.remaining).toBe(7300);
    expect(m.weeksLeft).toBe(8);
    expect(m.weeklyNeeded).toBe(912.5);
  });
  it("escenarios", () => {
    const s = goalScenarios(7300, "2026-09-26", [500, 1000]);
    expect(s[0].weeks).toBe(15);
    expect(s[1].weeks).toBe(8);
  });
  it("préstamos internos no cuentan como ahorro", () => {
    expect(netSavings([
      { kind: "aporte", amount: 1000 },
      { kind: "retiro", amount: 200 },
      { kind: "prestamo_salida", amount: 4000 },
      { kind: "prestamo_regreso", amount: 4000 },
    ])).toBe(800);
  });
});

describe("MSI y deudas", () => {
  it("compromiso futuro y cuándo se libera", () => {
    const s = msiSchedule(
      [
        { id: "a", product: "TV", months: 3, monthly_payment: 1000, start_date: "2026-09-01" },
        { id: "b", product: "Cámara", months: 12, monthly_payment: 500, start_date: "2026-10-01" },
      ],
      "2026-09-26",
      4,
    );
    expect(s.map((x) => x.total)).toEqual([1000, 1500, 1500, 500]);
    expect(s[2].ending).toEqual(["TV"]);
  });
  it("simulador: 13,000 a 12/18/24", () => {
    expect(purchaseScenarios(13000, 0, [12, 18, 24]).map((s) => s.monthly)).toEqual([1083.33, 722.22, 541.67]);
  });
  it("escenario de pago con y sin interés", () => {
    expect(payoffScenario(3000, 1000, null).months).toBe(3);
    const r = payoffScenario(10000, 1000, 24);
    expect(r.months).toBe(12);
    expect(r.interest).toBeGreaterThan(0);
    expect(payoffScenario(10000, 100, 24).feasible).toBe(false);
  });
  it("fondo de emergencia por niveles", () => {
    const e = emergencyStatus(15000, 10000, [1, 3, 6]);
    expect(e.months).toBe(1.5);
    expect(e.levels.map((l) => l.reached)).toEqual([true, false, false]);
  });
});
