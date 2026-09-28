import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ProgressBar } from "@/components/ui";

/** Card pequeña para el dashboard. Solo lo esencial. */
export function SkillWeekCard({ name, progress }: { name: string | null; progress: number }) {
  return (
    <Link
      href="/skills/semana"
      className="flex items-center gap-4 rounded-2xl border border-border bg-surface px-4 py-3.5 transition hover:bg-surface-2 animate-in"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Skill of the week</p>
        {name ? (
          <>
            <p className="truncate text-[15px] font-semibold">{name}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <ProgressBar value={progress} max={100} tone="success" />
              <span className="tabular text-xs text-muted">{progress}%</span>
            </div>
          </>
        ) : (
          <p className="text-[15px] text-muted">Elige una skill para esta semana</p>
        )}
      </div>
      <span className="flex shrink-0 items-center gap-0.5 text-sm font-medium text-accent">
        {name ? "Continuar" : "Elegir"}
        <ChevronRight size={16} />
      </span>
    </Link>
  );
}
