import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export { clsx as cx };

export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={clsx(
        "rounded-2xl border border-border bg-surface p-4 md:p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)] animate-in",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({
  children,
  action,
  hint,
}: {
  children: ReactNode;
  action?: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">{children}</h2>
        {hint ? <p className="mt-0.5 text-sm text-muted">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[26px] font-semibold tracking-tight md:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-fg text-bg hover:opacity-90",
  secondary: "bg-surface-2 text-fg border border-border hover:bg-track",
  ghost: "text-muted hover:text-fg hover:bg-surface-2",
  danger: "text-danger hover:bg-danger-soft",
};

export function buttonClass(variant: Variant = "primary", size: "sm" | "md" = "md") {
  return clsx(
    "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none",
    size === "md" ? "h-11 px-4 text-[15px]" : "h-9 px-3 text-sm",
    variants[variant],
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: "sm" | "md" }) {
  return <button className={clsx(buttonClass(variant, size), className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: "sm" | "md" }) {
  return <Link className={clsx(buttonClass(variant, size), className)} {...props} />;
}

const fieldBase =
  "w-full min-w-0 rounded-xl border border-border bg-surface-2 px-3 text-fg placeholder:text-faint outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={clsx(fieldBase, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={clsx(fieldBase, "min-h-24 py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={clsx(fieldBase, "h-11 appearance-none pr-8", className)} {...props} />;
}

export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={clsx("block", className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-faint">{hint}</span> : null}
    </label>
  );
}

export function ProgressBar({
  value,
  max,
  tone = "accent",
  className,
}: {
  value: number;
  max: number;
  tone?: "accent" | "success" | "warn" | "danger" | "muted";
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const color = {
    accent: "bg-accent",
    success: "bg-success",
    warn: "bg-warn",
    danger: "bg-danger",
    muted: "bg-faint",
  }[tone];
  return (
    <div
      className={clsx("h-1.5 w-full overflow-hidden rounded-full bg-track", className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={clsx("h-full rounded-full transition-[width] duration-500", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "success" | "warn" | "danger";
  className?: string;
}) {
  const tones = {
    neutral: "bg-surface-2 text-muted border-border",
    accent: "bg-accent-soft text-accent border-transparent",
    success: "bg-success-soft text-success border-transparent",
    warn: "bg-warn-soft text-warn border-transparent",
    danger: "bg-danger-soft text-danger border-transparent",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
      <p className="text-sm font-medium">{title}</p>
      {children ? <div className="mt-1 text-sm text-muted">{children}</div> : null}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted">{label}</p>
      <p className="tabular mt-0.5 truncate text-xl font-semibold tracking-tight">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
    </div>
  );
}

/** Pestañas por URL (?tab=), sin JavaScript. */
export function TabLinks({
  tabs,
  active,
}: {
  tabs: { href: string; label: string; key: string }[];
  active: string;
}) {
  return (
    <nav className="no-scrollbar -mx-4 mb-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          scroll={false}
          className={clsx(
            "whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition",
            active === t.key ? "bg-fg text-bg" : "text-muted hover:bg-surface-2 hover:text-fg",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
