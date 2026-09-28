import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Mail, Phone } from "lucide-react";
import { getContext } from "@/lib/session";
import { addDays, formatLong, formatShort, weekStart } from "@/lib/dates";
import { INTERVIEW_CATEGORIES, JOB_STATUSES, STAGES, hoursInRange, serviceProjection, stageLabel } from "@/lib/career";
import { LEVELS } from "@/lib/skills";
import { Badge, Card, CardTitle, EmptyState, PageHeader, ProgressBar, Stat, TabLinks } from "@/components/ui";
import { ConfirmButton } from "@/components/forms";
import {
  AddTaskForm,
  CareerSettingsForm,
  ContactForm,
  DocumentActions,
  DocumentForm,
  EditJob,
  JobForm,
  PracticeButton,
  QuestionForm,
  ServiceForm,
  StageStatusSelect,
  TaskList,
} from "./career-client";
import { deleteContact, deleteDocument, deleteJob, deleteQuestion, deleteServiceLog, touchContact } from "./actions";

export const metadata: Metadata = { title: "Carrera" };

const TABS = [
  { key: "resumen", label: "Resumen" },
  { key: "servicio", label: "Servicio social" },
  { key: "pendientes", label: "Pendientes" },
  { key: "documentos", label: "Documentos" },
  { key: "contactos", label: "Contactos" },
  { key: "empleo", label: "Empleo" },
  { key: "entrevistas", label: "Entrevistas" },
];

type Settings = {
  required_hours: number;
  prior_hours: number;
  institution: string | null;
  program: string | null;
  supervisor: string | null;
  service_start: string | null;
  target_end: string | null;
};

