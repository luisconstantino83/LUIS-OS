"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { str } from "@/lib/form";
import type { ActionState } from "@/components/forms";

export async function signIn(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email", 200);
  const password = str(fd, "password", 200);
  if (!email || !password) return { error: "Escribe tu correo y contraseña." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed"))
      return { error: "Confirma tu correo antes de entrar (revisa tu bandeja)." };
    return { error: "Correo o contraseña incorrectos." };
  }
  redirect("/");
}

export async function signUp(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email", 200);
  const password = str(fd, "password", 200);
  if (!email || !password) return { error: "Escribe tu correo y contraseña." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  const supabase = await createClient();
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) {
    if (error.message.toLowerCase().includes("signups not allowed"))
      return { error: "El registro de cuentas nuevas está desactivado." };
    return { error: "No se pudo crear la cuenta: " + error.message };
  }
  if (data.session) redirect("/");
  return { ok: true, message: "Cuenta creada. Revisa tu correo para confirmarla y después inicia sesión." };
}
