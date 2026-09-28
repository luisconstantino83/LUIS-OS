"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clapperboard,
  Dumbbell,
  LayoutGrid,
  ListChecks,
  RotateCcw,
  Settings,
  Sun,
  Cpu,
  Languages,
  Compass,
  UserRound,
  Sparkles,
  Trophy,
  Wallet,
  GraduationCap,
} from "lucide-react";

const MAIN = [
  { href: "/", label: "Hoy", icon: Sun },
  { href: "/habitos", label: "Hábitos", icon: ListChecks },
  { href: "/entreno", label: "Entreno", icon: Dumbbell },
  { href: "/finanzas", label: "Finanzas", icon: Wallet },
];
const MORE = [
  { href: "/carrera", label: "Carrera", icon: GraduationCap },
  { href: "/skills", label: "Skills", icon: Sparkles },
  { href: "/mecatronica", label: "Mecatrónica", icon: Cpu },
  { href: "/idiomas", label: "Idiomas", icon: Languages },
  { href: "/monse", label: "Monse × DAZN", icon: Trophy },
  { href: "/contenido", label: "Content Studio", icon: Clapperboard },
  { href: "/reset", label: "Weekly Reset", icon: RotateCcw },
  { href: "/enfoque", label: "Focus Seasons", icon: Compass },
  { href: "/perfil", label: "Knowledge Profile", icon: UserRound },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
}

export function Sidebar() {
  const path = usePathname();
  const item = (it: (typeof MAIN)[number]) => (
    <Link
      key={it.href}
      href={it.href}
      className={clsx(
        "flex items-center gap-3 rounded-xl px-3 py-2 text-[15px] font-medium transition",
        isActive(path, it.href) ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      <it.icon size={18} strokeWidth={1.8} />
      {it.label}
    </Link>
  );
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border px-3 py-6 md:flex">
      <Link href="/" className="mb-8 flex items-center gap-2.5 px-3">
        <span className="grid size-8 place-items-center rounded-xl bg-fg text-sm font-semibold text-bg">L</span>
        <span className="font-semibold tracking-tight">Luis OS</span>
      </Link>
      <nav className="space-y-1">{MAIN.map(item)}</nav>
      <p className="mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-[0.08em] text-faint">Más</p>
      <nav className="space-y-1">{MORE.map(item)}</nav>
    </aside>
  );
}

export function TabBar() {
  const path = usePathname();
  const moreActive = ["/mas", ...MORE.map((m) => m.href)].some((h) => isActive(path, h));
  const tabs = [...MAIN, { href: "/mas", label: "Más", icon: LayoutGrid }];
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/85 backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {tabs.map((t) => {
          const active = t.href === "/mas" ? moreActive : isActive(path, t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={clsx(
                "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition",
                active ? "text-fg" : "text-faint",
              )}
            >
              <t.icon size={21} strokeWidth={active ? 2.1 : 1.7} />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

