import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getContext } from "@/lib/session";
import { getWeekTemplate } from "@/lib/queries";
import { Card, CardTitle, PageHeader, buttonClass } from "@/components/ui";
import { ProfileForm, TemplateForm, ThemePicker } from "./settings-forms";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  const ctx = await getContext();
  const template = await getWeekTemplate(ctx);
  const t = (await cookies()).get("theme")?.value;
  const theme = t === "light" || t === "dark" ? t : "system";
  return (
    <>
      <PageHeader title="Ajustes" subtitle={ctx.email} />
      <div className="space-y-4">
        <Card>
          <CardTitle>Apariencia</CardTitle>
          <ThemePicker current={theme} />
        </Card>
        <Card>
          <CardTitle>Perfil y metas</CardTitle>
          <ProfileForm profile={ctx.profile} />
        </Card>
        <Card>
          <CardTitle hint="Los días de mantenimiento o de doble turno ocultan inglés, filmmaking y entrenamiento.">
            Horario semanal
          </CardTitle>
          <TemplateForm rows={template} />
        </Card>
        <Card>
          <CardTitle>Sesión</CardTitle>
          <form action="/auth/signout" method="post">
            <button className={buttonClass("secondary")}>Cerrar sesión</button>
          </form>
        </Card>
      </div>
    </>
  );
}
