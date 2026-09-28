/**
 * Skills: niveles basados en evidencia.
 * Las reglas de nivel son ESPEJO de public.skill_max_level() en 0003_skills.sql.
 * La base de datos es la autoridad; esto solo explica en pantalla qué falta.
 */
import { addDays, type ISODate } from "./dates";

export const LEVELS = [
  { value: 0, label: "No iniciado", short: "—" },
  { value: 1, label: "Fundamentos", short: "Fund." },
  { value: 2, label: "Aprendiendo", short: "Aprend." },
  { value: 3, label: "Practicando", short: "Práct." },
  { value: 4, label: "Competente", short: "Comp." },
  { value: 5, label: "Avanzado", short: "Avanz." },
] as const;

export type EvidenceKind = "learn" | "practice" | "apply" | "reflect";

export const EVIDENCE_KINDS: { value: EvidenceKind; label: string; verb: string; hint: string }[] = [
  { value: "learn", label: "Aprender", verb: "Aprendí", hint: "Tutorial, curso, notas. Solo cuenta como consumo." },
  { value: "practice", label: "Practicar", verb: "Practiqué", hint: "Sesión con minutos: ejercicios, pruebas de cámara, edición de práctica." },
  { value: "apply", label: "Aplicar", verb: "Apliqué", hint: "En algo real: pieza, producción, proyecto o link." },
  { value: "reflect", label: "Reflexión", verb: "Reflexioné", hint: "Qué funcionó y qué mejorar." },
];

export interface EvidenceCounts {
  learn: number;
  practice: number;
  practiceMinutes: number;
  apply: number;
  reflect: number;
}

export const EMPTY_COUNTS: EvidenceCounts = { learn: 0, practice: 0, practiceMinutes: 0, apply: 0, reflect: 0 };

interface Req {
  label: string;
  have: number;
  need: number;
}

/** Requisitos para alcanzar cada nivel. */
export function requirementsFor(level: number, c: EvidenceCounts): Req[] {
  const r = (label: string, have: number, need: number): Req => ({ label, have, need });
  switch (level) {
    case 1:
      return [r("aprender", c.learn, 1)];
    case 2:
      return [r("aprender", c.learn, 1), r("práctica", c.practice, 1)];
    case 3:
      return [r("aprender", c.learn, 1), r("prácticas", c.practice, 3), r("aplicación real", c.apply, 1)];
    case 4:
      return [
        r("aprender", c.learn, 1),
        r("prácticas", c.practice, 3),
        r("aplicaciones reales", c.apply, 3),
        r("reflexión", c.reflect, 1),
      ];
    case 5:
      return [
        r("aprender", c.learn, 1),
        r("prácticas", c.practice, 3),
        r("aplicaciones reales", c.apply, 6),
        r("reflexiones", c.reflect, 3),
        r("min de práctica", c.practiceMinutes, 600),
      ];
    default:
      return [];
  }
}

export function maxLevel(c: EvidenceCounts): number {
  for (let l = 5; l >= 1; l--) {
    if (requirementsFor(l, c).every((x) => x.have >= x.need)) return l;
  }
  return 0;
}

export function levelLabel(level: number) {
  return LEVELS[Math.max(0, Math.min(5, level))].label;
}

export interface EvidenceRow {
  skill_id: string;
  kind: EvidenceKind;
  minutes: number | null;
  occurred_on: string;
}

export function countsBySkill(rows: EvidenceRow[]): Map<string, EvidenceCounts> {
  const m = new Map<string, EvidenceCounts>();
  for (const e of rows) {
    const c = m.get(e.skill_id) ?? { ...EMPTY_COUNTS };
    if (e.kind === "learn") c.learn++;
    else if (e.kind === "practice") {
      c.practice++;
      c.practiceMinutes += e.minutes ?? 0;
    } else if (e.kind === "apply") c.apply++;
    else c.reflect++;
    m.set(e.skill_id, c);
  }
  return m;
}

