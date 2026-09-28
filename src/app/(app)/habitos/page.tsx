import type { Metadata } from "next";
import { getContext } from "@/lib/session";
import { addDays, weekDates, weekStart, weekdayOf } from "@/lib/dates";
import { getHabitLogs, getHabits, getWeekTemplate } from "@/lib/queries";
import { isLightDay } from "@/lib/schedule";
import { Card, CardTitle, PageHeader } from "@/components/ui";
import { HabitManager, NewHabitForm, TodayChecklist, WeekGrid } from "./habits-client";

export const metadata: Metadata = { title: "Hábitos" };

export default async function HabitsPage() {
  const ctx = await getContext();
  const ws = weekStart(ctx.today);
  const [habits, allHabits, logs, template] = await Promise.all([
    getHabits(ctx),
    getHabits(ctx, true),
    getHabitLogs(ctx, ws, addDays(ws, 6)),
    getWeekTemplate(ctx),
  ]);
  const wd = weekdayOf(ctx.today);
  const light = isLightDay(template.find((t) => t.weekday === wd));
  const doneToday = logs.filter((l) => l.log_date === ctx.today).map((l) => l.habit_id);

  return (
    <>
      <PageHeader title="Hábitos" subtitle="Higiene y crecimiento. Marca lo que hiciste, sin presión." />
      <div className="space-y-4">
        <TodayChecklist
          key={"t" + doneToday.join()}
          date={ctx.today} weekday={wd} habits={habits} doneIds={doneToday} light={light} />
        <WeekGrid
          key={"w" + logs.map((l) => l.habit_id + l.log_date).join()}
          dates={weekDates(ws)} today={ctx.today} habits={habits} logs={logs} />
        <Card>
          <CardTitle>Nuevo hábito</CardTitle>
          <NewHabitForm />
        </Card>
        <Card>
          <CardTitle hint="Pausar oculta el hábito sin borrar su historial.">Administrar</CardTitle>
          <HabitManager habits={allHabits} />
        </Card>
      </div>
    </>
  );
}
