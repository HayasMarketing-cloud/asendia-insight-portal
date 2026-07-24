import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount, useProfile } from "@/hooks/useProfile";
import { requestRescore } from "@/lib/rescore.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  scoreBand,
  scoreBandClass,
  scoreBandTextClass,
  formatLondon,
} from "@/lib/lead-presentation";

export const Route = createFileRoute("/_authenticated/manual-review")({
  head: () => ({
    meta: [
      { title: "Manual Review — Lead Accelerator" },
      {
        name: "description",
        content:
          "Reviewer queue for gated leads: capture international revenue signals and trigger a rescore.",
      },
    ],
  }),
  component: ManualReviewPage,
});

type QueueLead = {
  id: string;
  company_name: string;
  domain: string | null;
  status: string;
  data_source: string | null;
  review_state: string | null;
  review_notes: string | null;
  review_values: Record<string, unknown> | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  asendia_icp_segment: string | null;
  international_maturity: string | null;
  growth_momentum: string | null;
  buyer_intent_signals: string | null;
  score_total: number | null;
  score_breakdown: string | null;
  score_last_calculated_at: string | null;
  review_reason: string | null;
  ai_assist: Record<string, unknown> | null;
  firmographics: Record<string, unknown> | null;
};

type StateFilter =
  | "worklist"
  | "pending"
  | "in_review"
  | "confirmed"
  | "rejected"
  | "all";

