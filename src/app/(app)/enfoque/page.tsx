import type { Metadata } from "next";
import { getContext } from "@/lib/session";
import { formatShort } from "@/lib/dates";
import { Badge, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import type { FocusItem, FocusSeason } from "@/lib/types";
import { AddItemForm, FocusItemRow, NewSeasonForm } from "./focus-client";
import { FOCUS_LEVEL_LABEL as LEVEL_LABEL } from "@/lib/labels";

export const metadata: Metadata = { title: "Focus Seasons" };

export default async function FocusPage() {
  const ctx = await getContext();
  const { data } = await ctx.supabase.from("focus_seasons").select("*, focus_items(*)").order("starts_on", { ascending: false });
  const seasons = (data ?? []) as (FocusSeason & { focus_items: FocusItem[] })[];
  const current = seasons.find((s) => s.starts_on <= ctx.today && s.ends_on >= ctx.today) ?? seasons.find((s) => s.starts_on > ctx.today) ?? seasons[0];

  return (
    <>
      <PageHeader title="Focus Seasons" subtitle="Tus metas siguen existiendo, pero no todas compiten por tu calendario." />
      <div className="space-y-4">
        {current ? (
          <Card>
            <CardTitle
              hint={`${formatShort(current.starts_on)} – ${formatShort(current.ends_on)}`}
              action={current.starts_on <= ctx.today && current.ends_on >= ctx.today ? <Badge tone="accent">Actual</Badge> : <Badge>Próxima</Badge>}
            >
              {current.name}
            </CardTitle>
            {(["primary", "secondary", "maintenance", "future"] as const).map((lvl) => {
              const items = current.focus_items.filter((i) => i.level === lvl).sort((a, b) => a.sort_order - b.sort_order);
              if (!items.length) return null;
              return (
                <div key={lvl} className="mb-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">{LEVEL_LABEL[lvl]}</p>
                  <ul className="divide-y divide-border">
                    {items.map((i) => (
                      <FocusItemRow key={i.id} item={i} />
                    ))}
                  </ul>
                </div>
              );
            })}
            <AddItemForm seasonId={current.id} />
            <p className="mt-3 text-xs text-muted">
              Primary: práctica frecuente · Secondary: 1–2 veces por semana · Maintenance: lo mínimo para no perderlo · Future: sin presión.
            </p>
          </Card>
        ) : (
          <EmptyState title="Sin temporada todavía" />
        )}
        <Card>
          <CardTitle hint={current ? "Copia las áreas de la temporada actual para ajustarlas." : undefined}>Nueva temporada</CardTitle>
          <NewSeasonForm copyFrom={current?.id ?? null} />
        </Card>
        {seasons.length > 1 ? (
          <Card>
            <CardTitle>Historial</CardTitle>
            <ul className="space-y-1 text-sm text-muted">
              {seasons
                .filter((s) => s.id !== current?.id)
                .map((s) => (
                  <li key={s.id}>
                    {s.name} · {s.focus_items.filter((i) => i.level === "primary").map((i) => i.label).join(", ")}
                  </li>
                ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </>
  );
}
