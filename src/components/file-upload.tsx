"use client";

import { useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { buttonClass } from "./ui";

const MAX = 10 * 1024 * 1024;
const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/heic,.doc,.docx";

/**
 * Sube un archivo a Storage (bucket privado, carpeta del usuario) y escribe la ruta en
 * inputs hidden `name` y `${name}_name` para que el formulario la guarde.
 */
export function FileUpload({ userId, folder, name = "file_path" }: { userId: string; folder: string; name?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX) {
      setStatus("error");
      setError("El archivo pesa más de 10 MB.");
      return;
    }
    setStatus("uploading");
    setError(null);
    const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
    const p = `${userId}/${folder}/${crypto.randomUUID()}-${safe}`;
    const { error: e } = await createClient().storage.from("private").upload(p, file, { contentType: file.type || undefined, upsert: false });
    if (e) {
      setStatus("error");
      setError("No se pudo subir: " + e.message);
      return;
    }
    setPath(p);
    setFileName(file.name);
    setStatus("idle");
  };

  return (
    <div>
      {path ? <input type="hidden" name={name} value={path} /> : null}
      {fileName ? <input type="hidden" name={`${name}_name`} value={fileName} /> : null}
      <input ref={input} type="file" accept={ACCEPT} className="sr-only" aria-label="Archivo" onChange={(e) => onPick(e.target.files?.[0])} />
      {path ? (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <Paperclip size={15} className="shrink-0 text-muted" />
            <span className="truncate">{fileName}</span>
          </span>
          <button
            type="button"
            aria-label="Quitar archivo"
            onClick={() => {
              setPath(null);
              setFileName(null);
              if (input.current) input.current.value = "";
            }}
            className="text-faint hover:text-fg"
          >
            <X size={15} />
          </button>
        </div>
      ) : (
        <button type="button" disabled={status === "uploading"} onClick={() => input.current?.click()} className={buttonClass("secondary", "sm")}>
          <Paperclip size={15} />
          {status === "uploading" ? "Subiendo…" : "Adjuntar archivo"}
        </button>
      )}
      {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
      <p className="mt-1 text-xs text-faint">PDF, imagen o Word · máx. 10 MB · solo tú puedes verlo.</p>
    </div>
  );
}
