import type { Metadata } from "next";
import Link from "next/link";
import { getContext } from "@/lib/session";
import { addDays, formatShort, isValidISODate, weekStart, weekdayOf } from "@/lib/dates";
import { getWeekData } from "@/lib/queries";
import { foodSummary, metricRatio, moneySummary, overallPercent, weeklyMetrics } from "@/lib/progress";
import { money } from "@/lib/finance";
import { Badge, Card, CardTitle, PageHeader } from "@/components/ui";
import type { Transaction, WeeklyReview } from "@/lib/types";
import { ReviewForm } from "./review-form";
import { netSavings, planSummary, weeklyIncome } from "@/lib/money";
import { getEvidenceRows, getSkillTree } from "@/lib/skill-queries";
import { outputMessage, weekLearning } from "@/lib/skills";

export const metadata: Metadata = { title: "Weekly Reset" };

const SUGGESTIONS: Record<string, string> = {
  sueno: "Dormir 7 h al menos 5 noches",
  ejercicio: "Entrenar los 4 días del plan",
  ingles: "4 sesiones de inglés de 30 min",
  filmmaking: "3 prácticas de filmmaking",
  lectura: "Leer 10 páginas en días libres",
  meditacion: "Meditar 10 min 5 días",
  higiene: "Rutina de higiene completa diario",
  contenido: "Publicar 1 video",
  carrera: "Avanzar servicio social / titulación",
  finanzas: "Registrar gastos y revisar MSI",
};