/** Días seguidos con cualquier evidencia, terminando hoy (o ayer, si hoy aún no registras). */
export function learningStreak(dates: ISODate[], today: ISODate): number {
  const set = new Set(dates);
  let d = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** Resumen semanal: prioriza OUTPUT (aplicar) sobre CONSUMO (aprender). */
export function weekLearning(rows: EvidenceRow[]) {
  let learnMin = 0;
  let practiceMin = 0;
  let applied = 0;
  let reflections = 0;
  const skills = new Set<string>();
  for (const e of rows) {
    skills.add(e.skill_id);
    if (e.kind === "learn") learnMin += e.minutes ?? 0;
    else if (e.kind === "practice") practiceMin += e.minutes ?? 0;
    else if (e.kind === "apply") applied++;
    else reflections++;
  }
  return { learnMin, practiceMin, applied, reflections, skillIds: [...skills] };
}

export function outputMessage(w: ReturnType<typeof weekLearning>): string {
  if (w.applied === 0 && w.practiceMin === 0 && w.learnMin === 0) return "Sin registros de aprendizaje esta semana. Empieza con 15 minutos.";
  if (w.applied === 0 && w.learnMin > w.practiceMin)
    return "Consumiste más de lo que produjiste. La próxima semana, aplica algo pequeño y publícalo.";
  if (w.applied === 0) return "Practicaste. El siguiente paso es aplicarlo en una pieza real.";
  if (w.applied >= 3) return "Mucho output esta semana. Así se construye el portafolio.";
  return "Aplicaste lo que practicas. Output > consumo.";
}

export type WeekTrack = "general" | "engineering";

export interface WeekStep {
  id: string;
  kind: EvidenceKind;
  subtype?: string;
  label: string;
  minutes: number | null;
  hint?: string;
}

/** Skill of the Week: general (aprender → practicar → aplicar → revisar). */
export const WEEK_STEPS: WeekStep[] = [
  { id: "learn", kind: "learn", label: "Aprender", minutes: 15 },
  { id: "practice", kind: "practice", label: "Practicar", minutes: 30 },
  { id: "apply", kind: "apply", label: "Aplicar", minutes: null },
  { id: "reflect", kind: "reflect", label: "Revisar", minutes: 10 },
];

/** Engineering Skill of the Week: learn → practice → solve → apply → review. */
export const ENGINEERING_STEPS: WeekStep[] = [
  { id: "learn", kind: "learn", label: "Learn", minutes: 30 },
  { id: "practice", kind: "practice", label: "Practice", minutes: 30 },
  { id: "solve", kind: "practice", subtype: "exercise", label: "Solve", minutes: null, hint: "Resuelve 1 ejercicio (circuito, cálculo, programa)." },
  { id: "apply", kind: "apply", label: "Apply", minutes: null, hint: "Mini proyecto o caso real, con evidencia." },
  { id: "reflect", kind: "reflect", label: "Review", minutes: 10 },
];

export function stepsFor(track: WeekTrack) {
  return track === "engineering" ? ENGINEERING_STEPS : WEEK_STEPS;
}

/** Qué pasos están cumplidos según la evidencia de la semana para esa skill. */
export function stepsDone(track: WeekTrack, evidence: { kind: EvidenceKind; subtype?: string | null }[]): Set<string> {
  const done = new Set<string>();
  const steps = stepsFor(track);
  const practiceNonExercise = evidence.some((e) => e.kind === "practice" && e.subtype !== "exercise");
  for (const st of steps) {
    if (st.subtype) {
      if (evidence.some((e) => e.kind === st.kind && e.subtype === st.subtype)) done.add(st.id);
    } else if (st.id === "practice" && track === "engineering") {
      if (practiceNonExercise) done.add(st.id);
    } else if (evidence.some((e) => e.kind === st.kind)) done.add(st.id);
  }
  return done;
}

export function trackProgress(track: WeekTrack, evidence: { kind: EvidenceKind; subtype?: string | null }[]): number {
  const steps = stepsFor(track);
  return Math.round((stepsDone(track, evidence).size / steps.length) * 100);
}

/** Compatibilidad: progreso general a partir de tipos cumplidos. */
export function weekProgress(kindsDone: Set<EvidenceKind>): number {
  return Math.round((WEEK_STEPS.filter((s) => kindsDone.has(s.kind)).length / WEEK_STEPS.length) * 100);
}

/** Tipos de evidencia de competencia (el nivel depende del "kind" al que pertenecen). */
export const EVIDENCE_SUBTYPES: { value: string; label: string; kind: EvidenceKind }[] = [
  { value: "theory", label: "Teoría estudiada", kind: "learn" },
  { value: "reading", label: "Lectura técnica", kind: "learn" },
  { value: "note", label: "Notas", kind: "learn" },
  { value: "session", label: "Sesión de práctica", kind: "practice" },
  { value: "exercise", label: "Ejercicio resuelto", kind: "practice" },
  { value: "simulation", label: "Simulación", kind: "practice" },
  { value: "project", label: "Proyecto", kind: "apply" },
  { value: "troubleshooting", label: "Caso de troubleshooting", kind: "apply" },
  { value: "code", label: "Código", kind: "apply" },
  { value: "schematic", label: "Esquema / diagrama", kind: "apply" },
  { value: "photo", label: "Foto", kind: "apply" },
  { value: "video", label: "Video", kind: "apply" },
  { value: "document", label: "Documento", kind: "apply" },
];

export const RESOURCE_KINDS = [
  { value: "youtube", label: "YouTube" },
  { value: "curso", label: "Curso" },
  { value: "libro", label: "Libro" },
  { value: "articulo", label: "Artículo" },
  { value: "notas", label: "Notas" },
  { value: "ejercicio", label: "Ejercicio" },
] as const;

export const MAX_ACTIVE_RESOURCES = 3;

/** Un proyecto se recomienda cuando la mitad de sus skills ya está en Aprendiendo o más. */
export function projectReadiness(levels: number[]) {
  const ready = levels.filter((l) => l >= 2).length;
  return { ready, total: levels.length, recommended: levels.length > 0 && ready >= Math.ceil(levels.length / 2) };
}

/** Progreso de una ruta: pasos que alcanzaron el nivel objetivo. */
export function pathProgress(levels: number[], target: number) {
  const done = levels.filter((l) => l >= target).length;
  return { done, total: levels.length, percent: levels.length ? Math.round((done / levels.length) * 100) : 0 };
}