const FILTER_OPTIONS: { value: StateFilter; label: string }[] = [
  { value: "worklist", label: "Worklist" },
  { value: "pending", label: "Pending" },
  { value: "in_review", label: "In review" },
  { value: "confirmed", label: "Confirmed" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

type NumericForm = {
  intl_revenue_share: string;
  countries_with_revenue: string;
};

function ManualReviewPage() {
  const { accountId, account } = useActiveAccount();
  const { data: profileData } = useProfile();
  const role = profileData?.profile?.role ?? null;
  const isAdmin = role === "admin" || role === "hayas_admin";

  const qc = useQueryClient();
  const rescoreFn = useServerFn(requestRescore);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StateFilter>("worklist");

  const queueQ = useQuery({
    queryKey: ["manual_review_queue", accountId, filter],
    enabled: !!accountId,
    queryFn: async (): Promise<QueueLead[]> => {
      let q = supabase
        .from("leads")
        .select(
          "id, company_name, domain, status, data_source, review_state, review_notes, review_values, reviewed_at, reviewed_by, asendia_icp_segment, international_maturity, growth_momentum, buyer_intent_signals, score_total, score_breakdown, score_last_calculated_at, review_reason, ai_assist, firmographics",
        )
        .eq("account_id", accountId!)
        .eq("status", "manual_review");

      if (filter === "worklist") {
        q = q.or("review_state.is.null,review_state.eq.in_review");
      } else if (filter === "pending") {
        q = q.is("review_state", null);
      } else if (filter === "in_review") {
        q = q.eq("review_state", "in_review");
      } else if (filter === "confirmed") {
        q = q.eq("review_state", "confirmed");
      } else if (filter === "rejected") {
        q = q.eq("review_state", "rejected");
      }

      const res = await q.order("company_name", { ascending: true });
      if (res.error) throw res.error;
      return (res.data ?? []) as QueueLead[];
    },
  });

  const queue = queueQ.data ?? [];
  const selected = useMemo(
    () => queue.find((l) => l.id === selectedId) ?? null,
    [queue, selectedId],
  );

  useEffect(() => {
    if (queue.length === 0) return;
    if (!selectedId || !queue.some((l) => l.id === selectedId)) {
      setSelectedId(queue[0].id);
    }
  }, [queue, selectedId]);

  return (
    <div className="flex h-screen flex-col p-8">
      <header className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-primary">
          {account?.name ?? "Account"}
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Manual Review
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gated leads awaiting reviewer input. Confirm writes the two-key
          review_values consumed by the rescore pipeline.
        </p>
      </header>

      {queueQ.error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {(queueQ.error as Error).message}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="min-h-0 overflow-y-auto rounded-lg border border-border bg-card">
          <div className="sticky top-0 z-10 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Queue
            </div>
            <div className="mt-0.5 text-sm tabular-nums">
              {queueQ.isLoading ? "Loading…" : `${queue.length} leads`}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                    filter === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {queueQ.isLoading &&
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border-b border-border p-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="mt-2 h-3 w-1/2" />
              </div>
            ))}
          {!queueQ.isLoading && queue.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No leads match this filter.
            </div>
          )}
          <ul>
            {queue.map((l) => {
              const active = l.id === selectedId;
              const band = scoreBand(l.score_total);
              return (
                <li key={l.id}>
                  <button
                    onClick={() => setSelectedId(l.id)}
                    className={`w-full border-b border-border px-4 py-3 text-left transition-colors ${
                      active ? "bg-primary/10" : "hover:bg-muted/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {l.company_name}
                        </div>
                        {l.domain && (
                          <div className="truncate text-xs text-muted-foreground">
                            {l.domain}
                          </div>
                        )}
                      </div>
                      <div
                        className={`shrink-0 text-sm font-semibold tabular-nums ${scoreBandTextClass(band)}`}
                      >
                        {l.score_total ?? "—"}
                      </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      {l.review_state === "in_review" && (
                        <Badge
                          variant="outline"
                          className="border-chart-4/40 bg-chart-4/10 text-[10px] text-chart-4"
                        >
                          In progress
                        </Badge>
                      )}
                      {l.review_state === "confirmed" && (
                        <Badge
                          variant="outline"
                          className="border-chart-2/40 bg-chart-2/10 text-[10px] text-chart-2"
                        >
                          Confirmed
                        </Badge>
                      )}
                      {l.review_state === "rejected" && (
                        <Badge
                          variant="outline"
                          className="border-destructive/40 bg-destructive/5 text-[10px] text-destructive"
                        >
                          Rejected
                        </Badge>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="min-h-0 overflow-y-auto rounded-lg border border-border bg-card p-6">
          {!selected && !queueQ.isLoading && (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              {queue.length === 0
                ? "Nothing to review right now."
                : "Select a lead from the queue."}
            </div>
          )}
          {selected && (
            <ReviewPanel
              key={selected.id}
              lead={selected}
              isAdmin={isAdmin}
              accountSlug={account?.slug ?? null}
              onSaved={() => {
                qc.invalidateQueries({
                  queryKey: ["manual_review_queue", accountId],
                });
              }}
              onRescoreComplete={() => {
                setSelectedId(null);
                qc.invalidateQueries({
                  queryKey: ["manual_review_queue", accountId],
                });
                qc.invalidateQueries({ queryKey: ["leads", accountId] });
              }}
              rescoreFn={rescoreFn}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function initialFormFromLead(lead: QueueLead): NumericForm {
  const rv = (lead.review_values ?? {}) as Record<string, unknown>;
  const share = rv.intl_revenue_share;
  const countries = rv.countries_with_revenue;
  return {
    intl_revenue_share:
      typeof share === "number" && Number.isFinite(share) ? String(share) : "",
    countries_with_revenue:
      typeof countries === "number" && Number.isFinite(countries)
        ? String(countries)
        : "",
  };
}

function parseIntlShare(raw: string): {
  value: number | null;
  error: string | null;
} {
  const t = raw.trim();
  if (t === "") return { value: null, error: "Required" };
  const n = Number(t);
  if (!Number.isFinite(n)) return { value: null, error: "Must be a number" };
  if (n < 0 || n > 100)
    return { value: null, error: "Must be between 0 and 100" };
  const rounded = Math.round(n * 10) / 10;
  return { value: rounded, error: null };
}

function parseCountries(raw: string): {
  value: number | null;
  error: string | null;
} {
  const t = raw.trim();
  if (t === "") return { value: null, error: "Required" };
  const n = Number(t);
  if (!Number.isFinite(n)) return { value: null, error: "Must be a number" };
  if (!Number.isInteger(n))
    return { value: null, error: "Must be a whole number" };
  if (n < 0) return { value: null, error: "Must be zero or more" };
  return { value: n, error: null };
}

function ReviewPanel({
  lead,
  isAdmin,
  accountSlug,
  onSaved,
  onRescoreComplete,
  rescoreFn,
}: {
  lead: QueueLead;
  isAdmin: boolean;
  accountSlug: string | null;
  onSaved: () => void;
  onRescoreComplete: () => void;
  rescoreFn: (opts: {
    data: {
      account_slug: string;
      domain: string;
      review_values: Record<string, unknown>;
    };
  }) => Promise<{ status: number; body: unknown }>;
}) {
  const [form, setForm] = useState<NumericForm>(() =>
    initialFormFromLead(lead),
  );
  const [notes, setNotes] = useState<string>(lead.review_notes ?? "");
  const [saving, setSaving] = useState<null | "start" | "reject" | "confirm">(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pollState, setPollState] = useState<
    | { kind: "idle" }
    | { kind: "polling"; startedAt: number }
    | { kind: "done" }
    | { kind: "timeout" }
  >({ kind: "idle" });
  const baselineRef = useRef<string | null>(lead.score_last_calculated_at);

  const band = scoreBand(lead.score_total);
  const disabled = !isAdmin || saving !== null || pollState.kind === "polling";

  const shareParsed = parseIntlShare(form.intl_revenue_share);
  const countriesParsed = parseCountries(form.countries_with_revenue);
  const confirmValid =
    shareParsed.error === null && countriesParsed.error === null;

  const isStale = (() => {
    if (!lead.reviewed_at || !lead.score_last_calculated_at) return false;
    return (
      new Date(lead.reviewed_at).getTime() <
      new Date(lead.score_last_calculated_at).getTime()
    );
  })();

  const resetForm = () => {
    setForm(initialFormFromLead(lead));
    setNotes(lead.review_notes ?? "");
    setError(null);
    setInfo(null);
  };

  const writeReview = async (
    nextState: "in_review" | "confirmed" | "rejected",
    opts: {
      includeReviewValues: boolean;
      reviewValues?: Record<string, unknown>;
    },
  ) => {
    setError(null);
    setInfo(null);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    if (!uid) {
      setError("Not signed in.");
      return null;
    }
    const payload: Record<string, unknown> = {
      review_state: nextState,
      reviewed_by: uid,
      reviewed_at: new Date().toISOString(),
      review_notes: notes.trim() ? notes.trim() : null,
    };
    if (opts.includeReviewValues && opts.reviewValues) {
      payload.review_values = opts.reviewValues;
    }
    const res = await supabase
      .from("leads")
      .update(payload)
      .eq("id", lead.id)
      .select("id")
      .maybeSingle();
    if (res.error) {
      setError(res.error.message);
      return null;
    }
    if (!res.data) {
      setError(
        "Update denied by row-level security. Only admins can save reviews.",
      );
      return null;
    }
    return payload;
  };

  const handleStartReview = async () => {
    setSaving("start");
    const ok = await writeReview("in_review", { includeReviewValues: false });
    setSaving(null);
    if (ok) onSaved();
  };

  const handleReject = async () => {
    setSaving("reject");
    const ok = await writeReview("rejected", { includeReviewValues: false });
    setSaving(null);
    if (ok) onSaved();
  };

  const handleConfirm = async () => {
    if (!accountSlug || !lead.domain) {
      setError("Missing account slug or domain — cannot trigger rescore.");
      return;
    }
    if (!confirmValid) {
      setError("Fill both numeric fields with valid values before confirming.");
      return;
    }
    const reviewValues = {
      intl_revenue_share: shareParsed.value,
      countries_with_revenue: countriesParsed.value,
    } as Record<string, unknown>;

    setSaving("confirm");
    baselineRef.current = lead.score_last_calculated_at;
    const written = await writeReview("confirmed", {
      includeReviewValues: true,
      reviewValues,
    });
    if (!written) {
      setSaving(null);
      return;
    }
    try {
      const rescore = await rescoreFn({
        data: {
          account_slug: accountSlug,
          domain: lead.domain,
          review_values: reviewValues,
        },
      });
      if (rescore.status === 503) {
        setInfo("Rescore pipeline not live yet — review saved.");
        setSaving(null);
        onSaved();
        return;
      }
      if (rescore.status >= 400) {
        setError(
          `Rescore webhook returned ${rescore.status}. Review saved but no rescore triggered.`,
        );
        setSaving(null);
        onSaved();
        return;
      }
    } catch (err) {
      setError(
        `Rescore request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      setSaving(null);
      onSaved();
      return;
    }
    setSaving(null);
    setPollState({ kind: "polling", startedAt: Date.now() });
  };

  useEffect(() => {
    if (pollState.kind !== "polling") return;
    let cancelled = false;
    const started = pollState.startedAt;
    const TIMEOUT_MS = 60_000;
    const INTERVAL_MS = 3_000;
    const tick = async () => {
      if (cancelled) return;
      if (Date.now() - started > TIMEOUT_MS) {
        setPollState({ kind: "timeout" });
        return;
      }
      const res = await supabase
        .from("leads")
        .select("score_last_calculated_at")
        .eq("id", lead.id)
        .maybeSingle();
      if (cancelled) return;
      const latest = res.data?.score_last_calculated_at ?? null;
      if (latest && latest !== baselineRef.current) {
        setPollState({ kind: "done" });
        setTimeout(() => onRescoreComplete(), 700);
        return;
      }
      setTimeout(tick, INTERVAL_MS);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [pollState, lead.id, onRescoreComplete]);

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">
              {lead.company_name}
            </h2>
            <div className="mt-0.5 text-sm text-muted-foreground">
              {lead.domain ?? "No domain on file"}
            </div>
            {isStale && (
              <div className="mt-2">
                <Badge
                  variant="outline"
                  className="border-chart-4/40 bg-chart-4/10 text-[11px] text-chart-4"
                >
                  Reviewed before current data
                </Badge>
              </div>
            )}
          </div>
          <div className="text-right">
            <div
              className={`text-3xl font-semibold tabular-nums ${scoreBandTextClass(band)}`}
            >
              {lead.score_total ?? "—"}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                /130
              </span>
            </div>
            {lead.score_total != null && (
              <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full ${scoreBandClass(band)}`}
                  style={{
                    width: `${Math.min(100, (Number(lead.score_total) / 130) * 100)}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
        {lead.review_reason && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-chart-4/40 bg-chart-4/5 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-chart-4" />
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-chart-4">
                Why it's here
              </div>
              <div className="mt-0.5">{lead.review_reason}</div>
            </div>
          </div>
        )}
        {lead.score_breakdown && (
          <pre className="mt-3 whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs text-muted-foreground">
            {lead.score_breakdown}
          </pre>
        )}
      </header>

      {lead.ai_assist && Object.keys(lead.ai_assist).length > 0 && (
        <section className="rounded-md border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              AI assist
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            {Object.entries(lead.ai_assist).map(([key, value]) => (
              <div key={key}>
                <dt className="text-xs text-muted-foreground">
                  {humanizeKey(key)}
                </dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {formatValue(value)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Reviewer inputs
        </h3>
        {!isAdmin && (
          <div className="mt-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            Read-only — only admins can save reviews.
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          These two values are the exact keys the rescore pipeline consumes.
          Required only to Confirm.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumericField
            label="International revenue share (%)"
            value={form.intl_revenue_share}
            onChange={(v) => setForm({ ...form, intl_revenue_share: v })}
            min={0}
            max={100}
            step={0.1}
            error={form.intl_revenue_share ? shareParsed.error : null}
            disabled={disabled}
            placeholder="0.0 – 100.0"
          />
          <NumericField
            label="Countries with revenue"
            value={form.countries_with_revenue}
            onChange={(v) => setForm({ ...form, countries_with_revenue: v })}
            min={0}
            step={1}
            error={form.countries_with_revenue ? countriesParsed.error : null}
            disabled={disabled}
            placeholder="0, 1, 2, …"
          />
        </div>
        <div className="mt-4">
          <label className="text-xs text-muted-foreground">Notes</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Optional context for the next reviewer or pipeline"
            disabled={disabled}
            className="mt-1"
          />
        </div>
      </section>

      {lead.firmographics && Object.keys(lead.firmographics).length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Firmographics
          </h3>
          <dl className="mt-2 grid grid-cols-2 gap-3">
            {Object.entries(lead.firmographics).map(([key, value]) => (
              <div key={key}>
                <dt className="text-xs text-muted-foreground">
                  {humanizeKey(key)}
                </dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {formatValue(value)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <footer className="sticky bottom-0 -mx-6 -mb-6 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card/95 px-6 py-4 backdrop-blur">
        <div className="text-xs text-muted-foreground">
          {lead.reviewed_at ? (
            <>Last saved {formatLondon(lead.reviewed_at) ?? "—"}</>
          ) : (
            <>Not yet reviewed</>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pollState.kind === "polling" && (
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Waiting for rescore…
            </span>
          )}
          {pollState.kind === "done" && (
            <span className="flex items-center gap-2 text-xs text-chart-2">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Rescored
            </span>
          )}
          {pollState.kind === "timeout" && (
            <span className="text-xs text-chart-4">
              Rescore not detected within 60s — review saved.
            </span>
          )}
          <Button
            variant="ghost"
            onClick={resetForm}
            disabled={saving !== null || pollState.kind === "polling"}
          >
            Reset form
          </Button>
          <Button variant="outline" onClick={handleReject} disabled={disabled}>
            {saving === "reject" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Reject
          </Button>
          <Button
            variant="secondary"
            onClick={handleStartReview}
            disabled={disabled}
          >
            {saving === "start" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Start review
          </Button>
          <Button onClick={handleConfirm} disabled={disabled || !confirmValid}>
            {saving === "confirm" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Confirm & rescore
          </Button>
        </div>
      </footer>

      {info && (
        <div className="rounded-md border border-chart-4/40 bg-chart-4/5 p-3 text-sm text-chart-4">
          {info}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}

function NumericField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  error,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  step?: number;
  error?: string | null;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        placeholder={placeholder}
        className={`mt-1 ${error ? "border-destructive" : ""}`}
      />
      {error && (
        <div className="mt-1 text-[11px] text-destructive">{error}</div>
      )}
    </div>
  );
}

function humanizeKey(key: string) {
  return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value == null) return "—";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
