import { useMemo } from "react";

export type SparkPoint = {
  recorded_at: string;
  score_total: number | null;
  engine_version: string | null;
  trigger_source: string | null;
};

type Props = {
  points: SparkPoint[];
  width?: number;
  height?: number;
  domainMax?: number;
};

/**
 * Compact sparkline for the leads table row. Marks points where engine_version
 * changed vs the previous point. Degrades gracefully: 1 point → dot; 0 → text.
 */
export function Sparkline({
  points,
  width = 96,
  height = 28,
  domainMax = 130,
}: Props) {
  const sorted = useMemo(() => {
    // Dedupe on (recorded_at) — retry artefacts share timestamps.
    const seen = new Set<string>();
    const rows = [...points]
      .filter((p) => p.score_total != null)
      .sort(
        (a, b) =>
          new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
      )
      .filter((p) => {
        if (seen.has(p.recorded_at)) return false;
        seen.add(p.recorded_at);
        return true;
      });
    return rows;
  }, [points]);

  if (sorted.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">No history yet</span>
    );
  }

  if (sorted.length === 1) {
    return (
      <div
        className="flex items-center gap-1.5"
        title={`${sorted[0].score_total} · ${sorted[0].engine_version ?? ""}`}
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
        <span className="text-xs tabular-nums text-muted-foreground">
          {sorted[0].score_total}
        </span>
      </div>
    );
  }

  const pad = 3;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const n = sorted.length;
  const xs = sorted.map((_, i) => pad + (i * w) / (n - 1));
  const ys = sorted.map((p) => {
    const v = Math.max(0, Math.min(domainMax, p.score_total ?? 0));
    return pad + h - (v / domainMax) * h;
  });

  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} />
      {sorted.map((p, i) => {
        const prev = i > 0 ? sorted[i - 1] : null;
        const engineChanged =
          prev != null &&
          p.engine_version != null &&
          prev.engine_version != null &&
          p.engine_version !== prev.engine_version;
        return (
          <circle
            key={p.recorded_at + i}
            cx={xs[i]}
            cy={ys[i]}
            r={engineChanged ? 2.75 : 1.75}
            className={
              engineChanged
                ? "fill-chart-4 stroke-background"
                : "fill-current stroke-background"
            }
            strokeWidth={engineChanged ? 1 : 0}
          >
            <title>
              {new Date(p.recorded_at).toISOString().slice(0, 10)} · {p.score_total} ·{" "}
              {p.engine_version ?? ""}
            </title>
          </circle>
        );
      })}
    </svg>
  );
}
