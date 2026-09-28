import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Clapperboard, Compass, Cpu, GraduationCap, Languages, RotateCcw, Settings, Sparkles, Trophy, UserRound } from "lucide-react";
import { Badge, Card, CardTitle, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Más" };

const LINKS = [
  { href: "/carrera", label: "Carrera", sub: "Servicio social, titulación, CV, empleo e Interview Lab", icon: GraduationCap },
  { href: "/skills", label: "Skills", sub: "Skill tree, evidencia, rutas y proyectos", icon: Sparkles },
  { href: "/mecatronica", label: "Mechatronics Academy", sub: "Knowledge Map, Lab y sesiones de estudio", icon: Cpu },
  { href: "/idiomas", label: "Idiomas", sub: "English primary · alemán y otros en Future", icon: Languages },
  { href: "/enfoque", label: "Focus Seasons", sub: "Qué compite por tu calendario esta temporada", icon: Compass },
  { href: "/perfil", label: "Knowledge Profile", sub: "Lo que sabes, con evidencia", icon: UserRound },
  { href: "/monse", label: "Monse × DAZN", sub: "Campañas, producciones, calendario y portafolio", icon: Trophy },
  { href: "/contenido", label: "Content Studio", sub: "Ideas, guiones y resultados · Luis y Monse", icon: Clapperboard },
  { href: "/reset", label: "Weekly Reset", sub: "Cierra la semana y elige 3 prioridades", icon: RotateCcw },
  { href: "/ajustes", label: "Ajustes", sub: "Horario, metas y apariencia", icon: Settings },
];

const ROADMAP = [
  { phase: "Fase 2", items: ["Vocabulary Bank con repetición espaciada y vocabulario técnico DE/EN/ES", "Troubleshooting Lab y Engineering Notebook", "Finanzas F2: beneficios, recompensas, mejor tarjeta, suscripciones, calendario"] },
  { phase: "Fase 3", items: ["Trabajo · Chilli Wings: turnos, incidencias, checklists"] },
  { phase: "Fase 4", items: ["Cuerpo: peso, cintura, fotos de progreso", "Barbería y cuidado personal con fotos", "Mente: libros, journal, gratitud, visión → acción", "Analíticas y gráficas avanzadas"] },
];

export default function MorePage() {
  return (
    <>
      <PageHeader title="Más" />
      <div className="space-y-4">
        <Card className="p-2 md:p-2">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-surface-2">
              <span className="grid size-9 place-items-center rounded-xl bg-surface-2">
                <l.icon size={18} strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{l.label}</span>
                <span className="block truncate text-[13px] text-muted">{l.sub}</span>
              </span>
              <ChevronRight size={16} className="text-faint" />
            </Link>
          ))}
        </Card>
        <Card>
          <CardTitle hint="Aún no están construidos. Se agregarán módulo por módulo.">Próximamente</CardTitle>
          <div className="space-y-4">
            {ROADMAP.map((r) => (
              <div key={r.phase}>
                <Badge>{r.phase}</Badge>
                <ul className="mt-2 space-y-1 text-sm text-muted">
                  {r.items.map((i) => (
                    <li key={i}>· {i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
