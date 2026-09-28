import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { logicalToday, localHour } from "./dates";
import type { Profile } from "./types";

/**
 * Contexto por request: cliente de Supabase, usuario, perfil y "hoy" lógico.
 * Si el perfil no existe (usuario creado antes de correr la migración) se crea con valores por defecto.
 */
export const getContext = cache(async () => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");

  let { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle<Profile>();
  if (!profile) {
    const { data: created, error } = await supabase
      .from("profiles")
      .insert({ id: userId })
      .select("*")
      .single<Profile>();
    if (error || !created) throw new Error("No se pudo crear tu perfil: " + (error?.message ?? ""));
    profile = created;
  }

  const today = logicalToday(profile.timezone, profile.day_start_hour);
  const hour = localHour(profile.timezone);
  return { supabase, userId, profile, today, hour, email: (claimsData?.claims?.email as string) ?? "" };
});

export type AppContext = Awaited<ReturnType<typeof getContext>>;
