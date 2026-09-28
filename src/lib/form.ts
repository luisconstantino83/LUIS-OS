// Utilidades para leer FormData de forma segura en Server Actions.
import { isValidISODate } from "./dates";

export function str(fd: FormData, key: string, max = 5000): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

export function num(fd: FormData, key: string, opts: { min?: number; max?: number; int?: boolean } = {}): number | null {
  const raw = str(fd, key, 50);
  if (raw == null) return null;
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  if (opts.int && !Number.isInteger(n)) return null;
  if (opts.min != null && n < opts.min) return null;
  if (opts.max != null && n > opts.max) return null;
  return n;
}

export function date(fd: FormData, key: string): string | null {
  const v = str(fd, key, 10);
  return v && isValidISODate(v) ? v : null;
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

export function dbError(e: { message?: string } | null | undefined): string {
  const m = e?.message ?? "Error desconocido";
  if (m.includes("priorities_position_check") || m.includes("priorities_user_id_log_date_position_key"))
    return "Solo puedes tener 3 prioridades por día.";
  if (m.includes("top_priorities_check")) return "Máximo 3 prioridades para la semana.";
  if (m.includes("row-level security")) return "No tienes permiso para esa acción.";
  return "No se pudo guardar: " + m;
}
