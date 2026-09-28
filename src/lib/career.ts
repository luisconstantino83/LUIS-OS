import { addDays, type ISODate } from "./dates";

export type StageKey = "servicio" | "titulacion" | "repaso" | "cv" | "linkedin" | "portafolio" | "empleo";

export const STAGES: { key: StageKey; label: string; hint: string; related?: { href: string; label: string } }[] = [
  { key: "servicio", label: "Servicio social", hint: "Horas, reportes y liberación." },
  { key: "titulacion", label: "Titulación", hint: "Modalidad, requisitos y trámites." },
  { key: "repaso", label: "Repaso Mecatrónica", hint: "Recuperar competencia con evidencia.", related: { href: "/mecatronica", label: "Mechatronics Academy" } },
  { key: "cv", label: "CV", hint: "Logros, proyectos y versión en inglés." },
  { key: "linkedin", label: "LinkedIn", hint: "Perfil que refleje lo que sabes hacer." },
  { key: "portafolio", label: "Portafolio", hint: "Proyectos del Lab documentados.", related: { href: "/mecatronica?tab=lab", label: "Lab" } },
  { key: "empleo", label: "Búsqueda de empleo", hint: "Aplicaciones, entrevistas y seguimiento." },
];

export const STAGE_STATUS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_curso", label: "En curso" },
  { value: "completado", label: "Completado" },
] as const;

export const JOB_STATUSES = [
  { value: "guardada", label: "Guardada" },
  { value: "aplicada", label: "Aplicada" },
  { value: "entrevista", label: "Entrevista" },
  { value: "prueba_tecnica", label: "Prueba técnica" },
  { value: "oferta", label: "Oferta" },
  { value: "aceptada", label: "Aceptada" },
  { value: "rechazada", label: "No seleccionado" },
  { value: "descartada", label: "Descartada" },
] as const;

export const INTERVIEW_CATEGORIES = [
  { value: "tecnica", label: "Técnica" },
  { value: "conductual", label: "Conductual" },
  { value: "troubleshooting", label: "Troubleshooting" },
  { value: "ingles", label: "En inglés" },
] as const;

export const DOC_STATUS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_tramite", label: "En trámite" },
  { value: "listo", label: "Listo" },
] as const;

export function stageLabel(key: string) {
  return STAGES.find((s) => s.key === key)?.label ?? key;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Proyección del servicio social. Sin promesas: si no hay ritmo reciente, no hay fecha estimada.
 */
export function serviceProjection(opts: {
  required: number;
  prior: number;
  logs: { log_date: ISODate; hours: number }[];
  today: ISODate;
  targetEnd: ISODate | null;
}) {
  const logged = opts.logs.reduce((s, l) => s + Number(l.hours), 0);
  const done = r1(Number(opts.prior) + logged);
  const remaining = r1(Math.max(0, Number(opts.required) - done));
  const percent = Math.min(100, Math.round((done / Number(opts.required)) * 100));
  const since = addDays(opts.today, -27);
  const last4 = opts.logs.filter((l) => l.log_date >= since && l.log_date <= opts.today).reduce((s, l) => s + Number(l.hours), 0);
  const avgWeekly = r1(last4 / 4);
  const weeksAtPace = avgWeekly > 0 ? Math.ceil(remaining / avgWeekly) : null;
  const estimatedEnd = remaining === 0 ? opts.today : weeksAtPace != null ? addDays(opts.today, weeksAtPace * 7) : null;
  let weeklyNeeded: number | null = null;
  if (opts.targetEnd && remaining > 0) {
    const days = Math.round((Date.parse(opts.targetEnd) - Date.parse(opts.today)) / 86_400_000);
    weeklyNeeded = days > 0 ? r1(remaining / Math.max(1, days / 7)) : remaining;
  }
  return { done, remaining, percent, avgWeekly, estimatedEnd, weeklyNeeded };
}

export function hoursInRange(logs: { log_date: ISODate; hours: number }[], from: ISODate, to: ISODate) {
  return r1(logs.filter((l) => l.log_date >= from && l.log_date <= to).reduce((s, l) => s + Number(l.hours), 0));
}
