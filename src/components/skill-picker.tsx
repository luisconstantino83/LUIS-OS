"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";
import { X } from "lucide-react";

export interface PickerGroup {
  id: string;
  key: string;
  name: string;
  skills: { id: string; name: string; level: number }[];
}

/**
 * Selector de skills por categoría. Escribe inputs hidden `name` con los IDs seleccionados.
 * `openKeys` abre por defecto las categorías más relevantes (ej. filmmaking en producciones).
 */
export function SkillPicker({
  groups,
  name,
  defaultSelected = [],
  openKeys = [],
  onChange,
}: {
  groups: PickerGroup[];
  name: string;
  defaultSelected?: string[];
  openKeys?: string[];
  onChange?: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const [q, setQ] = useState("");
  const byId = useMemo(() => {
    const m = new Map<string, { name: string; cat: string }>();
    for (const g of groups) for (const s of g.skills) m.set(s.id, { name: s.name, cat: g.name });
    return m;
  }, [groups]);

  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    setSelected(next);
    onChange?.(next);
  };
  const query = q.trim().toLowerCase();

  return (
    <div>
      {selected.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      {selected.length ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className="inline-flex items-center gap-1 rounded-full bg-fg py-1 pl-3 pr-2 text-sm text-bg"
            >
              {byId.get(id)?.name ?? "Skill"}
              <X size={13} aria-label="Quitar" />
            </button>
          ))}
        </div>
      ) : (
        <p className="mb-2 text-sm text-faint">Ninguna seleccionada.</p>
      )}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar skill…"
        aria-label="Buscar skill"
        className="mb-2 h-10 w-full min-w-0 rounded-xl border border-border bg-surface-2 px-3 outline-none focus:border-accent"
      />
      <div className="space-y-1">
        {groups.map((g) => {
          const list = g.skills.filter((s) => !query || s.name.toLowerCase().includes(query));
          if (!list.length) return null;
          const count = g.skills.filter((s) => selected.includes(s.id)).length;
          return (
            <details key={g.id} open={!!query || openKeys.includes(g.key)} className="rounded-xl bg-surface-2 px-3 py-2">
              <summary className="cursor-pointer select-none text-sm font-medium">
                {g.name}
                {count ? <span className="ml-1.5 text-accent">· {count}</span> : null}
              </summary>
              <div className="mt-2 flex flex-wrap gap-1.5 pb-1">
                {list.map((s) => {
                  const on = selected.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(s.id)}
                      className={clsx(
                        "rounded-full px-3 py-1 text-sm transition",
                        on ? "bg-fg text-bg" : "bg-surface text-muted ring-1 ring-border hover:text-fg",
                      )}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
