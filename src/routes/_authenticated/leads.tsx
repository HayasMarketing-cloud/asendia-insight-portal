import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({
    meta: [
      { title: "Lead Ranking — Lead Accelerator" },
      {
        name: "description",
        content:
          "Ranked list of scored leads from the Asendia Lead Accelerator, with status and ICP filters.",
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
  asendia_icp_segment: string | null;
  asendia_region: string | null;
  score_total: number | null;
  score_confidence: string;
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
};

type SortKey = "company_name" | "score_total" | "status" | "asendia_icp_segment";
type SortDir = "asc" | "desc";

const STATUS_OPTIONS = ["sql", "mql", "manual_review", "discard"] as const;
const ICP_OPTIONS = ["icp1", "icp2", "icp3", "out"] as const;

const STATUS_LABELS: Record<string, string> = {
  sql: "SQL",
  mql: "MQL",
  manual_review: "Manual review",
  discard: "Discard",
};

const ICP_LABELS: Record<string, string> = {
  icp1: "ICP 1",
  icp2: "ICP 2",
  icp3: "ICP 3",
  out: "Out",
};

function statusBadgeClass(status: string) {
  switch (status) {
    case "sql":
      return "bg-primary/15 text-primary border-primary/30";
    case "mql":
      return "bg-chart-2/15 text-chart-2 border-chart-2/30";
    case "manual_review":
      return "bg-chart-4/15 text-chart-4 border-chart-4/40";
    case "discard":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "";
  }
}

function LeadRankingPage() {
  const { accountId, account } = useActiveAccount();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [icpFilter, setIcpFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("score_total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["leads", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(
          "id, company_name, domain, status, asendia_icp_segment, asendia_region, score_total, score_confidence, score_breakdown, score_last_calculated_at, high_intent_override, missing_ecdb, international_maturity, growth_momentum, buyer_intent_signals, intl_revenue_share, countries_with_revenue, gmv, gmv_growth_yoy_pct, orders_annual, sugarcrm_url, review_reason",
        )
        .eq("account_id", accountId!)
        .order("score_total", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as Lead[];
    },
  });

  const filtered = useMemo(() => {
    let rows = data ?? [];
    if (statusFilter !== "all") rows = rows.filter((r) => r.status === statusFilter);
    if (icpFilter !== "all")
      rows = rows.filter((r) => r.asendia_icp_segment === icpFilter);
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
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const as = String(av);
      const bs = String(bv);
      return sortDir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
    });
    return sorted;
  }, [data, statusFilter, icpFilter, search, sortKey, sortDir]);

  const selected = useMemo(
    () => (selectedId ? filtered.find((l) => l.id === selectedId) ?? null : null),
    [selectedId, filtered],
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir(key === "score_total" ? "desc" : "asc");
    }
  };

  return (
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
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={icpFilter} onValueChange={setIcpFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="ICP segment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ICP segments</SelectItem>
            {ICP_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {ICP_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto text-sm text-muted-foreground tabular-nums">
          {isLoading ? "Loading…" : `${filtered.length} leads`}
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
              <TableHead>Region</TableHead>
              <SortableHead
                label="Score"
                align="right"
                active={sortKey === "score_total"}
                dir={sortDir}
                onClick={() => toggleSort("score_total")}
              />
              <TableHead>Signals</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No leads match the current filters.
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              filtered.map((lead) => (
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
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={statusBadgeClass(lead.status)}
                    >
                      {STATUS_LABELS[lead.status] ?? lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {lead.asendia_icp_segment ? (
                      <Badge variant="secondary">
                        {ICP_LABELS[lead.asendia_icp_segment] ??
                          lead.asendia_icp_segment}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {lead.asendia_region ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="font-semibold tabular-nums">
                      {lead.score_total ?? "—"}
                    </div>
                    {lead.score_confidence === "proxy" && (
                      <div className="text-[10px] uppercase tracking-wider text-chart-4">
                        proxy
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {lead.high_intent_override && (
                        <Badge className="bg-chart-4/15 text-chart-4 border-chart-4/40 border">
                          High intent
                        </Badge>
                      )}
                      {lead.missing_ecdb && (
                        <Badge variant="outline" className="text-muted-foreground">
                          Missing ECDB
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <Sheet
        open={!!selectedId}
        onOpenChange={(o) => !o && setSelectedId(null)}
      >
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && <LeadDetail lead={selected} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SortableHead({
  label,
  onClick,
  active,
  dir,
  align,
}: {
  label: string;
  onClick: () => void;
  active: boolean;
  dir: SortDir;
  align?: "right";
}) {
  return (
    <TableHead className={align === "right" ? "text-right" : ""}>
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

function LeadDetail({ lead }: { lead: Lead }) {
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
              {ICP_LABELS[lead.asendia_icp_segment]}
            </Badge>
          )}
          {lead.high_intent_override && (
            <Badge className="border border-chart-4/40 bg-chart-4/15 text-chart-4">
              High-intent override
            </Badge>
          )}
          {lead.score_confidence === "proxy" && (
            <Badge variant="outline">Proxy scoring</Badge>
          )}
        </div>

        <section>
          <SectionTitle>Score</SectionTitle>
          <div className="mt-2 flex items-baseline gap-3">
            <div className="text-4xl font-semibold tabular-nums">
              {lead.score_total ?? "—"}
              <span className="text-base font-normal text-muted-foreground">
                /130
              </span>
            </div>
          </div>
          {lead.score_breakdown && (
            <pre className="mt-3 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs text-muted-foreground">
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
            <Field label="International maturity (L1)" value={lead.international_maturity} />
            <Field label="Growth momentum (L2)" value={lead.growth_momentum} />
            <Field label="Buyer intent (L3)" value={lead.buyer_intent_signals} />
            <Field label="Region" value={lead.asendia_region} />
          </dl>
        </section>

        <section>
          <SectionTitle>Firmographics</SectionTitle>
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
              value={
                lead.gmv != null
                  ? `€${lead.gmv.toLocaleString()}`
                  : null
              }
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
              value={
                lead.score_last_calculated_at
                  ? new Date(lead.score_last_calculated_at).toLocaleDateString()
                  : null
              }
            />
          </dl>
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
