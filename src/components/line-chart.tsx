/**
 * Gráfica de línea simple (una serie), SVG puro renderizado en servidor.
 * Línea 2px, marcadores 8px, grid recesivo, tooltip nativo por punto.
 */
export function LineChart({
  points,
  unit = "",
  height = 160,
  label,
}: {
  points: { x: string; y: number; tip?: string }[];
  unit?: string;
  height?: number;
  label: string;
}) {
  if (points.length === 0) return null;
  const W = 600;
  const H = height;
  const pad = { l: 36, r: 12, t: 12, b: 24 };
  const ys = points.map((p) => p.y);
  let min = Math.min(...ys);
  let max = Math.max(...ys);
  if (min === max) {
    min = Math.max(0, min - 5);
    max = max + 5;
  }
  const span = max - min;
  min = Math.max(0, min - span * 0.1);
  max = max + span * 0.1;
  const x = (i: number) =>
    points.length === 1 ? (pad.l + W - pad.r) / 2 : pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  const ticks = [min, (min + max) / 2, max];
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ");
  const labelIdx = new Set([0, points.length - 1, Math.floor((points.length - 1) / 2)]);

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
              {Math.round(t)}
            </text>
          </g>
        ))}
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.y)} r={4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
            <circle cx={x(i)} cy={y(p.y)} r={14} fill="transparent">
              <title>{p.tip ?? `${p.x}: ${p.y}${unit}`}</title>
            </circle>
            {labelIdx.has(i) ? (
              <text x={x(i)} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">
                {p.x}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </figure>
  );
}
