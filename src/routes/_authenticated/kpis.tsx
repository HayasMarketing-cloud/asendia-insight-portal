import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  ReferenceLine,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/hooks/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { daysSince, formatLondon } from "@/lib/lead-presentation";

export const Route = createFileRoute("/_authenticated/kpis")({
  head: () => ({
    meta: [
      { title: "Conversion KPIs — Lead Accelerator" },
      {
        name: "description",
        content:
          "Conversion KPIs for the Asendia Lead Accelerator: SQL/MQL rates, ECDB coverage, score histogram and funnel.",
      },
    ],
  }),
  component: KpisPage,
});

type Kpi = {
  sql_count: number | null;
  mql_count: number | null;
  manual_count: number | null;
  discarded_count: number | null;
  high_intent_count: number | null;
  ecdb_covered_count: number | null;
  total_leads: number | null;
  coverage_rate_pct: number | null;
  avg_score: number | null;
};

type OpsRun = {
  run_at: string;
  sql_count: number | null;
  mql_count: number | null;
  ecdb_coverage_pct: number | null;
};

function KpisPage() {
  const { accountId, account } = useActiveAccount();

  const kpiQ = useQuery({
    queryKey: ["kpi_summary", accountId],
    enabled: !!accountId,
    queryFn: async (): Promise<Kpi | null> => {
      const { data, error } = await supabase
        .from("kpi_summary")
        .select("*")
        .eq("account_id", accountId!)
        .maybeSingle();
      if (error) throw error;
      return data as Kpi | null;
    },
  });

  const scoresQ = useQuery({
    queryKey: ["kpi_scores", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("score_total")
        .eq("account_id", accountId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.score_total as number | null);
    },
  });

  const runsQ = useQuery({
    queryKey: ["kpi_runs", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ops_log")
        .select("run_at, sql_count, mql_count, ecdb_coverage_pct")
        .eq("account_id", accountId!)
        .eq("event_type", "run_summary")
        .order("run_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as OpsRun[];
    },
  });

  const kpi = kpiQ.data;
  const loading = kpiQ.isLoading || scoresQ.isLoading || runsQ.isLoading;

  const total = kpi?.total_leads ?? null;
  const pct = (n: number | null | undefined) =>
    n == null || !total ? null : Math.round((Number(n) / Number(total)) * 100);

  const runs = runsQ.data ?? [];
  const latestRun = runs.length ? runs[runs.length - 1] : null;
  const staleDays = latestRun ? daysSince(latestRun.run_at) : null;
  const stale = staleDays != null && staleDays > 35;
  const noRuns = !loading && runs.length === 0;

  // Score histogram bins 0..130, width 10.
  const histogram = useMemo(() => {
    const scores = (scoresQ.data ?? []).filter(
      (s): s is number => s != null,
    );
    const bins: { bin: string; from: number; to: number; count: number }[] = [];
    for (let i = 0; i < 130; i += 10) {
      bins.push({
        bin: `${i}-${i + 10}`,
        from: i,
        to: i + 10,
        count: 0,
      });
    }
    scores.forEach((s) => {
      const idx = Math.min(bins.length - 1, Math.max(0, Math.floor(Number(s) / 10)));
      bins[idx].count += 1;
    });
    return bins;
  }, [scoresQ.data]);

  // Funnel: Scored = non-null score_total (sql+mql+discarded), then MQL, then SQL.
  // Manual review is a parallel lane.
  const funnel = useMemo(() => {
    const sql = Number(kpi?.sql_count ?? 0);
    const mql = Number(kpi?.mql_count ?? 0);
    const discarded = Number(kpi?.discarded_count ?? 0);
    const scored = sql + mql + discarded;
    return [
      { stage: "Scored", count: scored },
      { stage: "MQL", count: mql },
      { stage: "SQL", count: sql },
    ];
  }, [kpi]);

  const manualLane = Number(kpi?.manual_count ?? 0);

  const monthly = useMemo(() => {
    return runs.map((r) => ({
      label:
        formatLondon(r.run_at, {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }) ?? r.run_at,
      run_at: r.run_at,
      SQL: r.sql_count ?? 0,
      MQL: r.mql_count ?? 0,
      Coverage: r.ecdb_coverage_pct == null ? null : Number(r.ecdb_coverage_pct),
    }));
  }, [runs]);

  return (
    <div className="p-8">
      <header className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-widest text-primary">
          {account?.name ?? "Account"}
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Conversion KPIs
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Latest scoring run — {latestRun ? formatLondon(latestRun.run_at) : "—"}.
        </p>
      </header>

      {stale && (
        <div className="mb-6 flex items-center gap-2 rounded-md border border-chart-4/40 bg-chart-4/5 p-3 text-sm text-chart-4">
          <AlertTriangle className="h-4 w-4" />
          Data may be out of date — last run was {staleDays} days ago
        </div>
      )}

      {kpiQ.error && (
        <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {(kpiQ.error as Error).message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total companies scored"
          primary={total}
          loading={loading}
        />
        <KpiCard
          label="SQL"
          primary={kpi?.sql_count}
          secondary={pct(kpi?.sql_count) != null ? `${pct(kpi?.sql_count)}%` : null}
          loading={loading}
          accent="primary"
        />
        <KpiCard
          label="MQL"
          primary={kpi?.mql_count}
          secondary={pct(kpi?.mql_count) != null ? `${pct(kpi?.mql_count)}%` : null}
          loading={loading}
        />
        <KpiCard
          label="Discarded"
          primary={kpi?.discarded_count}
          secondary={
            pct(kpi?.discarded_count) != null
              ? `${pct(kpi?.discarded_count)}%`
              : null
          }
          loading={loading}
        />
        <ManualReviewCard
          count={kpi?.manual_count}
          percent={pct(kpi?.manual_count)}
          loading={loading}
        />
        <KpiCard
          label="ECDB coverage"
          primary={
            kpi?.coverage_rate_pct != null
              ? `${Math.round(Number(kpi.coverage_rate_pct))}%`
              : null
          }
          secondary={
            kpi?.ecdb_covered_count != null && total
              ? `${kpi.ecdb_covered_count} of ${total}`
              : null
          }
          loading={loading}
        />
        <KpiCard
          label="Average score"
          primary={
            kpi?.avg_score != null ? Number(kpi.avg_score).toFixed(1) : null
          }
          secondary="Scale 0–130"
          loading={loading}
        />
        <KpiCard
          label="High-intent overrides"
          primary={kpi?.high_intent_count}
          loading={loading}
          accent="warm"
        />
      </div>

      {noRuns && (
        <div className="mt-8 rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
          No data yet — the first run is scheduled for the 1st of the month
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Score distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histogram} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="bin" fontSize={10} tickLine={false} />
                    <YAxis fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                    <RTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0].payload as (typeof histogram)[number];
                        return (
                          <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md">
                            <div className="font-medium">Score {p.bin}</div>
                            <div className="text-muted-foreground">{p.count} leads</div>
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine
                      x="40-50"
                      stroke="hsl(var(--chart-4))"
                      strokeDasharray="4 4"
                      label={{ value: "40", fontSize: 10, fill: "hsl(var(--chart-4))", position: "top" }}
                    />
                    <ReferenceLine
                      x="70-80"
                      stroke="hsl(var(--chart-2))"
                      strokeDasharray="4 4"
                      label={{ value: "70", fontSize: 10, fill: "hsl(var(--chart-2))", position: "top" }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Reference lines mark the MQL (40) and SQL (70) thresholds.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="flex h-64 items-end gap-6">
                <div className="flex flex-1 items-end gap-2">
                  {funnel.map((f) => (
                    <FunnelBar
                      key={f.stage}
                      label={f.stage}
                      count={f.count}
                      max={Math.max(1, funnel[0].count, manualLane)}
                      colorClass="bg-primary"
                    />
                  ))}
                </div>
                <div className="mx-2 h-full w-px bg-border" />
                <div className="flex flex-1 items-end">
                  <FunnelBar
                    label="Manual review"
                    count={manualLane}
                    max={Math.max(1, funnel[0].count, manualLane)}
                    colorClass="bg-chart-4"
                    hint="parallel lane"
                  />
                </div>
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Scored = leads with a score. Manual review runs in parallel — not a
              stage of the funnel.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Monthly evolution</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : monthly.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No runs yet — the first run is scheduled for the 1st of the month
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthly} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="label" fontSize={10} tickLine={false} />
                    <YAxis yAxisId="left" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 100]}
                      unit="%"
                      width={36}
                    />
                    <RTooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="SQL"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="MQL"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="Coverage"
                      stroke="hsl(var(--chart-4))"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  primary,
  secondary,
  loading,
  accent,
}: {
  label: string;
  primary: number | string | null | undefined;
  secondary?: string | null;
  loading?: boolean;
  accent?: "primary" | "warm";
}) {
  const accentClass =
    accent === "primary"
      ? "text-primary"
      : accent === "warm"
        ? "text-chart-4"
        : "";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div
            className={`text-3xl font-semibold tracking-tight tabular-nums ${accentClass}`}
          >
            {primary == null || primary === "" ? "—" : primary}
          </div>
        )}
        {secondary && (
          <p className="mt-1 text-xs text-muted-foreground">{secondary}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ManualReviewCard({
  count,
  percent,
  loading,
}: {
  count: number | null | undefined;
  percent: number | null;
  loading?: boolean;
}) {
  return (
    <Card className="border-chart-4/40 bg-chart-4/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-chart-4">
          Manual review
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="text-3xl font-semibold tracking-tight tabular-nums text-chart-4">
            {count == null ? "—" : count}
            {percent != null && (
              <span className="ml-2 text-base font-normal text-chart-4/80">
                {percent}%
              </span>
            )}
          </div>
        )}
        <p className="mt-1 text-xs text-chart-4/80">
          More than half of the target isn't covered by ECDB — these need human
          review
        </p>
      </CardContent>
    </Card>
  );
}

function FunnelBar({
  label,
  count,
  max,
  colorClass,
  hint,
}: {
  label: string;
  count: number;
  max: number;
  colorClass: string;
  hint?: string;
}) {
  const heightPct = max > 0 ? Math.max(6, (count / max) * 100) : 6;
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-end gap-2">
      <div className="text-sm font-semibold tabular-nums">{count}</div>
      <div
        className={`${colorClass} w-full rounded-t-md`}
        style={{ height: `${heightPct}%` }}
      />
      <div className="text-center text-xs">
        <div className="font-medium">{label}</div>
        {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
}
