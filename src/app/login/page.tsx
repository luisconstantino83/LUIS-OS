import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  return (
    <main className="safe-top flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm animate-in">
        <div className="mb-8">
          <div className="mb-5 grid size-11 place-items-center rounded-2xl bg-fg text-bg">
            <span className="text-lg font-semibold tracking-tight">L</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Luis OS</h1>
          <p className="mt-1.5 text-muted">Orden sin saturación.</p>
        </div>
        {error ? (
          <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            No se pudo confirmar la sesión. Intenta iniciar sesión de nuevo.
          </p>
        ) : null}
        <LoginForm />
      </div>
    </main>
  );
}
