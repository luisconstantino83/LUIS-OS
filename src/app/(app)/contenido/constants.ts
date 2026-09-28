import type { ContentOwner, ContentStatus, Platform } from "@/lib/types";

export const STATUSES: { value: ContentStatus; label: string }[] = [
  { value: "idea", label: "Idea" },
  { value: "guion", label: "Guion" },
  { value: "grabacion", label: "Grabación" },
  { value: "edicion", label: "Edición" },
  { value: "programado", label: "Programado" },
  { value: "publicado", label: "Publicado" },
];
export const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "youtube", label: "YouTube" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
];
export const OWNERS: { value: ContentOwner; label: string }[] = [
  { value: "luis", label: "Luis" },
  { value: "monse", label: "Monse" },
];
export const label = (list: { value: string; label: string }[], v: string) => list.find((x) => x.value === v)?.label ?? v;