export default async function ResetPage(props: PageProps<"/reset">) {
  const ctx = await getContext();
  const sp = await props.searchParams;
  const current = weekStart(ctx.today);
  const requested = typeof sp.semana === "string" && isValidISODate(sp.semana) ? weekStart(sp.semana) : current;
  const ws = requested > current ? current : requested;
  const we = addDays(ws, 6);

  const [week, txRes, reviewRes, pastRes, evRows, groups, publishedRes] = await Promise.all([
    getWeekData(ctx, ws),
    ctx.supabase.from("transactions").select("kind,amount,category").gte("tx_date", ws).lte("tx_date", we),
    ctx.supabase.from("weekly_reviews").select("*").eq("week_start", ws).maybeSingle<WeeklyReview>(),
    ctx.supabase
      .from("weekly_reviews")
      .select("week_start,metrics,completed_at")
      .order("week_start", { ascending: false })
      .limit(8),
    getEvidenceRows(ctx, ws, we),
    getSkillTree(ctx, { exclude: ["engineering"] }),
    ctx.supabase.from("content_items").select("title").eq("status", "publicado").gte("published_date", ws).lte("published_date", we),
  ]);
  const wl = weekLearning(evRows);

  // Mecatrónica + idiomas (solo lo esencial)
  const [{ data: engEv }, { data: primaryLangs }, { data: activeLab }] = await Promise.all([
    ctx.supabase
      .from("skill_evidence")
      .select("kind,minutes,subtype, skills!inner(name, skill_categories!inner(domain,key))")
      .gte("occurred_on", ws)
      .lte("occurred_on", we)
      .in("skills.skill_categories.domain", ["engineering", "languages"]),
    ctx.supabase.from("languages").select("name,flag,category_id").eq("status", "primary"),
    ctx.supabase.from("skill_projects").select("id,title").eq("domain", "engineering").eq("status", "activo").limit(1).maybeSingle(),
  ]);
  type EngRow = { kind: string; minutes: number | null; subtype: string | null; skills: { name: string; skill_categories: { domain: string; key: string } } };
  const engRows = ((engEv ?? []) as unknown as EngRow[]).filter((r) => r.skills.skill_categories.domain === "engineering");
  const langRows = ((engEv ?? []) as unknown as EngRow[]).filter((r) => r.skills.skill_categories.domain === "languages");
  const mins = (rows: EngRow[], pred: (r: EngRow) => boolean) => rows.filter(pred).reduce((s, r) => s + (r.minutes ?? 0), 0);
  const mx = {
    sessions: engRows.length,
    practice: mins(engRows, (r) => r.kind === "practice"),
    skills: [...new Set(engRows.map((r) => r.skills.name))],
  };
  const lang = {
    primary: ((primaryLangs ?? []) as { name: string; flag: string | null }[]).map((l) => `${l.flag ?? ""} ${l.name}`.trim()),
    speaking: mins(langRows, (r) => /speaking|conversation/i.test(r.skills.name)),
    listening: mins(langRows, (r) => /listening/i.test(r.skills.name)),
    vocab: langRows.filter((r) => /vocabulary/i.test(r.skills.name)).length,
  };

  // Carrera (solo datos de la semana)
  const [{ data: svcW }, { data: jobsW }, { data: qW }] = await Promise.all([
    ctx.supabase.from("service_logs").select("hours").gte("log_date", ws).lte("log_date", we),
    ctx.supabase.from("job_applications").select("id").gte("applied_on", ws).lte("applied_on", we),
    ctx.supabase.from("interview_questions").select("id").gte("last_practiced", ws).lte("last_practiced", we),
  ]);
  const career = {
    serviceHours: ((svcW ?? []) as { hours: number }[]).reduce((s, r) => s + Number(r.hours), 0),
    applications: (jobsW ?? []).length,
    practiced: (qW ?? []).length,
  };

  const money$ = moneySummary((txRes.data ?? []) as Transaction[]);
  // Money scorecard
  const [{ data: movsW }, { data: cardPays }, { data: debtPays }, { data: msiNew }, { data: loansW }, { data: loansPending }, { data: planW }] =
    await Promise.all([
      ctx.supabase.from("goal_movements").select("kind,amount,goal_id,savings_goals(is_bucket)").gte("moved_on", ws).lte("moved_on", we),
      ctx.supabase.from("card_payments").select("amount").gte("paid_on", ws).lte("paid_on", we),
      ctx.supabase.from("debt_payments").select("amount").gte("paid_on", ws).lte("paid_on", we),
      ctx.supabase.from("msi_purchases").select("product").gte("created_at", ws).lte("created_at", we + "T23:59:59"),
      ctx.supabase.from("internal_loans").select("amount").gte("taken_on", ws).lte("taken_on", we),
      ctx.supabase.from("internal_loans").select("amount,repaid").eq("status", "pendiente"),
      ctx.supabase.from("weekly_money_plans").select("weekly_allocations(category,planned,actual)").eq("week_start", ws).maybeSingle(),
    ]);
  const mv = (movsW ?? []) as unknown as { kind: string; amount: number; savings_goals: { is_bucket: boolean } | null }[];
  const sumOf = (rows: unknown) => ((rows ?? []) as { amount: number }[]).reduce((s, r) => s + Number(r.amount), 0);
  const weekInc = weeklyIncome((txRes.data ?? []) as { kind: string; category: string; amount: number }[]).total;
  const allocsW = (planW as { weekly_allocations?: { category: string; planned: number; actual: number | null }[] } | null)?.weekly_allocations ?? [];
  const scorecard = {
    earned: money$.income,
    spent: money$.expenses,
    saved: netSavings(mv),
    debtPaid: sumOf(cardPays) + sumOf(debtPays),
    toGoals: mv.filter((m) => m.kind === "aporte" && m.savings_goals && !m.savings_goals.is_bucket).reduce((s, m) => s + Number(m.amount), 0),
    msi: ((msiNew ?? []) as { product: string }[]).map((m) => m.product),
    tookFromBuckets: sumOf(loansW),
    toRepay: ((loansPending ?? []) as { amount: number; repaid: number }[]).reduce((s, l) => s + Number(l.amount) - Number(l.repaid), 0),
    free: allocsW.length ? planSummary(weekInc, allocsW).libre : null,
  };
  const skillName = new Map(groups.flatMap((g) => g.skills.map((s) => [s.id, s.name] as const)));
  const practicedNames = wl.skillIds.map((id) => skillName.get(id)).filter(Boolean) as string[];
  const produced = ((publishedRes.data ?? []) as { title: string }[]).map((p) => p.title);
  const hrs = (m: number) => (m >= 60 ? `${(m / 60).toFixed(1)} h` : `${m} min`);
  const metrics = weeklyMetrics(ctx.profile, week);
  const byKey = Object.fromEntries(metrics.map((m) => [m.key, m]));
  const food = foodSummary(week.logs);
  const pct = overallPercent(metrics);
  const isSaturday = weekdayOf(ctx.today) === 6;
  const review = reviewRes.data;

  const wins = metrics.filter((m) => metricRatio(m) >= 1).map((m) => m.label);
  const adjust = metrics.filter((m) => metricRatio(m) < 0.5);
  const suggestions = adjust.map((m) => SUGGESTIONS[m.key]).filter(Boolean).slice(0, 5);

  const q = (label: string, value: React.ReactNode) => (
    <li className="flex items-baseline justify-between gap-3 py-2">
      <span className="text-sm text-muted">{label}</span>
      <span className="tabular text-right font-medium">{value}</span>
    </li>
  );
  const frac = (k: string) => (byKey[k] ? `${byKey[k].done}/${byKey[k].target}` : "—");
  const foodText =
    Object.entries(food)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${n} ${k}`)
      .join(" · ") || "Sin registro";

  const snapshot = {
    percent: pct,
    metrics: metrics.map((m) => ({ key: m.key, done: m.done, target: m.target })),
    food,
    income: money$.income,
    expenses: money$.expenses,
    net: money$.net,
    money: scorecard,
    mechatronics: mx,
    languages: lang,
    career,
    learning: { learnMin: wl.learnMin, practiceMin: wl.practiceMin, applied: wl.applied, reflections: wl.reflections },
  };

  return (
    <>
      <PageHeader
        title="Weekly Reset"
        subtitle={`${formatShort(ws)} – ${formatShort(we)}${ws === current ? " · esta semana" : ""}`}
        action={review?.completed_at ? <Badge tone="success">Cerrada</Badge> : isSaturday && ws === current ? <Badge tone="accent">Hoy toca</Badge> : null}
      />
      <div className="mb-4 flex justify-between text-sm">
        <Link href={`/reset?semana=${addDays(ws, -7)}`} className="text-muted hover:text-fg">
          ← Semana anterior
        </Link>
        {ws < current ? (
          <Link href={`/reset?semana=${addDays(ws, 7)}`} className="text-muted hover:text-fg">
            Siguiente →
          </Link>
        ) : null}
      </div>
      <div className="space-y-4">
        <Card>
          <CardTitle
            hint="Calculado con lo que registraste. No tienes que contestarlo."
            action={
              <div className="text-right">
                <p className="tabular text-2xl font-semibold">{pct}%</p>
                <p className="text-[11px] text-muted">consistencia</p>
              </div>
            }
          >
            Tu semana en números
          </CardTitle>
          <ul className="divide-y divide-border">
            {q("¿Cuántas noches dormí bien?", frac("sueno"))}
            {q("¿Cuántas veces entrené?", frac("ejercicio"))}
            {q("¿Cómo comí?", foodText)}
            {q("¿Cuántos días cumplí higiene?", frac("higiene"))}
            {q("¿Cuántas sesiones de inglés?", frac("ingles"))}
            {q("¿Cuántas sesiones de filmmaking?", frac("filmmaking"))}
            {q("¿Cuántos videos publiqué?", byKey.contenido?.done ?? 0)}
            {q("¿Cuánto leí?", `${byKey.lectura?.done ?? 0} páginas`)}
            {q("¿Cuántas veces medité?", frac("meditacion"))}
          </ul>
        </Card>

        <Card>
          <CardTitle hint={outputMessage(wl)}>Aprendizaje · output &gt; consumo</CardTitle>
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-success-soft py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-success">Output</p>
              <p className="tabular text-lg font-semibold">{wl.applied + produced.length}</p>
            </div>
            <div className="rounded-xl bg-surface-2 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Práctica</p>
              <p className="tabular text-lg font-semibold">{hrs(wl.practiceMin)}</p>
            </div>
            <div className="rounded-xl bg-surface-2 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Consumo</p>
              <p className="tabular text-lg font-semibold">{hrs(wl.learnMin)}</p>
            </div>
          </div>
          <ul className="divide-y divide-border">
            {q("¿Qué habilidad practiqué?", practicedNames.length ? practicedNames.slice(0, 4).join(", ") + (practicedNames.length > 4 ? "…" : "") : "—")}
            {q("¿Cuántas horas aprendí?", hrs(wl.learnMin))}
            {q("¿Cuántas horas practiqué?", hrs(wl.practiceMin))}
            {q("¿Qué produje?", produced.length ? produced.slice(0, 3).join(", ") : wl.applied ? `${wl.applied} aplicaciones` : "—")}
          </ul>
        </Card>

        <Card>
          <CardTitle>Mecatrónica e idiomas</CardTitle>
          <ul className="divide-y divide-border">
            {q("Mechatronics sessions", mx.sessions)}
            {q("Practice time", hrs(mx.practice))}
            {q("Skill practiced", mx.skills.length ? mx.skills.slice(0, 3).join(", ") + (mx.skills.length > 3 ? "…" : "") : "—")}
            {q("Project progress", (activeLab as { title?: string } | null)?.title ?? "Sin proyecto activo")}
            {q("Primary language", lang.primary.join(", ") || "—")}
            {q("Speaking", hrs(lang.speaking))}
            {q("Listening", hrs(lang.listening))}
            {q("Vocabulary review", lang.vocab ? `${lang.vocab} sesiones` : "—")}
          </ul>
        </Card>

        <Card>
          <CardTitle action={<Link href="/carrera" className="text-sm text-accent">Abrir</Link>}>Carrera</CardTitle>
          <ul className="divide-y divide-border">
            {q("Horas de servicio social", `${career.serviceHours} h`)}
            {q("Aplicaciones enviadas", career.applications)}
            {q("Preguntas de entrevista practicadas", career.practiced)}
          </ul>
        </Card>

        <Card>
          <CardTitle hint="Planeado vs. real. Solo datos, sin juicios.">Money scorecard</CardTitle>
          <ul className="divide-y divide-border">
            {q("¿Cuánto gané?", money(scorecard.earned))}
            {q("¿Cuánto gasté?", money(scorecard.spent))}
            {q("¿Cuánto ahorré?", money(scorecard.saved))}
            {q("¿Cuánto pagué de deuda?", money(scorecard.debtPaid))}
            {q("¿Cuánto aporté a metas?", money(scorecard.toGoals))}
            {q("¿Compré algo a MSI?", scorecard.msi.length ? scorecard.msi.join(", ") : "No")}
            {q("¿Cuánto cashback obtuve?", "Fase 2")}
            {q("¿Tomé dinero de algún sobre?", scorecard.tookFromBuckets ? money(scorecard.tookFromBuckets) : "No")}
            {q("¿Debo reponer dinero?", scorecard.toRepay ? money(scorecard.toRepay) : "No")}
            {q("¿Cuál es mi dinero libre actual?", scorecard.free != null ? money(scorecard.free) : "Sin plan esta semana")}
          </ul>
        </Card>

        <ReviewForm
          groups={groups}
          key={ws}
          weekStart={ws}
          snapshot={snapshot}
          review={review}
          detectedWins={wins}
          toAdjust={adjust.map((m) => m.label)}
          suggestions={suggestions}
        />

        {(pastRes.data ?? []).length > 0 ? (
          <Card>
            <CardTitle>Semanas anteriores</CardTitle>
            <ul className="divide-y divide-border">
              {(pastRes.data ?? []).map((r) => (
                <li key={r.week_start}>
                  <Link href={`/reset?semana=${r.week_start}`} className="-mx-2 flex justify-between rounded-xl px-2 py-2.5 text-sm hover:bg-surface-2">
                    <span>Semana del {formatShort(r.week_start)}</span>
                    <span className="tabular text-muted">
                      {typeof (r.metrics as { percent?: number })?.percent === "number"
                        ? `${(r.metrics as { percent: number }).percent}%`
                        : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </>
  );
}
