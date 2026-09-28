import { getContext } from "@/lib/session";
import { addDays, formatLong, greeting, weekStart, weekdayOf } from "@/lib/dates";
import { quoteFor } from "@/lib/quotes";
import { DAY_TYPES, isLightDay, workLabel } from "@/lib/schedule";
import { weeklyMetrics } from "@/lib/progress";
import {
  getDailyLog,
  getHabitLogs,
  getPriorities,
  getWeekData,
  getWeekTemplate,
  getWeeklyFocus,
} from "@/lib/queries";
import { Badge } from "@/components/ui";
import { TodayView } from "./_components/today";
import { PrioritiesCard } from "./_components/priorities";
import { WeeklyProgress } from "./_components/weekly-progress";
import { EMPTY_DAY } from "./_components/day-defaults";
import { SkillWeekCard } from "./_components/skill-week-card";
import { getSkillWeek, getWeekEvidenceForSkill } from "@/lib/skill-queries";
import { weekProgress, type EvidenceKind } from "@/lib/skills";

export default async function Dashboard() {
  const ctx = await getContext();
  const { profile, today } = ctx;
  const wd = weekdayOf(today);
  const ws = weekStart(today);

  const [template, log, priorities, yesterdayPriorities, focus, week, todayHabitLogs, skillWeek] = await Promise.all([
    getWeekTemplate(ctx),
    getDailyLog(ctx, today),
    getPriorities(ctx, today),
    getPriorities(ctx, addDays(today, -1)),
    getWeeklyFocus(ctx, ws),
    getWeekData(ctx, ws),
    getHabitLogs(ctx, today, today),
    getSkillWeek(ctx, ws),
  ]);
  const skillEvidence = skillWeek ? await getWeekEvidenceForSkill(ctx, skillWeek.skill_id, ws, addDays(ws, 6)) : [];
  const skillPct = weekProgress(new Set<EvidenceKind>(skillEvidence.map((e) => e.kind)));

  const row = template.find((r) => r.weekday === wd);
  const dayType = row ? DAY_TYPES[row.day_type] : null;
  const light = isLightDay(row);
  const workoutToday = week.workouts.some((w) => w.log_date === today);
  const hygieneHabits = week.habits.filter((h) => h.group_key !== "general");
  const hygieneIds = new Set(hygieneHabits.map((h) => h.id));
  const doneToday = todayHabitLogs.map((l) => l.habit_id);
  const growth = week.habits
    .filter((h) => h.key === "ingles" || h.key === "filmmaking")
    .map((h) => ({ id: h.id, name: h.key === "ingles" ? "Inglés" : "Filmmaking", activeToday: !light && h.active_days.includes(wd) }));
  const metrics = weeklyMetrics(profile, week);
  const main = priorities.find((p) => p.position === 1);

  return (
    <div className="space-y-4">
      <header className="mb-2 animate-in">
        <p className="text-sm text-muted">{formatLong(today)}</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight md:text-3xl">
          {greeting(ctx.hour, profile.display_name)}
        </h1>
        <p className="mt-2 text-[15px] text-muted">{quoteFor(today)}</p>
        {dayType ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge tone={light ? "neutral" : "accent"}>Día de {dayType.label.toLowerCase()}</Badge>
            <span className="text-sm text-muted">{dayType.description}</span>
          </div>
        ) : null}
      </header>

      <TodayView
        key={today}
        date={today}
        initial={
          log
            ? {
                sleep_hours: log.sleep_hours,
                water_glasses: log.water_glasses,
                food_quality: log.food_quality,
                energy: log.energy,
                pages_read: log.pages_read,
                meditation_min: log.meditation_min,
                exhausted: log.exhausted,
                basic_hygiene: log.basic_hygiene,
                ate_decently: log.ate_decently,
                going_to_sleep: log.going_to_sleep,
              }
            : EMPTY_DAY
        }
        goals={{
          water: profile.water_goal_glasses,
          pages: profile.pages_goal_daily,
          meditation: profile.meditation_goal_min,
          sleep: Number(profile.sleep_goal_hours),
        }}
        work={workLabel(row)}
        workout={{ focus: light ? null : (row?.workout_focus ?? null), done: workoutToday, light }}
        mainTask={main?.title ?? null}
        mainTaskDone={main?.done ?? false}
        growth={growth}
        habitDone={doneToday}
        hygiene={{ done: doneToday.filter((id) => hygieneIds.has(id)).length, total: hygieneHabits.length }}
        top={
          <PrioritiesCard
            date={today}
            initial={priorities}
            weeklyFocus={focus}
            pendingYesterday={yesterdayPriorities.filter((p) => !p.done).length}
          />
        }
        bottom={
          <>
            <SkillWeekCard name={skillWeek?.skills?.name ?? null} progress={skillPct} />
            <WeeklyProgress metrics={metrics} daysElapsed={wd + 1} />
          </>
        }
      />
    </div>
  );
}
