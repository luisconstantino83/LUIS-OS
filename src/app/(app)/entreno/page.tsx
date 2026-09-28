import type { Metadata } from "next";
import Link from "next/link";
import { getContext } from "@/lib/session";
import { addDays, formatShort, weekStart, weekdayName, weekdayOf } from "@/lib/dates";
import { getWeekTemplate, getWorkouts } from "@/lib/queries";
import { isLightDay } from "@/lib/schedule";
import { Badge, Card, CardTitle, EmptyState, PageHeader, ProgressBar } from "@/components/ui";
import { LineChart } from "@/components/line-chart";
import { NewWorkoutForm } from "./workout-forms";

export const metadata: Metadata = { title: "Entreno" };

type SetRow = { workout_id: string; exercise: string; weight_kg: number | null; reps: number | null; workouts: { log_date: string } | null };

export default async function WorkoutsPage(props: PageProps<"/entreno">) {
  const ctx = await getContext();
  const sp = await props.searchParams;
  const selected = typeof sp.ej === "string" ? sp.ej.slice(0, 80) : null;
  const wd = weekdayOf(ctx.today);
  const ws = weekStart(ctx.today);

  const [template, recent, setsRes] = await Promise.all([
    getWeekTemplate(ctx),
    getWorkouts(ctx, addDays(ctx.today, -180), ctx.today),
    ctx.supabase
      .from("workout_sets")
      .select("workout_id,exercise,weight_kg,reps,workouts(log_date)")
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);
  const sets = (setsRes.data ?? []) as unknown as SetRow[];

  const row = template.find((r) => r.weekday === wd);
  const light = isLightDay(row);
  const weekCount = new Set(recent.filter((w) => w.log_date >= ws).map((w) => w.log_date)).size;
  const focuses = [...new Set([...template.map((t) => t.workout_focus).filter(Boolean), ...recent.map((w) => w.focus)])] as string[];
  const doneToday = recent.find((w) => w.log_date === ctx.today);

  // Ejercicios distintos (por frecuencia)
  const freq = new Map<string, { name: string; n: number }>();
  for (const s of sets) {
    const k = s.exercise.toLowerCase();
    const cur = freq.get(k);
    if (cur) cur.n++;
    else freq.set(k, { name: s.exercise, n: 1 });
  }
  const exercises = [...freq.values()].sort((a, b) => b.n - a.n).map((e) => e.name);
  const chosen = selected ?? exercises[0] ?? null;

  // Mejor peso por sesión del ejercicio elegido
  const best = new Map<string, number>();
  if (chosen) {
    for (const s of sets) {
      if (s.exercise.toLowerCase() !== chosen.toLowerCase() || s.weight_kg == null || !s.workouts) continue;
      const d = s.workouts.log_date;
      best.set(d, Math.max(best.get(d) ?? 0, Number(s.weight_kg)));
    }
  }
  const points = [...best.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([d, y]) => ({ x: formatShort(d), y, tip: `${formatShort(d)}: ${y} kg` }));

  const setCounts = new Map<string, number>();
  for (const s of sets) setCounts.set(s.workout_id, (setCounts.get(s.workout_id) ?? 0) + 1);
  const plannedDays = template.filter((t) => t.workout_focus).map((t) => `${weekdayName(t.weekday).slice(0, 3)}: ${t.workout_focus}`);

  return (
    <>
      <PageHeader title="Entreno" subtitle={`Semana: ${weekCount}/${ctx.profile.workouts_target} entrenamientos`} />
      <div className="space-y-4">
        <Card>
          <CardTitle
            action={doneToday ? <Badge tone="success">Hecho hoy</Badge> : null}
            hint={
              light
                ? "Hoy es día ligero. Si entrenas es un extra, no una obligación."
                : row?.workout_focus
                  ? `Toca: ${row.workout_focus}`
                  : "Hoy no hay entrenamiento planeado."
            }
          >
            Hoy
          </CardTitle>
          <ProgressBar value={weekCount} max={ctx.profile.workouts_target} tone="success" className="mb-4" />
          {doneToday ? (
            <Link href={`/entreno/${doneToday.id}`} className="mb-4 block text-sm font-medium text-accent">
              Continuar registro de {doneToday.focus} →
            </Link>
          ) : null}
          <NewWorkoutForm
            today={ctx.today}
            defaultFocus={light ? "" : (row?.workout_focus ?? "")}
            focuses={focuses}
          />
          <p className="mt-4 text-xs text-muted">Plan: {plannedDays.join(" · ")}</p>
        </Card>

        <Card>
          <CardTitle hint="Mejor peso por sesión.">Progreso</CardTitle>
          {exercises.length === 0 ? (
            <EmptyState title="Aún no hay series registradas">Registra un entrenamiento para ver tu progreso.</EmptyState>
          ) : (
            <>
              <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1">
                {exercises.slice(0, 20).map((e) => (
                  <Link
                    key={e}
                    href={`/entreno?ej=${encodeURIComponent(e)}`}
                    scroll={false}
                    className={`whitespace-nowrap rounded-full px-3 py-1 text-sm ${
                      chosen?.toLowerCase() === e.toLowerCase() ? "bg-fg text-bg" : "bg-surface-2 text-muted"
                    }`}
                  >
                    {e}
                  </Link>
                ))}
              </div>
              {points.length > 0 ? (
                <LineChart points={points} unit=" kg" label={`Progreso de ${chosen}`} />
              ) : (
                <p className="text-sm text-muted">Este ejercicio no tiene peso registrado.</p>
              )}
            </>
          )}
        </Card>

        <Card>
          <CardTitle>Historial</CardTitle>
          {recent.length === 0 ? (
            <EmptyState title="Sin entrenamientos todavía" />
          ) : (
            <ul className="divide-y divide-border">
              {recent.slice(0, 40).map((w) => (
                <li key={w.id}>
                  <Link href={`/entreno/${w.id}`} className="-mx-2 flex items-center justify-between rounded-xl px-2 py-3 hover:bg-surface-2">
                    <div>
                      <p className="text-[15px] font-medium">{w.focus}</p>
                      <p className="text-xs text-muted">
                        {weekdayName(weekdayOf(w.log_date))} {formatShort(w.log_date)}
                        {w.duration_min ? ` · ${w.duration_min} min` : ""}
                        {setCounts.get(w.id) ? ` · ${setCounts.get(w.id)} series` : ""}
                      </p>
                    </div>
                    <span className="text-faint">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
