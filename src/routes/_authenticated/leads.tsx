import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  AlertTriangle,
  ExternalLink,
  Zap,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/hooks/useProfile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { SparkPoint } from "@/components/portal/Sparkline";
import {
  STATUS_LABELS,
  INTL_MATURITY_LABELS,
  GROWTH_LABELS,
  INTENT_LABELS,
  ICP_LABELS,
  ICP_SHORT_LABELS,
  TRIGGER_LABELS,
  labelFor,
  scoreBand,
  scoreBandClass,
  scoreBandTextClass,
  dataBadgeFor,
  formatLondon,
  daysSince,
} from "@/lib/lead-presentation";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({
    meta: [
      { title: "Lead Ranking — Lead Accelerator" },
      {
        name: "description",
        content:
          "Ranked list of scored companies from the Asendia Lead Accelerator, with score bar, trend and signal badges.",
      },
    ],
  }),
  component: LeadRankingPage,
});

type Lead = {
  id: string;
  company_name: string;
  domain: string | null;
  status: string;
  data_source: string | null;
  review_state: string | null;
  asendia_icp_segment: string | null;
  score_total: number | null;
  score_breakdown: string | null;
  score_last_calculated_at: string | null;
  high_intent_override: boolean | null;
  missing_ecdb: boolean | null;
  international_maturity: string | null;
  growth_momentum: string | null;
  buyer_intent_signals: string | null;
  intl_revenue_share: number | null;
  countries_with_revenue: number | null;
  gmv: number | null;
  gmv_growth_yoy_pct: number | null;
  orders_annual: number | null;
  sugarcrm_url: string | null;
  review_reason: string | null;
  firmographics: Record<string, unknown> | null;
};

type SortKey = "company_name" | "score_total" | "status" | "asendia_icp_segment";
type SortDir = "asc" | "desc";

const STATUS_OPTIONS = ["sql", "mql", "manual_review", "discarded", "excluded"] as const;
const ICP_OPTIONS = ["icp1", "icp2", "icp3", "out"] as const;
const INTL_OPTIONS = ["established_icp1", "icp2", "growing", "starting_icp3"] as const;
const DATA_SOURCE_OPTIONS = ["ecdb", "provisional", "manual"] as const;

function statusBadgeClass(status: string) {
  switch (status) {
    case "sql":
      return "bg-primary/15 text-primary border-primary/30";
    case "mql":
      return "bg-chart-2/15 text-chart-2 border-chart-2/30";
    case "manual_review":
      return "bg-chart-4/15 text-chart-4 border-chart-4/40";
    case "discarded":
      return "bg-muted text-muted-foreground border-border";
    case "excluded":
      // Neutral slate — an excluded lead is a good lead handled elsewhere.
      return "bg-secondary text-secondary-foreground border-border";
    default:
      return "";
  }
}

