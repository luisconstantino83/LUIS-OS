import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext } from "@/lib/session";
import { formatLong } from "@/lib/dates";
import { WORKOUT_SUGGESTIONS } from "@/lib/schedule";
import { Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/forms";
import { AddSetForm, WorkoutNotesForm } from "../workout-forms";
import { deleteSet, deleteWorkout } from "../actions";
import type { Workout, WorkoutSet } from "@/lib/types";

export const metadata: Metadata = { title: "Entrenamiento" };

export default async function WorkoutDetail(props: PageProps<"/entreno/[id]">) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await getContext();
  const [{ data: workout }, { data: setsData }, { data: pastData }] = await Promise.all([
    ctx.supabase.from("workouts").select("*").eq("id", id).maybeSingle<Workout>(),
    ctx.supabase.from("workout_sets").select("*").eq("workout_id", id).order("created_at"),
    ctx.supabase.from("workout_sets").select("exercise").order("created_at", { ascending: false }).limit(500),
  ]);
  if (!workout) notFound();
  const sets = (setsData ?? []) as WorkoutSet[];

  const groups = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    const k = s.exercise;
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  const suggestions = [
    ...new Set([
      ...(WORKOUT_SUGGESTIONS[workout.focus] ?? []),
      ...((pastData ?? []) as { exercise: string }[]).map((p) => p.exercise),
    ]),
  ];
  const volume = sets.reduce((s, x) => s + (x.reps ?? 0) * Number(x.weight_kg ?? 0), 0);

  return (
    <>
      <Link href="/entreno" className="mb-3 inline-block text-sm text-muted hover:text-fg">
        ← Entreno
      </Link>
      <PageHeader
        title={workout.focus}
        subtitle={`${formatLong(workout.log_date)} · ${sets.length} series${volume ? ` · ${Math.round(volume)} kg de volumen` : ""}`}
      />
      <div className="space-y-4">
        <Card>
          <CardTitle>Agregar serie</CardTitle>
          <AddSetForm workoutId={workout.id} suggestions={suggestions} lastExercise={sets.at(-1)?.exercise ?? ""} />
        </Card>
        <Card>
          <CardTitle>Series</CardTitle>
          {groups.size === 0 ? (
            <EmptyState title="Sin series todavía" />
          ) : (
            <div className="space-y-4">
              {[...groups.entries()].map(([ex, list]) => (
                <div key={ex}>
                  <p className="mb-1 font-medium">{ex}</p>
                  <ul className="divide-y divide-border rounded-xl bg-surface-2 px-3">
                    {list.map((s, i) => (
                      <li key={s.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                        <span className="tabular">
                          <span className="mr-3 text-faint">{i + 1}</span>
                          {s.reps != null ? `${s.reps} reps` : "—"}
                          {s.weight_kg != null ? ` × ${Number(s.weight_kg)} kg` : ""}
                          {s.notes ? <span className="ml-2 text-muted">· {s.notes}</span> : null}
                        </span>
                        <ConfirmButton action={deleteSet.bind(null, s.id, workout.id)} confirmText="¿Eliminar esta serie?">
                          Quitar
                        </ConfirmButton>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <CardTitle>Notas</CardTitle>
          <WorkoutNotesForm workoutId={workout.id} notes={workout.notes} duration={workout.duration_min} />
        </Card>
        <div className="flex justify-end">
          <ConfirmButton action={deleteWorkout.bind(null, workout.id)} confirmText="¿Eliminar este entrenamiento y todas sus series?">
            Eliminar entrenamiento
          </ConfirmButton>
        </div>
      </div>
    </>
  );
}
