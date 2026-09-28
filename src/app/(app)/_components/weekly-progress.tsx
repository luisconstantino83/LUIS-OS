import { Card, CardTitle, ProgressBar } from "@/components/ui";
import { bestMetric, consistencyMessage, metricRatio, overallPercent, type Metric } from "@/lib/progress";

export function WeeklyProgress({ metrics, daysElapsed }: { metrics: Metric[]; daysElapsed: number }) {
  const pct = overallPercent(metrics);
  const best = bestMetric(metrics);
  return (
    <Card>
      <CardTitle
        hint={consistencyMessage(pct, daysElapsed)}
        action={
          <div className="text-right">
            <p className="tabular text-2xl font-semibold tracking-tight">{pct}%</p>
            <p className="text-[11px] text-muted">consistencia</p>
          </div>
        }
      >
        Progreso semanal
      </CardTitle>
      <ul className="space-y-3">
        {metrics.map((m) => {
          const r = metricRatio(m);
          return (
            <li key={m.key} className="grid grid-cols-[92px_1fr_auto] items-center gap-3">
              <span className="text-sm">{m.label}</span>
              <ProgressBar value={m.done} max={m.target} tone={r >= 1 ? "success" : "accent"} />
              <span className="tabular min-w-14 text-right text-sm text-muted">
                {m.check ? (m.done >= m.target ? "✓" : "—") : `${m.done}/${m.target}`}
              </span>
            </li>
          );
        })}
      </ul>
      {best ? (
        <p className="mt-4 border-t border-border pt-3 text-sm text-muted">
          Lo más constante: <span className="font-medium text-fg">{best.label}</span>
        </p>
      ) : null}
    </Card>
  );
}
