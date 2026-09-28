"use client";

import { useState } from "react";
import { ActionForm, Segmented, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";
import { signIn, signUp } from "./actions";

export function LoginForm() {
  const [mode, setMode] = useState<"in" | "up">("in");
  return (
    <div className="space-y-5">
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: "in", label: "Entrar" },
          { value: "up", label: "Crear cuenta" },
        ]}
      />
      <ActionForm key={mode} action={mode === "in" ? signIn : signUp} className="space-y-4">
        <Field label="Correo">
          <Input name="email" type="email" autoComplete="email" required placeholder="tu@correo.com" />
        </Field>
        <Field label="Contraseña" hint={mode === "up" ? "Mínimo 8 caracteres." : undefined}>
          <Input
            name="password"
            type="password"
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            required
            minLength={mode === "up" ? 8 : undefined}
          />
        </Field>
        <SubmitButton className="w-full" pendingText={mode === "in" ? "Entrando…" : "Creando…"}>
          {mode === "in" ? "Entrar" : "Crear cuenta"}
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