export default async function CareerPage(props: PageProps<"/carrera">) {
  const ctx = await getContext();
  const sp = await props.searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as string) : "resumen";
  const ws = weekStart(ctx.today);

  const [{ data: settingsRow }, { data: stagesRows }, { data: logsRows }, { data: tasksRows }, { data: docsRows }, { data: contactsRows }, { data: jobsRows }, { data: qRows }] =
    await Promise.all([
      ctx.supabase.from("career_settings").select("*").maybeSingle(),
      ctx.supabase.from("career_stages").select("*"),
      ctx.supabase.from("service_logs").select("*").order("log_date", { ascending: false }),
      ctx.supabase.from("career_tasks").select("*").order("sort_order").order("created_at"),
      ctx.supabase.from("career_documents").select("*").order("created_at", { ascending: false }),
      ctx.supabase.from("career_contacts").select("*").order("name"),
      ctx.supabase.from("job_applications").select("*").order("updated_at", { ascending: false }),
      ctx.supabase.from("interview_questions").select("*, skills(name)").order("created_at", { ascending: false }),
    ]);
  const settings: Settings = (settingsRow as Settings | null) ?? {
    required_hours: 480,
    prior_hours: 0,
    institution: null,
    program: null,
    supervisor: null,
    service_start: null,
    target_end: null,
  };
  const stages = new Map(((stagesRows ?? []) as { key: string; status: string }[]).map((s) => [s.key, s.status]));
  const logs = (logsRows ?? []) as { id: string; log_date: string; hours: number; activity: string | null; validated: boolean }[];
  const tasks = (tasksRows ?? []) as { id: string; stage_key: string; title: string; done: boolean; due_date: string | null }[];
  const docs = (docsRows ?? []) as { id: string; stage_key: string; name: string; status: string; due_date: string | null; file_path: string | null; file_name: string | null; url: string | null }[];
  const contacts = (contactsRows ?? []) as { id: string; name: string; role: string | null; organization: string | null; email: string | null; phone: string | null; stage_key: string | null; last_contact: string | null; notes: string | null }[];
  type JobRow = { id: string; company: string; position: string; location: string | null; url: string | null; status: string; applied_on: string | null; next_step: string | null; next_date: string | null; contact: string | null; salary_range: string | null; language: string | null; notes: string | null };
  const jobs = (jobsRows ?? []) as JobRow[];
  const questions = (qRows ?? []) as { id: string; category: string; question: string; my_answer: string | null; improved_answer: string | null; skill_id: string | null; difficulty: number; practiced_count: number; last_practiced: string | null; skills: { name: string } | null }[];

  const proj = serviceProjection({ required: settings.required_hours, prior: settings.prior_hours, logs, today: ctx.today, targetEnd: settings.target_end });
  const weekHours = hoursInRange(logs, ws, addDays(ws, 6));
  const validatedHours = logs.filter((l) => l.validated).reduce((s, l) => s + Number(l.hours), 0) + Number(settings.prior_hours);
  const currentStage = STAGES.find((s) => stages.get(s.key) !== "completado");
  const nextTask = tasks.find((t) => !t.done && t.stage_key === currentStage?.key);

  // Próximas fechas: pendientes, documentos y siguientes pasos de vacantes (14 días)
  const horizon = addDays(ctx.today, 14);
  const upcoming = [
    ...tasks.filter((t) => !t.done && t.due_date).map((t) => ({ date: t.due_date!, title: t.title, sub: stageLabel(t.stage_key), href: "/carrera?tab=pendientes" })),
    ...docs.filter((d) => d.status !== "listo" && d.due_date).map((d) => ({ date: d.due_date!, title: d.name, sub: "Documento", href: "/carrera?tab=documentos" })),
    ...jobs.filter((j) => j.next_date && !["rechazada", "descartada", "aceptada"].includes(j.status)).map((j) => ({ date: j.next_date!, title: `${j.company}: ${j.next_step ?? "seguimiento"}`, sub: "Empleo", href: "/carrera?tab=empleo" })),
  ]
    .filter((u) => u.date <= horizon)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  // Material para CV / portafolio (lo que ya tiene evidencia)
  let cvMaterial: { projects: { id: string; title: string; visibility: string }[]; skills: { id: string; name: string; level: number }[] } | null = null;
  if (tab === "resumen" && ["cv", "linkedin", "portafolio", "empleo", "repaso"].includes(currentStage?.key ?? "")) {
    const [{ data: p }, { data: s }] = await Promise.all([
      ctx.supabase.from("skill_projects").select("id,title,visibility").eq("domain", "engineering").eq("status", "terminado"),
      ctx.supabase.from("skills").select("id,name,level").gte("level", 3).order("level", { ascending: false }).limit(20),
    ]);
    cvMaterial = { projects: (p ?? []) as { id: string; title: string; visibility: string }[], skills: (s ?? []) as { id: string; name: string; level: number }[] };
  }

  const skillsOpt =
    tab === "entrevistas"
      ? (((await ctx.supabase.from("skills").select("id,name, skill_categories!inner(domain)").eq("archived", false).in("skill_categories.domain", ["engineering", "languages", "business"]).order("name")).data ?? []) as { id: string; name: string }[]).map((s) => ({ id: s.id, label: s.name }))
      : [];

  const activeJobs = jobs.filter((j) => !["rechazada", "descartada"].includes(j.status));

  return (
    <>
      <PageHeader title="Carrera" subtitle="Servicio social → titulación → competencia → CV → empleo." />
      <TabLinks active={tab} tabs={TABS.map((t) => ({ ...t, href: `/carrera?tab=${t.key}` }))} />

      {tab === "resumen" ? (
        <div className="space-y-4">
          <Card>
            <CardTitle action={<span className="tabular text-2xl font-semibold">{proj.percent}%</span>}>Servicio social</CardTitle>
            <ProgressBar value={proj.done} max={Number(settings.required_hours)} tone="success" />
            <p className="tabular mt-2 text-sm text-muted">
              {proj.done} de {Number(settings.required_hours)} h · faltan {proj.remaining} h
            </p>
            <Link href="/carrera?tab=servicio" className="mt-3 inline-flex items-center text-sm font-medium text-accent">
              Registrar horas <ChevronRight size={15} />
            </Link>
          </Card>

          <Card>
            <CardTitle hint={nextTask ? `Siguiente: ${nextTask.title}` : undefined}>Pipeline</CardTitle>
            <ol className="space-y-1">
              {STAGES.map((s, i) => {
                const status = stages.get(s.key) ?? "pendiente";
                const st = tasks.filter((t) => t.stage_key === s.key);
                const done = st.filter((t) => t.done).length;
                return (
                  <li key={s.key} className={`flex items-center justify-between gap-3 rounded-xl px-2 py-2 ${currentStage?.key === s.key ? "bg-surface-2" : ""}`}>
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                          status === "completado" ? "bg-success text-bg" : status === "en_curso" ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted ring-1 ring-border"
                        }`}
                      >
                        {status === "completado" ? "✓" : i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-medium">{s.label}</p>
                        <p className="truncate text-xs text-muted">
                          {st.length ? `${done}/${st.length} hechos · ` : ""}
                          {s.related ? (
                            <Link href={s.related.href} className="text-accent">
                              {s.related.label}
                            </Link>
                          ) : (
                            s.hint
                          )}
                        </p>
                      </div>
                    </div>
                    <StageStatusSelect stage={s.key} status={status} />
                  </li>
                );
              })}
            </ol>
          </Card>

          <Card>
            <CardTitle hint="Pendientes, documentos y vacantes. Recordatorio dentro de la app.">Próximas fechas</CardTitle>
            {upcoming.length ? (
              <ul className="divide-y divide-border">
                {upcoming.map((u, i) => (
                  <li key={i}>
                    <Link href={u.href} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[15px]">{u.title}</p>
                        <p className="text-xs text-muted">{u.sub}</p>
                      </div>
                      <Badge tone={u.date < ctx.today ? "warn" : u.date === ctx.today ? "accent" : "neutral"}>
                        {u.date < ctx.today ? "Vencido · " : ""}
                        {formatShort(u.date)}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nada en los próximos 14 días.</p>
            )}
          </Card>

          <Card>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Vacantes activas" value={activeJobs.length} />
              <Stat label="Aplicadas" value={jobs.filter((j) => j.applied_on).length} />
              <Stat label="Preguntas practicadas" value={questions.filter((q) => q.practiced_count > 0).length} />
            </div>
          </Card>

          {cvMaterial ? (
            <Card>
              <CardTitle hint="Lo que ya tiene evidencia y puedes poner en tu CV y portafolio.">Material para tu CV</CardTitle>
              {cvMaterial.projects.length || cvMaterial.skills.length ? (
                <div className="space-y-3 text-sm">
                  {cvMaterial.projects.length ? (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-faint">Proyectos terminados</p>
                      <ul className="space-y-1">
                        {cvMaterial.projects.map((p) => (
                          <li key={p.id} className="flex justify-between gap-2">
                            <Link href={`/mecatronica/lab/${p.id}`} className="hover:underline">
                              {p.title}
                            </Link>
                            <span className="text-muted">{p.visibility === "public" ? "Público" : "Privado"}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {cvMaterial.skills.length ? (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-faint">Skills en Practicando o más</p>
                      <div className="flex flex-wrap gap-1">
                        {cvMaterial.skills.map((s) => (
                          <Badge key={s.id}>
                            {s.name} · {LEVELS[s.level].label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted">Termina proyectos del Lab y registra evidencia; aparecerán aquí.</p>
              )}
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "servicio" ? (
        <div className="space-y-4">
          <Card>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Stat label="Completadas" value={`${proj.done} h`} sub={`de ${Number(settings.required_hours)} h`} />
              <Stat label="Faltan" value={`${proj.remaining} h`} />
              <Stat label="Esta semana" value={`${weekHours} h`} />
              <Stat label="Ritmo (4 semanas)" value={`${proj.avgWeekly} h/sem`} />
              <Stat label="Al ritmo actual" value={proj.estimatedEnd ? formatShort(proj.estimatedEnd) : "—"} sub={proj.estimatedEnd ? "fecha estimada" : "registra horas para estimar"} />
              <Stat label="Para tu meta" value={proj.weeklyNeeded != null ? `${proj.weeklyNeeded} h/sem` : "—"} sub={settings.target_end ? formatShort(settings.target_end) : "define una meta"} />
            </div>
            <ProgressBar value={proj.done} max={Number(settings.required_hours)} tone="success" className="mt-4" />
            <p className="tabular mt-1 text-xs text-muted">{Math.round(validatedHours * 10) / 10} h firmadas / reconocidas</p>
          </Card>
          <Card>
            <CardTitle>Registrar horas</CardTitle>
            <ServiceForm today={ctx.today} />
            <p className="mt-2 text-xs text-muted">También marca tu hábito &quot;Avance servicio/titulación&quot; de ese día.</p>
          </Card>
          <Card>
            <CardTitle>Historial</CardTitle>
            {logs.length === 0 ? (
              <EmptyState title="Sin horas registradas" />
            ) : (
              <ul className="divide-y divide-border">
                {logs.slice(0, 60).map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[15px]">
                        <span className="tabular font-medium">{Number(l.hours)} h</span> · {formatShort(l.log_date)}
                      </p>
                      {l.activity ? <p className="truncate text-xs text-muted">{l.activity}</p> : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {l.validated ? <Badge tone="success">Firmada</Badge> : null}
                      <ConfirmButton action={deleteServiceLog.bind(null, l.id)} confirmText="¿Eliminar este registro de horas?">
                        ✕
                      </ConfirmButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <details className="rounded-2xl border border-border bg-surface p-4">
            <summary className="cursor-pointer text-sm font-medium">Datos del servicio social</summary>
            <div className="mt-4">
              <CareerSettingsForm s={settings} />
            </div>
          </details>
        </div>
      ) : null}

      {tab === "pendientes" ? (
        <div className="space-y-4">
          <p className="px-1 text-sm text-muted">Los requisitos exactos dependen de tu universidad; ajusta la lista a lo que te pidan.</p>
          {STAGES.map((s) => {
            const st = tasks.filter((t) => t.stage_key === s.key);
            return (
              <Card key={s.key}>
                <CardTitle action={<StageStatusSelect stage={s.key} status={stages.get(s.key) ?? "pendiente"} />}>{s.label}</CardTitle>
                {st.length ? <TaskList key={st.map((t) => t.id + t.done).join()} tasks={st} /> : <p className="mb-2 text-sm text-muted">Sin pendientes.</p>}
                <div className="mt-3">
                  <AddTaskForm stage={s.key} />
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}

      {tab === "documentos" ? (
        <div className="space-y-4">
          <Card>
            <CardTitle hint="Se guardan en tu carpeta privada. Solo tú puedes abrirlos.">Nuevo documento</CardTitle>
            <DocumentForm userId={ctx.userId} />
          </Card>
          {docs.length === 0 ? (
            <EmptyState title="Sin documentos todavía" />
          ) : (
            STAGES.map((s) => {
              const list = docs.filter((d) => d.stage_key === s.key);
              if (!list.length) return null;
              return (
                <Card key={s.key}>
                  <CardTitle>{s.label}</CardTitle>
                  <ul className="divide-y divide-border">
                    {list.map((d) => (
                      <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-medium">{d.name}</p>
                          <p className="truncate text-xs text-muted">
                            {d.file_name ?? (d.url ? "Link" : "Sin archivo")}
                            {d.due_date ? ` · límite ${formatShort(d.due_date)}` : ""}
                          </p>
                          {d.url ? (
                            <a href={d.url} target="_blank" rel="noreferrer" className="text-xs text-accent">
                              Abrir link ↗
                            </a>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1">
                          <DocumentActions id={d.id} status={d.status} hasFile={!!d.file_path} />
                          <ConfirmButton action={deleteDocument.bind(null, d.id)} confirmText="¿Eliminar este documento y su archivo?">
                            ✕
                          </ConfirmButton>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })
          )}
        </div>
      ) : null}

      {tab === "contactos" ? (
        <div className="space-y-4">
          {contacts.map((c) => (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-sm text-muted">
                    {[c.role, c.organization].filter(Boolean).join(" · ") || "—"}
                    {c.stage_key ? ` · ${stageLabel(c.stage_key)}` : ""}
                  </p>
                </div>
                <ConfirmButton action={deleteContact.bind(null, c.id)} confirmText="¿Eliminar este contacto?">
                  ✕
                </ConfirmButton>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {c.email ? (
                  <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-accent">
                    <Mail size={14} /> {c.email}
                  </a>
                ) : null}
                {c.phone ? (
                  <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-accent">
                    <Phone size={14} /> {c.phone}
                  </a>
                ) : null}
              </div>
              {c.notes ? <p className="mt-2 text-sm text-muted">{c.notes}</p> : null}
              <div className="mt-2 flex items-center justify-between text-xs text-muted">
                <span>Último contacto: {c.last_contact ? formatShort(c.last_contact) : "—"}</span>
                <ConfirmButton action={touchContact.bind(null, c.id)} confirmText="¿Registrar contacto de hoy?" className="text-accent hover:bg-accent-soft">
                  Contacté hoy
                </ConfirmButton>
              </div>
            </Card>
          ))}
          <Card>
            <CardTitle>Nuevo contacto</CardTitle>
            <ContactForm />
          </Card>
        </div>
      ) : null}

      {tab === "empleo" ? (
        <div className="space-y-4">
          <Card>
            <CardTitle>Nueva vacante</CardTitle>
            <JobForm />
          </Card>
          {jobs.length === 0 ? (
            <EmptyState title="Sin vacantes todavía">Empieza con tu lista de 20 empresas objetivo.</EmptyState>
          ) : (
            JOB_STATUSES.map((st) => {
              const list = jobs.filter((j) => j.status === st.value);
              if (!list.length) return null;
              return (
                <Card key={st.value}>
                  <CardTitle action={<span className="tabular text-sm text-muted">{list.length}</span>}>{st.label}</CardTitle>
                  <ul className="divide-y divide-border">
                    {list.map((j) => (
                      <li key={j.id} className="py-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium">{j.position}</p>
                            <p className="text-sm text-muted">
                              {j.company}
                              {j.location ? ` · ${j.location}` : ""}
                              {j.language === "en" ? " · en inglés" : j.language === "de" ? " · en alemán" : ""}
                            </p>
                            {j.next_step || j.next_date ? (
                              <p className="text-xs text-accent">
                                {j.next_step ?? "Seguimiento"}
                                {j.next_date ? ` · ${formatLong(j.next_date)}` : ""}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex gap-1">
                            <EditJob job={j} />
                            <ConfirmButton action={deleteJob.bind(null, j.id)} confirmText="¿Eliminar esta vacante?">
                              ✕
                            </ConfirmButton>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })
          )}
        </div>
      ) : null}

      {tab === "entrevistas" ? (
        <div className="space-y-4">
          <Card>
            <CardTitle hint="Escribe tu respuesta, luego una versión mejorada. Entender, no memorizar.">Interview Lab</CardTitle>
            <QuestionForm skills={skillsOpt} />
          </Card>
          {INTERVIEW_CATEGORIES.map((c) => {
            const list = questions.filter((q) => q.category === c.value);
            if (!list.length) return null;
            return (
              <Card key={c.value}>
                <CardTitle>{c.label}</CardTitle>
                <ul className="divide-y divide-border">
                  {list.map((q) => (
                    <li key={q.id} className="py-3">
                      <details>
                        <summary className="cursor-pointer text-[15px] font-medium">{q.question}</summary>
                        <div className="mt-3 space-y-2 text-sm">
                          {q.my_answer ? (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">Mi respuesta</p>
                              <p className="whitespace-pre-line">{q.my_answer}</p>
                            </div>
                          ) : null}
                          {q.improved_answer ? (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">Mejorada</p>
                              <p className="whitespace-pre-line">{q.improved_answer}</p>
                            </div>
                          ) : null}
                          <details className="rounded-xl bg-surface-2 p-3">
                            <summary className="cursor-pointer text-sm font-medium text-accent">Editar</summary>
                            <div className="mt-3">
                              <QuestionForm q={q} skills={skillsOpt} />
                            </div>
                          </details>
                        </div>
                      </details>
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
                        <span>
                          {q.skills?.name ? `${q.skills.name} · ` : ""}
                          {q.practiced_count ? `practicada ${q.practiced_count}×` : "sin practicar"}
                          {q.last_practiced ? ` · ${formatShort(q.last_practiced)}` : ""}
                        </span>
                        <span className="flex gap-1">
                          <PracticeButton id={q.id} />
                          <ConfirmButton action={deleteQuestion.bind(null, q.id)} confirmText="¿Eliminar esta pregunta?">
                            ✕
                          </ConfirmButton>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
