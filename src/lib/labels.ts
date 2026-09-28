// Etiquetas compartidas entre componentes de servidor y cliente
// (no pueden vivir en un archivo "use client": el servidor solo recibe una referencia).

export const LANGUAGE_STATUS_LABEL: Record<string, string> = {
  native: "Native",
  primary: "Primary",
  secondary: "Secondary",
  maintenance: "Maintenance",
  paused: "Paused",
  future: "Future",
};

export const FOCUS_LEVEL_LABEL = {
  primary: "Primary",
  secondary: "Secondary",
  maintenance: "Maintenance",
  future: "Future",
} as const;
