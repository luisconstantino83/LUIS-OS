import type { CampaignStatus, ContentFormat, Phase, ProductionStatus } from "./types";

export const CAMPAIGN_STATUSES: { value: CampaignStatus; label: string }[] = [
  { value: "contactada", label: "Contactada" },
  { value: "negociacion", label: "Negociación" },
  { value: "aceptada", label: "Aceptada" },
  { value: "produccion", label: "Producción" },
  { value: "enviada", label: "Enviada" },
  { value: "aprobada", label: "Aprobada" },
  { value: "publicada", label: "Publicada" },
  { value: "pagada", label: "Pagada" },
];

export const PRODUCTION_STATUSES: { value: ProductionStatus; label: string }[] = [
  { value: "planeacion", label: "Planeación" },
  { value: "grabacion", label: "Grabación" },
  { value: "postproduccion", label: "Postproducción" },
  { value: "terminada", label: "Terminada" },
];

export const PHASES: { value: Phase; label: string; hint: string }[] = [
  { value: "antes", label: "Antes", hint: "Investigar → concepto → referencias → guion → hooks → shot list → equipo" },
  { value: "durante", label: "Durante", hint: "Fotos, B-roll, momentos espontáneos, vertical/horizontal, audio, BTS" },
  { value: "despues", label: "Después", hint: "Selección → edición → color → sonido → piezas → métricas" },
];

export const FORMATS: { value: ContentFormat; label: string }[] = [
  { value: "reel", label: "Reel" },
  { value: "tiktok", label: "TikTok" },
  { value: "short", label: "Short" },
  { value: "carrusel", label: "Carrusel" },
  { value: "foto", label: "Fotografía" },
  { value: "stories", label: "Stories" },
  { value: "video", label: "Video" },
  { value: "vlog", label: "Vlog" },
  { value: "mini_doc", label: "Mini documental" },
];

/** Tu rol en la pieza (para el portafolio). */
export const ROLES = [
  "Filmmaker",
  "Director",
  "Camarógrafo",
  "Fotógrafo",
  "Editor",
  "Colorista",
  "Sound designer",
  "Guionista",
  "Estratega de contenido",
  "Social media manager",
];

export interface ProductionTemplate {
  key: string;
  label: string;
  description: string;
  tasks: Record<Phase, string[]>;
  storyBeats?: string;
  plannedOutputs?: string;
  gear?: string;
}

export const PRODUCTION_TEMPLATES: ProductionTemplate[] = [
  {
    key: "deportiva",
    label: "Producción deportiva completa",
    description: "Para torneos y eventos grandes (ej. Federado en León).",
    tasks: {
      antes: [
        "Investigar el evento: sede, horarios, reglas para grabar",
        "Definir concepto e historia",
        "Buscar 3–5 referencias",
        "Escribir hooks",
        "Guion / estructura",
        "Shot list",
        "Checklist de equipo: baterías, memorias, micrófono",
        "Confirmar acceso / acreditación",
      ],
      durante: [
        "Llegada / viaje",
        "Preparación y uniforme",
        "Calentamiento",
        "Fotos clave",
        "B-roll y detalles",
        "Momentos espontáneos",
        "Tomas verticales",
        "Tomas horizontales (cuando convenga)",
        "Audio limpio y ambiente",
        "Público",
        "Resultado y emociones",
        "BTS y cierre",
      ],
      despues: [
        "Respaldar el material",
        "Selección",
        "Edición",
        "Color",
        "Sound design",
        "Reel / TikTok",
        "Carrusel",
        "Stories",
        "Mini documental 60–90 s",
        "Publicar",
        "Registrar métricas a los 7 días",
        "Elegir piezas para portafolio",
      ],
    },
    storyBeats:
      "Llegada / viaje\nPreparación\nUniforme\nCalentamiento\nPartido\nEmociones\nDetalles\nPúblico\nResultado\nCierre",
    plannedOutputs: "Vlog\nReels / TikToks\nFotografías\nStories\nMini documental 60–90 s",
    gear: "Cámara\nLente\nBaterías (x3)\nMemorias\nMicrófono\nCargador\nGimbal / tripié",
  },
  {
    key: "rapida",
    label: "Sesión rápida",
    description: "Entrenamiento, contenido del día o una colaboración chica.",
    tasks: {
      antes: ["Concepto y hook", "Shot list corta", "Equipo listo"],
      durante: ["Tomas verticales", "Fotos", "BTS"],
      despues: ["Selección", "Edición", "Publicar", "Registrar métricas"],
    },
  },
  {
    key: "campana",
    label: "Entregable de campaña",
    description: "Contenido para una marca con brief y aprobación.",
    tasks: {
      antes: ["Leer el brief completo", "Confirmar entregables y fechas", "Concepto y guion", "Enviar propuesta si aplica", "Shot list", "Equipo listo"],
      durante: ["Tomas del producto / marca", "Tomas verticales", "Audio limpio", "Fotos", "BTS"],
      despues: ["Edición", "Color y sonido", "Revisar contra el brief", "Enviar para aprobación", "Ajustes", "Publicar con menciones correctas", "Enviar métricas a la marca", "Registrar pago"],
    },
  },
];

export function templateByKey(key: string | null | undefined) {
  return PRODUCTION_TEMPLATES.find((t) => t.key === key) ?? null;
}

export function labelOf<T extends string>(list: { value: T; label: string }[], v: string | null | undefined) {
  return list.find((x) => x.value === v)?.label ?? v ?? "";
}

const ACTIVE: CampaignStatus[] = ["aceptada", "produccion", "enviada", "aprobada", "publicada"];
export function isActiveCampaign(s: CampaignStatus) {
  return ACTIVE.includes(s);
}

/** Pagos pendientes por moneda: campañas con monto que aún no están pagadas (desde "aceptada"). */
export function pendingPayments(
  campaigns: { status: CampaignStatus; payment_amount: number | null; payment_currency: string }[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of campaigns) {
    if (c.payment_amount == null || c.status === "pagada" || !isActiveCampaign(c.status)) continue;
    out[c.payment_currency] = (out[c.payment_currency] ?? 0) + Number(c.payment_amount);
  }
  return out;
}

export function lines(s: string | null | undefined): string[] {
  return (s ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}
