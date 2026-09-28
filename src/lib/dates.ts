/**
 * Manejo de fechas "lógicas".
 * Luis sale de trabajar a la 1:00 am: lo que registre antes de `dayStartHour`
 * cuenta para el día anterior. Todas las fechas son strings ISO (YYYY-MM-DD).
 */

export type ISODate = string;

const WEEKDAYS_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Partes de fecha/hora en una zona horaria IANA. */
export function zonedParts(now: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function toISO(y: number, m: number, d: number): ISODate {
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Parsea YYYY-MM-DD como fecha UTC a medianoche (solo para aritmética de calendario). */
export function parseISO(iso: ISODate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatISO(d: Date): ISODate {
  return toISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return formatISO(d);
}

export function isValidISODate(s: unknown): s is ISODate {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return formatISO(parseISO(s)) === s;
}

/** 0 = domingo … 6 = sábado */
export function weekdayOf(iso: ISODate): number {
  return parseISO(iso).getUTCDay();
}

/** Día lógico actual según zona horaria y hora de inicio del día. */
export function logicalToday(timeZone: string, dayStartHour: number, now: Date = new Date()): ISODate {
  const p = zonedParts(now, timeZone);
  const today = toISO(p.year, p.month, p.day);
  return p.hour < dayStartHour ? addDays(today, -1) : today;
}

/** Hora local actual (0-23) en la zona del usuario. */
export function localHour(timeZone: string, now: Date = new Date()): number {
  return zonedParts(now, timeZone).hour;
}

/** Domingo que inicia la semana de `iso` (semana domingo → sábado). */
export function weekStart(iso: ISODate): ISODate {
  return addDays(iso, -weekdayOf(iso));
}

export function weekDates(start: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function monthStart(iso: ISODate): ISODate {
  return iso.slice(0, 8) + "01";
}

/** Diferencia en meses de calendario (b - a), ignorando el día. */
export function monthDiff(a: ISODate, b: ISODate): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

export function weekdayName(weekday: number): string {
  return WEEKDAYS_ES[weekday];
}

export function formatLong(iso: ISODate): string {
  const d = parseISO(iso);
  const s = `${WEEKDAYS_ES[d.getUTCDay()]} ${d.getUTCDate()} de ${MONTHS_ES[d.getUTCMonth()]}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatShort(iso: ISODate): string {
  const d = parseISO(iso);
  return `${d.getUTCDate()} ${MONTHS_ES[d.getUTCMonth()].slice(0, 3)}`;
}

export function formatMonthYear(iso: ISODate): string {
  const d = parseISO(iso);
  return `${MONTHS_ES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function greeting(hour: number, name: string): string {
  if (hour >= 5 && hour < 12) return `Buenos días, ${name}`;
  if (hour >= 12 && hour < 19) return `Buenas tardes, ${name}`;
  return `Buenas noches, ${name}`;
}

/** Día del año (1-366) para rotar frases. */
export function dayOfYear(iso: ISODate): number {
  const d = parseISO(iso);
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((d.getTime() - start) / 86_400_000) + 1;
}
