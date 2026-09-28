import type { DayType, WeekTemplateRow } from "./types";

export const DAY_TYPES: Record<
  DayType,
  { label: string; description: string; tone: string }
> = {
  crecimiento: {
    label: "Crecimiento",
    description: "Día con espacio: entrena, estudia y crea antes del turno.",
    tone: "emerald",
  },
  mantenimiento: {
    label: "Mantenimiento",
    description: "Doble turno. Solo lo básico: come, hidrátate, descansa. Es suficiente.",
    tone: "zinc",
  },
  carrera: {
    label: "Carrera",
    description: "Avanza servicio social / titulación antes del turno.",
    tone: "sky",
  },
  creador: {
    label: "Creador",
    description: "Día para grabar, editar o practicar filmmaking.",
    tone: "violet",
  },
  reset: {
    label: "Reset",
    description: "Descanso. Revisa tu semana y prepara la siguiente.",
    tone: "amber",
  },
};

/** "17:00:00" → "17:00" */
export function hhmm(t: string | null): string | null {
  return t ? t.slice(0, 5) : null;
}

export function workLabel(row: WeekTemplateRow | undefined): string {
  if (!row || !row.work_start || !row.work_end) return "Descanso";
  const start = hhmm(row.work_start);
  const end = hhmm(row.work_end);
  const double = isDoubleShift(row);
  return `${double ? "Doble turno" : "Turno"} ${start}–${end}`;
}

/** Turno de más de 10 horas (cruzando medianoche). */
export function isDoubleShift(row: WeekTemplateRow | undefined): boolean {
  if (!row?.work_start || !row.work_end) return false;
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  let dur = toMin(row.work_end) - toMin(row.work_start);
  if (dur <= 0) dur += 24 * 60;
  return dur >= 10 * 60;
}

/** En días de mantenimiento no se muestran actividades de crecimiento. */
export function isLightDay(row: WeekTemplateRow | undefined): boolean {
  return row?.day_type === "mantenimiento" || isDoubleShift(row);
}

export const WORKOUT_SUGGESTIONS: Record<string, string[]> = {
  "Pecho + hombros + tríceps": [
    "Press banca", "Press inclinado mancuernas", "Aperturas", "Press militar",
    "Elevaciones laterales", "Fondos", "Extensión tríceps polea", "Press francés",
  ],
  "Espalda + bíceps": [
    "Dominadas", "Jalón al pecho", "Remo con barra", "Remo con mancuerna",
    "Remo en polea", "Face pull", "Curl con barra", "Curl martillo",
  ],
  Pierna: [
    "Sentadilla", "Prensa", "Peso muerto rumano", "Zancadas",
    "Extensión de cuádriceps", "Curl femoral", "Pantorrilla de pie", "Hip thrust",
  ],
  "Full body / rezagados": [
    "Sentadilla goblet", "Press banca", "Remo con mancuerna", "Press militar",
    "Elevaciones laterales", "Curl bíceps", "Plancha", "Abdominales",
  ],
};