function dataBadgeClass(tone: "verified" | "confirmed" | "review" | "none") {
  switch (tone) {
    case "verified":
      return "bg-chart-2/15 text-chart-2 border-chart-2/30";
    case "confirmed":
      return "bg-primary/15 text-primary border-primary/30";
    case "review":
      return "bg-chart-4/15 text-chart-4 border-chart-4/40";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

/**
 * Status badge. For "excluded" leads (good leads worked through another
 * channel) a tooltip surfaces the pipeline's full review_reason.
 */
function StatusBadge({
  status,
  reviewReason,
  label,
}: {
  status: string;
  reviewReason: string | null;
  label?: string;
}) {
  const text = label ?? STATUS_LABELS[status] ?? status;
  const badge = (
    <Badge variant="outline" className={statusBadgeClass(status)}>
      {text}
    </Badge>
  );
  if (status !== "excluded") return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{badge}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        {reviewReason ?? text}
      </TooltipContent>
    </Tooltip>
  );
}



function LeadRankingPage() {
  const { accountId, account } = useActiveAccount();
  // Default: exclude manual_review, discarded AND excluded (all reachable via filter).
  const [statusFilter, setStatusFilter] = useState<string>("default");
  const [icpFilter, setIcpFilter] = useState<string>("all");
  const [intlFilter, setIntlFilter] = useState<string>("all");
  const [dataFilter, setDataFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("score_total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["leads", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const res = await supabase
        .from("leads")
        .select(
          "id, company_name, domain, status, data_source, review_state, asendia_icp_segment, score_total, score_breakdown, score_last_calculated_at, high_intent_override, missing_ecdb, international_maturity, growth_momentum, buyer_intent_signals, intl_revenue_share, countries_with_revenue, gmv, gmv_growth_yoy_pct, orders_annual, sugarcrm_url, review_reason, firmographics",
        )
        .eq("account_id", accountId!)
        .order("score_total", { ascending: false, nullsFirst: false });
      if (res.error) throw res.error;
      return res.data as Lead[];
    },
  });

  const manualReviewCount = useMemo(
    () => (data ?? []).filter((r) => r.status === "manual_review").length,
    [data],
  );

  const filtered = useMemo(() => {
    let rows = data ?? [];
    if (statusFilter === "default") {
      rows = rows.filter(
        (r) =>
          r.status !== "manual_review" &&
          r.status !== "discarded" &&
          r.status !== "excluded",
      );
    } else if (statusFilter !== "all") {
      rows = rows.filter((r) => r.status === statusFilter);
    }
    if (icpFilter !== "all")
      rows = rows.filter((r) => r.asendia_icp_segment === icpFilter);
    if (intlFilter !== "all")
      rows = rows.filter((r) => r.international_maturity === intlFilter);
    if (dataFilter !== "all")
      rows = rows.filter((r) => r.data_source === dataFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.company_name.toLowerCase().includes(q) ||
          (r.domain ?? "").toLowerCase().includes(q),
      );
    }
    const sorted = [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      // Nulls last for score_total regardless of direction.
      if (sortKey === "score_total") {
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return sortDir === "asc"
          ? (av as number) - (bv as number)
          : (bv as number) - (av as number);
      }
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const as = String(av);
      const bs = String(bv);
      return sortDir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
    });
    return sorted;
  }, [data, statusFilter, icpFilter, intlFilter, dataFilter, search, sortKey, sortDir]);

  const selected = useMemo(
    () =>
      selectedId ? (data ?? []).find((l) => l.id === selectedId) ?? null : null,
    [selectedId, data],
  );

  // Batched history: one query for all visible leads' domains.
  const visibleDomains = useMemo(
    () =>
      Array.from(
        new Set(filtered.map((l) => l.domain).filter((d): d is string => !!d)),
      ),
    [filtered],
  );

  const { data: history } = useQuery({
    queryKey: ["lead_score_history", accountId, visibleDomains.join(",")],
    enabled: !!accountId && visibleDomains.length > 0,
    queryFn: async () => {
      const res = await supabase
        .from("lead_score_history")
        .select(
          "domain, recorded_at, score_total, engine_version, trigger_source",
        )
        .eq("account_id", accountId!)
        .in("domain", visibleDomains)
        .order("recorded_at", { ascending: true });
      if (res.error) throw res.error;
      return res.data as Array<{
        domain: string;
        recorded_at: string;
        score_total: number | null;
        engine_version: string | null;
        trigger_source: string | null;
      }>;
    },
  });

  const historyByDomain = useMemo(() => {
    const map = new Map<string, SparkPoint[]>();
    (history ?? []).forEach((r) => {
      const arr = map.get(r.domain) ?? [];
      arr.push({
        recorded_at: r.recorded_at,
        score_total: r.score_total,
        engine_version: r.engine_version,
        trigger_source: r.trigger_source,
      });
      map.set(r.domain, arr);
    });
    return map;
  }, [history]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir(key === "score_total" ? "desc" : "asc");
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="p-8">
        <header className="mb-6">
          <div className="text-xs font-semibold uppercase tracking-widest text-primary">
            {account?.name ?? "Account"}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Lead Ranking
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Scored companies from the latest run, ranked by total score.
          </p>
        </header>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search company or domain…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[190px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Ranked (SQL + MQL)</SelectItem>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={icpFilter} onValueChange={setIcpFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="ICP" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ICP</SelectItem>
              {ICP_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {ICP_SHORT_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={intlFilter} onValueChange={setIntlFilter}>
            <SelectTrigger className="w-[190px]">
              <SelectValue placeholder="Intl. maturity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All intl. maturity</SelectItem>
              {INTL_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {INTL_MATURITY_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dataFilter} onValueChange={setDataFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Data source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All data sources</SelectItem>
              {DATA_SOURCE_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "ecdb"
                    ? "ECDB"
                    : s === "provisional"
                      ? "Provisional"
                      : "Manual"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex flex-col items-end text-sm">
            <span className="tabular-nums text-muted-foreground">
              {isLoading ? "Loading…" : `${filtered.length} leads`}
            </span>
            {!isLoading && manualReviewCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {manualReviewCount} leads in manual review
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {(error as Error).message}
          </div>
        )}

        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead
                  label="Company"
                  active={sortKey === "company_name"}
                  dir={sortDir}
                  onClick={() => toggleSort("company_name")}
                />
                <SortableHead
                  label="Score"
                  active={sortKey === "score_total"}
                  dir={sortDir}
                  onClick={() => toggleSort("score_total")}
                />
                <TableHead>Trend</TableHead>
                <SortableHead
                  label="Status"
                  active={sortKey === "status"}
                  dir={sortDir}
                  onClick={() => toggleSort("status")}
                />
                <SortableHead
                  label="ICP"
                  active={sortKey === "asendia_icp_segment"}
                  dir={sortDir}
                  onClick={() => toggleSort("asendia_icp_segment")}
                />
                <TableHead>Intl. maturity</TableHead>
                <TableHead>Growth</TableHead>
                <TableHead>Intent</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>CRM sync</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={`sk-${i}`}>
                    <TableCell colSpan={11}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No leads match the current filters.
                  </TableCell>
                </TableRow>
              )}
              {!isLoading &&
                filtered.map((lead) => {
                  const band = scoreBand(lead.score_total);
                  const dataInfo = dataBadgeFor(
                    lead.data_source,
                    lead.review_state,
                  );
                  const points = lead.domain
                    ? historyByDomain.get(lead.domain) ?? []
                    : [];
                  const days = daysSince(lead.score_last_calculated_at);
                  const stale = days != null && days > 40;
                  return (
                    <TableRow
                      key={lead.id}
                      onClick={() => setSelectedId(lead.id)}
                      className="cursor-pointer"
                    >
                      <TableCell>
                        <div className="font-medium">{lead.company_name}</div>
                        {lead.domain && (
                          <div className="text-xs text-muted-foreground">
                            {lead.domain}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="min-w-[160px]">
                        {lead.score_total == null ? (
                          <span className="text-xs italic text-muted-foreground">
                            Not scored — no cross-border data
                          </span>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-9 text-sm font-semibold tabular-nums ${scoreBandTextClass(band)}`}
                                >
                                  {Number(lead.score_total)}
                                </span>
                                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className={`h-full ${scoreBandClass(band)}`}
                                    style={{
                                      width: `${Math.min(100, (Number(lead.score_total) / 130) * 100)}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="font-mono text-xs">
                                {lead.score_breakdown ?? "No breakdown"}
                              </div>
                              <div className="mt-0.5 text-[10px] text-muted-foreground">
                                Scale 0–130
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell>
                        <TrendDelta points={points} currentScore={lead.score_total} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <StatusBadge
                            status={lead.status}
                            reviewReason={lead.review_reason}
                          />

                          {lead.high_intent_override && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Zap className="h-3.5 w-3.5 text-chart-4" />
                              </TooltipTrigger>
                              <TooltipContent>
                                High buyer intent — routed directly to sales
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {lead.asendia_icp_segment ? (
                          <Badge variant="secondary">
                            {ICP_SHORT_LABELS[lead.asendia_icp_segment] ??
                              lead.asendia_icp_segment}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {labelFor(INTL_MATURITY_LABELS, lead.international_maturity) ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {labelFor(GROWTH_LABELS, lead.growth_momentum) ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {labelFor(INTENT_LABELS, lead.buyer_intent_signals) ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={dataBadgeClass(dataInfo.tone)}
                        >
                          {dataInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {lead.score_last_calculated_at ? (
                          <div className="flex items-center gap-1">
                            <span>
                              {formatLondon(lead.score_last_calculated_at) ??
                                "—"}
                            </span>
                            {stale && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertTriangle className="h-3.5 w-3.5 text-chart-4" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  Score is {days} days old
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <CrmSyncCell
                          status={lead.status}
                          sugarcrmUrl={lead.sugarcrm_url}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>

        <Sheet
          open={!!selectedId}
          onOpenChange={(o) => !o && setSelectedId(null)}
        >
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            {selected && (
              <LeadDetail
                lead={selected}
                history={
                  selected.domain
                    ? historyByDomain.get(selected.domain) ?? []
                    : []
                }
              />
            )}
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}

function SortableHead({
  label,
  onClick,
  active,
  dir,
}: {
  label: string;
  onClick: () => void;
  active: boolean;
  dir: SortDir;
}) {
  return (
    <TableHead>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClick}
        className="-ml-2 h-7 gap-1 px-2 font-medium"
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </Button>
    </TableHead>
  );
}

function TrendDelta({
  points,
  currentScore,
}: {
  points: SparkPoint[];
  currentScore: number | null;
}) {
  if (currentScore == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  const scored = points
    .filter(
      (p): p is SparkPoint & { score_total: number } =>
        typeof p.score_total === "number" && Number.isFinite(p.score_total),
    )
    .sort(
      (a, b) =>
        new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
    );
  if (scored.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (scored.length === 1) {
    return (
      <span className="text-xs italic text-muted-foreground">First run</span>
    );
  }
  const latest = scored[scored.length - 1];
  const prev = scored[scored.length - 2];
  const delta = Math.round((latest.score_total - prev.score_total) * 10) / 10;
  const engineChanged =
    latest.engine_version != null &&
    prev.engine_version != null &&
    latest.engine_version !== prev.engine_version;

  const tooltip = (
    <TooltipContent>
      <div className="text-xs">
        Previous:{" "}
        <span className="font-medium tabular-nums">{prev.score_total}</span>
      </div>
      <div className="text-[10px] text-muted-foreground">
        {formatLondon(prev.recorded_at)}
      </div>
      {engineChanged && (
        <div className="mt-0.5 text-[10px] text-muted-foreground">
          Engine {prev.engine_version} → {latest.engine_version}
        </div>
      )}
    </TooltipContent>
  );

  if (delta === 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-sm text-muted-foreground">— no change</span>
        </TooltipTrigger>
        {tooltip}
      </Tooltip>
    );
  }
  const up = delta > 0;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center gap-0.5 text-sm font-medium tabular-nums ${
            up ? "text-chart-2" : "text-destructive"
          }`}
        >
          {up ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )}
          {up ? "+" : "−"}
          {Math.abs(delta).toFixed(1)}
        </span>
      </TooltipTrigger>
      {tooltip}
    </Tooltip>
  );
}

function CrmSyncCell({
  status,
  sugarcrmUrl,
}: {
  status: string;
  sugarcrmUrl: string | null;
}) {
  // MQL / discarded / manual_review are never routed to SugarCRM.
  if (status !== "sql") {
    return <span className="text-muted-foreground">—</span>;
  }
  // SQL: no explicit sync-status field exists yet. A URL implies Synced;
  // otherwise render "—" (do not simulate pending/error states).
  if (sugarcrmUrl) {
    return (
      <a
        href={sugarcrmUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1"
      >
        <Badge
          variant="outline"
          className="border-chart-2/40 bg-chart-2/10 text-chart-2 hover:bg-chart-2/15"
        >
          Synced
          <ExternalLink className="ml-1 h-3 w-3" />
        </Badge>
      </a>
    );
  }
  return <span className="text-muted-foreground">—</span>;
}

function LeadDetail({
  lead,
  history,
}: {
  lead: Lead;
  history: SparkPoint[];
}) {
  const band = scoreBand(lead.score_total);
  const dataInfo = dataBadgeFor(lead.data_source, lead.review_state);

  // Dedupe + sort timeline for chart, and detect engine changes.
  const timeline = useMemo(() => {
    const seen = new Set<string>();
    const rows = [...history]
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
    return rows.map((p, i) => {
      const prev = i > 0 ? rows[i - 1] : null;
      const engineChanged =
        prev != null &&
        p.engine_version != null &&
        prev.engine_version != null &&
        p.engine_version !== prev.engine_version;
      return {
        ...p,
        engineChanged,
        label: formatLondon(p.recorded_at, { month: "short", day: "2-digit" }) ?? p.recorded_at,
      };
    });
  }, [history]);

  return (
    <>
      <SheetHeader>
        <SheetTitle className="text-xl">{lead.company_name}</SheetTitle>
        <SheetDescription>
          {lead.domain ?? "No domain on file"}
        </SheetDescription>
      </SheetHeader>

      <div className="mt-6 space-y-6 px-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={statusBadgeClass(lead.status)}>
            {STATUS_LABELS[lead.status] ?? lead.status}
          </Badge>
          {lead.asendia_icp_segment && (
            <Badge variant="secondary">
              {ICP_LABELS[lead.asendia_icp_segment] ?? lead.asendia_icp_segment}
            </Badge>
          )}
          {lead.high_intent_override && (
            <Badge className="border border-chart-4/40 bg-chart-4/15 text-chart-4">
              <Zap className="mr-1 h-3 w-3" /> High buyer intent
            </Badge>
          )}
          <Badge variant="outline" className={dataBadgeClass(dataInfo.tone)}>
            {dataInfo.label}
          </Badge>
        </div>

        <section>
          <SectionTitle>Score</SectionTitle>
          <div className="mt-2 flex items-baseline gap-3">
            <div
              className={`text-4xl font-semibold tabular-nums ${scoreBandTextClass(band)}`}
            >
              {lead.score_total ?? "—"}
              <span className="text-base font-normal text-muted-foreground">
                /130
              </span>
            </div>
          </div>
          {lead.score_total != null && (
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full ${scoreBandClass(band)}`}
                style={{
                  width: `${Math.min(100, (Number(lead.score_total) / 130) * 100)}%`,
                }}
              />
            </div>
          )}
          {lead.score_breakdown && (
            <pre className="mt-3 whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs text-muted-foreground">
              {lead.score_breakdown}
            </pre>
          )}
          {lead.review_reason && (
            <div className="mt-3 rounded-md border border-chart-4/40 bg-chart-4/5 p-3 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-chart-4">
                Review reason
              </div>
              <div className="mt-1">{lead.review_reason}</div>
            </div>
          )}
        </section>

        <section>
          <SectionTitle>Layer signals</SectionTitle>
          <dl className="mt-2 grid grid-cols-2 gap-3">
            <Field
              label="International maturity"
              value={labelFor(INTL_MATURITY_LABELS, lead.international_maturity)}
            />
            <Field
              label="Growth momentum"
              value={labelFor(GROWTH_LABELS, lead.growth_momentum)}
            />
            <Field
              label="Buyer intent"
              value={labelFor(INTENT_LABELS, lead.buyer_intent_signals)}
            />
            <Field label="ICP segment" value={labelFor(ICP_LABELS, lead.asendia_icp_segment)} />
          </dl>
        </section>

        <section>
          <SectionTitle>ECDB signals</SectionTitle>
          <dl className="mt-2 grid grid-cols-2 gap-3">
            <Field
              label="Intl. revenue share"
              value={
                lead.intl_revenue_share != null
                  ? `${lead.intl_revenue_share}%`
                  : null
              }
            />
            <Field
              label="Countries with revenue"
              value={lead.countries_with_revenue}
            />
            <Field
              label="GMV"
              value={lead.gmv != null ? `€${Number(lead.gmv).toLocaleString()}` : null}
            />
            <Field
              label="GMV YoY growth"
              value={
                lead.gmv_growth_yoy_pct != null
                  ? `${lead.gmv_growth_yoy_pct}%`
                  : null
              }
            />
            <Field label="Annual orders" value={lead.orders_annual} />
            <Field
              label="Last scored"
              value={formatLondon(lead.score_last_calculated_at)}
            />
          </dl>
        </section>

        {lead.firmographics && Object.keys(lead.firmographics).length > 0 && (
          <section>
            <SectionTitle>Firmographics (ZoomInfo)</SectionTitle>
            <dl className="mt-2 grid grid-cols-2 gap-3">
              {Object.entries(lead.firmographics).map(([key, value]) => (
                <Field
                  key={key}
                  label={humanizeKey(key)}
                  value={formatFirmographicValue(value)}
                />
              ))}
            </dl>
          </section>
        )}

        <section>
          <SectionTitle>Score timeline</SectionTitle>
          {timeline.length === 0 && (
            <div className="mt-2 text-sm text-muted-foreground">
              No history yet
            </div>
          )}
          {timeline.length === 1 && (
            <div className="mt-2 text-sm">
              <span className="font-medium tabular-nums">
                {timeline[0].score_total}
              </span>
              <span className="ml-2 text-muted-foreground">
                on {timeline[0].label} · {timeline[0].engine_version ?? "—"}
              </span>
            </div>
          )}
          {timeline.length >= 2 && (
            <div className="mt-2 h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeline} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" fontSize={10} tickLine={false} />
                  <YAxis
                    domain={[0, 130]}
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                  />
                  <RTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as (typeof timeline)[number];
                      return (
                        <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md">
                          <div className="font-medium">
                            {p.label} · {p.score_total}
                          </div>
                          <div className="text-muted-foreground">
                            {p.engine_version ?? "—"} ·{" "}
                            {labelFor(TRIGGER_LABELS, p.trigger_source) ?? "—"}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score_total"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                  />
                  {timeline
                    .filter((p) => p.engineChanged)
                    .map((p) => (
                      <ReferenceDot
                        key={p.recorded_at}
                        x={p.label}
                        y={p.score_total ?? 0}
                        r={4}
                        fill="hsl(var(--chart-4))"
                        stroke="hsl(var(--background))"
                        strokeWidth={1}
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {lead.sugarcrm_url && (
          <a
            href={lead.sugarcrm_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            Open in SugarCRM <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">
        {value == null || value === "" ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function humanizeKey(key: string) {
  const map: Record<string, string> = {
    hq: "HQ",
    revenue_gbp: "Revenue (GBP)",
    revenue_usd: "Revenue (USD)",
    revenue_eur: "Revenue (EUR)",
  };
  if (map[key]) return map[key];
  return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatFirmographicValue(value: unknown): string | number | null {
  if (value == null) return null;
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
