"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/finanzas", label: "Home" },
  { href: "/finanzas/semana", label: "Semana" },
  { href: "/finanzas/ahorro", label: "Ahorro" },
  { href: "/finanzas/sobres", label: "Sobres y metas" },
  { href: "/finanzas/tarjetas", label: "Tarjetas" },
  { href: "/finanzas/msi", label: "MSI" },
  { href: "/finanzas/deudas", label: "Deudas" },
  { href: "/finanzas/movimientos", label: "Movimientos" },
];

export function FinanceNav() {
  const path = usePathname();
  const active = (href: string) => (href === "/finanzas" ? path === href : path === href || path.startsWith(href + "/"));
  return (
    <nav className="no-scrollbar -mx-4 mb-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0" aria-label="Secciones de finanzas">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={clsx(
            "whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition",
            active(t.href) ? "bg-fg text-bg" : "text-muted hover:bg-surface-2 hover:text-fg",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
