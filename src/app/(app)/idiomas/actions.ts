"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { dbError, oneOf, str } from "@/lib/form";
import type { ActionState } from "@/components/forms";

const STATUS = ["native", "primary", "secondary", "maintenance", "paused", "future"] as const;
const CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export async function updateLanguage(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const status = oneOf(fd.get("status"), STATUS);
  if (!status) return { error: "Estado inválido." };
  const cefr = oneOf(fd.get("cefr"), CEFR);
  const evidence = str(fd, "cefr_evidence", 500);
  if (cefr && !evidence) return { error: "El nivel A1–C2 solo se registra con evidencia (examen, evaluación, certificado)." };
  const { error } = await ctx.supabase
    .from("languages")
    .update({ status, cefr, cefr_evidence: cefr ? evidence : null })
    .eq("id", id);
  if (error) return { error: dbError(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Guardado." };
}
