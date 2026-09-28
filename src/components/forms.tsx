"use client";

import clsx from "clsx";
import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import { buttonClass } from "./ui";

export type ActionState = { ok?: boolean; error?: string; message?: string } | null;
export type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

/** Estado "pendiente" de ActionForm (no usamos useFormStatus porque evitamos el reset automático). */
const PendingContext = createContext<boolean | null>(null);

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
  pendingText = "Guardando…",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  className?: string;
  pendingText?: string;
}) {
  const status = useFormStatus();
  const ctxPending = useContext(PendingContext);
  const pending = ctxPending ?? status.pending;
  return (
    <button type="submit" disabled={pending} className={clsx(buttonClass(variant, size), className)}>
      {pending ? pendingText : children}
    </button>
  );
}

/**
 * Formulario con estado (errores / confirmación).
 * React 19 limpia los formularios tras cada envío con `action`; aquí lo evitamos para que
 * un error no borre lo escrito. Solo se limpia si resetOnSuccess.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  onSuccess,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
      {state?.error ? (
        <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state?.ok && state.message ? (
        <p role="status" className="mt-3 text-sm text-success">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

/** Selector segmentado accesible que escribe en un input hidden con `name`. */
export function Segmented<T extends string>({
  name,
  options,
  defaultValue,
  value: controlled,
  onChange,
  size = "md",
  className,
}: {
  name?: string;
  options: { value: T; label: ReactNode }[];
  defaultValue?: T;
  value?: T | null;
  onChange?: (v: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const [inner, setInner] = useState<T | undefined>(defaultValue);
  const value = controlled !== undefined ? controlled : inner;
  return (
    <div
      role="radiogroup"
      className={clsx("flex w-full rounded-xl border border-border bg-surface-2 p-1", className)}
    >
      {name ? <input type="hidden" name={name} value={value ?? ""} /> : null}
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => {
            setInner(o.value);
            onChange?.(o.value);
          }}
          className={clsx(
            "flex-1 rounded-lg px-2 font-medium transition",
            size === "md" ? "h-9 text-sm" : "h-8 text-xs",
            value === o.value ? "bg-surface text-fg shadow-sm ring-1 ring-border" : "text-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Botón que ejecuta una acción después de confirmar (para borrar). */
export function ConfirmButton({
  action,
  children = "Eliminar",
  confirmText = "¿Eliminar? Esta acción no se puede deshacer.",
  className,
}: {
  action: () => Promise<unknown>;
  children?: ReactNode;
  confirmText?: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={clsx(buttonClass("danger", "sm"), className)}
      onClick={() => {
        if (window.confirm(confirmText)) start(async () => void (await action()));
      }}
    >
      {pending ? "…" : children}
    </button>
  );
}
