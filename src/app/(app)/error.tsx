"use client";

import { Button, Card } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card>
      <h1 className="text-lg font-semibold">Algo no cargó bien</h1>
      <p className="mt-1 text-sm text-muted">
        Tus datos están a salvo. Revisa tu conexión e inténtalo de nuevo.
      </p>
      {process.env.NODE_ENV !== "production" ? (
        <pre className="mt-3 overflow-auto rounded-lg bg-surface-2 p-3 text-xs text-muted">{error.message}</pre>
      ) : null}
      <Button className="mt-4" onClick={reset}>
        Reintentar
      </Button>
    </Card>
  );
}
