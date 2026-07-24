import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/hooks/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const Route = createFileRoute("/_authenticated/ops")({
  head: () => ({
    meta: [
      { title: "Ops Health — Lead Accelerator" },
      {
        name: "description",
        content:
          "Pipeline health for the Asendia Lead Accelerator: API status, ECDB credit balance and monthly scoring runs.",
      },
    ],
  }),
  component: OpsPage,
});

type OpsRow = {
  id: string;
  event_type: string;
  run_at: string;
  run_status: string;
  api_status: Record<string, string> | null;
  ecdb_credit_balance: number | null;
  ecdb_coverage_pct: number | null;
  engine_version: string | null;
  leads_processed: number | null;
  gated_count: number | null;
  sql_count: number | null;
  mql_count: number | null;
  discarded_count: number | null;
  write_errors: number | null;
  duration_seconds: number | null;
  credits_consumed: Record<string, number> | null;
  market: string | null;
};

const nf = new Intl.NumberFormat("en-US");
const dash = (v: number | string | null | undefined) =>
  v === null || v === undefined || v === "" ? "—" : v;

function fmtDuration(s: number | null | undefined) {
  if (s == null) return "—";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m} min`;
}

function fmtRelative(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const day = 86_400_000;
  const abs = Math.abs(diff);
  if (abs < 60_000) return "just now";
  if (abs < 3_600_000) return `${Math.round(abs / 60_000)}m ago`;
  if (abs < day) return `${Math.round(abs / 3_600_000)}h ago`;
  if (abs < 2 * day) return "yesterday";
  if (abs < 7 * day) return `${Math.round(abs / day)}d ago`;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function OpsPage() {
  const { accountId, account } = useActiveAccount();

  const { data: healthchecks, isLoading: loadingHc } = useQuery({
    queryKey: ["ops_log", "healthcheck", accountId],
    enabled: !!accountId,
    queryFn: async (): Promise<OpsRow[]> => {
      const { data, error } = await supabase
        .from("ops_log")
        .select("*")
        .eq("account_id", accountId!)
        .eq("event_type", "healthcheck")
        .order("run_at", { ascending: false })
        .limit(2);
      if (error) throw error;
      return (data ?? []) as unknown as OpsRow[];
    },
  });

  const { data: runs, isLoading: loadingRuns } = useQuery({
    queryKey: ["ops_log", "run_summary", accountId],
    enabled: !!accountId,
    queryFn: async (): Promise<OpsRow[]> => {
      const { data, error } = await supabase
        .from("ops_log")
        .select("*")
        .eq("account_id", accountId!)
        .eq("event_type", "run_summary")
        .order("run_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data ?? []) as unknown as OpsRow[];
    },
  });

  const latestHc = healthchecks?.[0];
  const prevHc = healthchecks?.[1];
  const latestRun = runs?.[0];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="p-8">
        <header className="mb-8">
          <div className="text-xs font-semibold uppercase tracking-widest text-primary">
            {account?.name ?? "Account"}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Ops Health</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pipeline status, ECDB credit balance and monthly scoring runs.
          </p>
        </header>

        {/* 1. System status strip */}
        <section className="mb-6">
          <SystemStatus latest={latestHc} loading={loadingHc} />
        </section>

        {/* 2 + 3. ECDB credits + Last run */}
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <EcdbCard latest={latestHc} previous={prevHc} run={latestRun} loading={loadingHc || loadingRuns} />
          <div className="lg:col-span-2">
            <LastRunCard run={latestRun} loading={loadingRuns} />
          </div>
        </div>

        {/* 4. Run history */}
        <RunHistory rows={runs ?? []} loading={loadingRuns} />
      </div>
    </TooltipProvider>
  );
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? "").toLowerCase();
  const map: Record<string, string> = {
    success: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
    ok: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
    warning: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    warn: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    error: "bg-destructive/10 text-destructive border-destructive/30",
    failed: "bg-destructive/10 text-destructive border-destructive/30",
  };
  const cls = map[s] ?? "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={`${cls} font-medium capitalize`}>
      {status ?? "—"}
    </Badge>
  );
}

function ApiChip({ name, value }: { name: string; value: string }) {
  const ok = value.toLowerCase() === "ok";
  const label = name.charAt(0).toUpperCase() + name.slice(1);
  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
        ok
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-amber-500/40 bg-amber-500/5"
      }`}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          ok ? "bg-emerald-500" : "bg-amber-500"
        }`}
      />
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground">
        {ok ? "Operational" : value}
      </span>
    </div>
  );
}

function SystemStatus({
  latest,
  loading,
}: {
  latest: OpsRow | undefined;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            System status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!latest) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            System status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            <Activity className="h-4 w-4" />
            Health monitoring activates with the daily pipeline check.
          </div>
        </CardContent>
      </Card>
    );
  }

  const stale =
    Date.now() - new Date(latest.run_at).getTime() > 48 * 3_600_000;
  const entries = Object.entries(latest.api_status ?? {});

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          System status
        </CardTitle>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs text-muted-foreground">
              Last checked: {fmtRelative(latest.run_at)}
            </span>
          </TooltipTrigger>
          <TooltipContent>{new Date(latest.run_at).toUTCString()}</TooltipContent>
        </Tooltip>
      </CardHeader>
      <CardContent className="space-y-3">
        {stale && (
          <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            No recent health data — last check {fmtDate(latest.run_at)}.
          </div>
        )}
        {entries.length === 0 ? (
          <div className="text-sm text-muted-foreground">No API statuses reported.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {entries.map(([k, v]) => (
              <ApiChip key={k} name={k} value={String(v)} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EcdbCard({
  latest,
  previous,
  run,
  loading,
}: {
  latest: OpsRow | undefined;
  previous: OpsRow | undefined;
  run: OpsRow | undefined;
  loading: boolean;
}) {
  const bal = latest?.ecdb_credit_balance ?? null;
  const low = bal != null && bal < 10_000;
  const delta =
    bal != null && previous?.ecdb_credit_balance != null
      ? bal - previous.ecdb_credit_balance
      : null;

  const consumptionEntries = run?.credits_consumed
    ? Object.entries(run.credits_consumed)
    : [];
  const labelFor = (k: string) => {
    const map: Record<string, string> = { ecdb: "ECDB", zoominfo: "ZoomInfo" };
    return map[k.toLowerCase()] ?? k.charAt(0).toUpperCase() + k.slice(1);
  };

  return (
    <Card className={low ? "border-amber-500/40 bg-amber-500/5" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          API credits
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            ECDB balance
          </div>
          {loading ? (
            <Skeleton className="mt-1 h-9 w-32" />
          ) : bal != null ? (
            <div
              className={`mt-0.5 text-4xl font-semibold tracking-tight tabular-nums ${
                low ? "text-amber-700" : ""
              }`}
            >
              {nf.format(bal)}
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Balance available after the first daily check.
            </p>
          )}
          {!loading && low && (
            <p className="mt-2 text-xs text-amber-800">
              Below the 10,000 alert threshold — top-up recommended before the next
              monthly run (~1,150 credits per full run).
            </p>
          )}
          {!loading && delta != null && (
            <p className="mt-2 text-xs text-muted-foreground tabular-nums">
              {delta === 0
                ? "No change since last check"
                : `${delta > 0 ? "+" : "−"}${nf.format(Math.abs(delta))} since ${
                    previous ? fmtRelative(previous.run_at) : "last check"
                  }`}
            </p>
          )}
        </div>

        <div className="border-t border-border pt-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Consumption · latest run
          </div>
          {loading ? (
            <Skeleton className="mt-2 h-5 w-40" />
          ) : consumptionEntries.length > 0 ? (
            <>
              <div className="mt-1 text-sm font-medium tabular-nums">
                {consumptionEntries
                  .map(([k, v]) => `${labelFor(k)}: ${nf.format(Number(v))}`)
                  .join(" · ")}
              </div>
              {run?.leads_processed != null && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {nf.format(run.leads_processed)} companies processed
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              No runs recorded yet.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  danger,
}: {
  label: string;
  value: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-0.5 text-lg font-semibold tabular-nums ${
          danger ? "text-destructive" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function LastRunCard({
  run,
  loading,
}: {
  run: OpsRow | undefined;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!run) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Latest scoring run
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            First scoring run pending — runs execute on the 1st of each month.
          </div>
        </CardContent>
      </Card>
    );
  }

  const credits = run.credits_consumed
    ? Object.entries(run.credits_consumed)
        .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)} ${nf.format(Number(v))}`)
        .join(" · ")
    : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-sm font-medium">
            Latest scoring run
          </CardTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="mt-1 text-xs text-muted-foreground">
                {fmtDate(run.run_at)} · engine {dash(run.engine_version)}
                {run.market ? ` · ${run.market}` : ""}
              </p>
            </TooltipTrigger>
            <TooltipContent>{new Date(run.run_at).toUTCString()}</TooltipContent>
          </Tooltip>
        </div>
        <StatusBadge status={run.run_status} />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-4">
          <Metric label="Processed" value={dash(run.leads_processed != null ? nf.format(run.leads_processed) : null)} />
          <Metric label="ECDB coverage" value={run.ecdb_coverage_pct != null ? `${run.ecdb_coverage_pct}%` : "—"} />
          <Metric label="SQL" value={dash(run.sql_count)} />
          <Metric label="MQL" value={dash(run.mql_count)} />
          <Metric label="Discarded" value={dash(run.discarded_count)} />
          <Metric label="Manual review" value={dash(run.gated_count)} />
          <Metric
            label="Write errors"
            value={dash(run.write_errors)}
            danger={(run.write_errors ?? 0) > 0}
          />
          <Metric label="Duration" value={fmtDuration(run.duration_seconds)} />
        </div>
        {credits && (
          <div className="border-t border-border pt-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Credits consumed:</span>{" "}
            {credits}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RunHistory({ rows, loading }: { rows: OpsRow[]; loading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Run history
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            No scoring runs recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Engine</TableHead>
                  <TableHead className="text-right">Processed</TableHead>
                  <TableHead className="text-right">Coverage</TableHead>
                  <TableHead className="text-right">SQL</TableHead>
                  <TableHead className="text-right">MQL</TableHead>
                  <TableHead className="text-right">Discarded</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>{fmtDate(r.run_at)}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {new Date(r.run_at).toUTCString()}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {dash(r.engine_version)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.leads_processed != null ? nf.format(r.leads_processed) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.ecdb_coverage_pct != null ? `${r.ecdb_coverage_pct}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{dash(r.sql_count)}</TableCell>
                    <TableCell className="text-right tabular-nums">{dash(r.mql_count)}</TableCell>
                    <TableCell className="text-right tabular-nums">{dash(r.discarded_count)}</TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${
                        (r.write_errors ?? 0) > 0 ? "text-destructive font-medium" : ""
                      }`}
                    >
                      {dash(r.write_errors)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.run_status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
