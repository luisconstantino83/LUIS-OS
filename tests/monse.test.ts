import { describe, expect, it } from "vitest";
import { PRODUCTION_TEMPLATES, lines, pendingPayments, templateByKey } from "@/lib/monse";

describe("Monse", () => {
  it("pagos pendientes solo de campañas aceptadas y no pagadas, por moneda", () => {
    const r = pendingPayments([
      { status: "contactada", payment_amount: 5000, payment_currency: "MXN" },
      { status: "produccion", payment_amount: 3000, payment_currency: "MXN" },
      { status: "aprobada", payment_amount: 200, payment_currency: "USD" },
      { status: "pagada", payment_amount: 9000, payment_currency: "MXN" },
      { status: "enviada", payment_amount: null, payment_currency: "MXN" },
    ]);
    expect(r).toEqual({ MXN: 3000, USD: 200 });
  });
  it("plantilla deportiva cubre antes / durante / después", () => {
    const t = templateByKey("deportiva")!;
    expect(t.tasks.antes.length).toBeGreaterThan(5);
    expect(t.tasks.durante).toContain("BTS y cierre");
    expect(lines(t.storyBeats)).toHaveLength(10);
    expect(PRODUCTION_TEMPLATES.every((p) => p.tasks.despues.length > 0)).toBe(true);
    expect(templateByKey("nope")).toBeNull();
  });
});
