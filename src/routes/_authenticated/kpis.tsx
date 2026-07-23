import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Flame,
  Layers,
  ListChecks,
  Percent,
  Target,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/hooks/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/kpis")({
  head: () => ({
    meta: [
      { title: "KPIs — Lead Accelerator" },
      {
        name: "description",
        content:
          "Summary KPIs for the Asendia Lead Accelerator: SQL, MQL, coverage rate and high-intent counts.",
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
  total_leads: number | null;
  coverage_rate_pct: number | null;
};

function KpisPage() {
  const { accountId, account } = useActiveAccount();

  const { data, isLoading, error } = useQuery({
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

  return (
    <div className="p-8">
      <header className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-widest text-primary">
          {account?.name ?? "Account"}
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">KPIs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lead Accelerator summary from the latest scoring run.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total leads"
          value={data?.total_leads}
          icon={Layers}
          loading={isLoading}
        />
        <KpiCard
          label="Coverage rate"
          value={
            data?.coverage_rate_pct != null
              ? `${data.coverage_rate_pct}%`
              : null
          }
          icon={Percent}
          loading={isLoading}
          hint="Share of leads scored with primary ECDB data"
        />
        <KpiCard
          label="SQL"
          value={data?.sql_count}
          icon={Target}
          loading={isLoading}
          accent="primary"
        />
        <KpiCard
          label="High-intent overrides"
          value={data?.high_intent_count}
          icon={Flame}
          loading={isLoading}
          accent="warm"
        />
        <KpiCard
          label="MQL"
          value={data?.mql_count}
          icon={CheckCircle2}
          loading={isLoading}
        />
        <KpiCard
          label="Manual review"
          value={data?.manual_count}
          icon={AlertCircle}
          loading={isLoading}
        />
        <KpiCard
          label="Discard"
          value={data?.discarded_count}
          icon={XCircle}
          loading={isLoading}
        />
        <KpiCard
          label="Routed (SQL + MQL)"
          value={
            data
              ? (data.sql_count ?? 0) + (data.mql_count ?? 0)
              : null
          }
          icon={ListChecks}
          loading={isLoading}
        />
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  loading,
  hint,
  accent,
}: {
  label: string;
  value: number | string | null | undefined;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  hint?: string;
  accent?: "primary" | "warm";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
        <Icon
          className={`h-4 w-4 ${
            accent === "primary"
              ? "text-primary"
              : accent === "warm"
                ? "text-chart-4"
                : "text-muted-foreground"
          }`}
        />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="text-3xl font-semibold tracking-tight tabular-nums">
            {value ?? "—"}
          </div>
        )}
        {hint && (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}
