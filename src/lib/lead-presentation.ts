// Presentation-only maps and helpers for Lead Accelerator UI.
// Stored values in the DB are the enum keys; labels here are only for render.

export const STATUS_LABELS: Record<string, string> = {
  sql: "Sales Qualified",
  mql: "Marketing Qualified",
  discarded: "Discarded",
  manual_review: "Needs review",
  excluded: "Excluded — open opportunity",
};

export const INTL_MATURITY_LABELS: Record<string, string> = {
  established_icp1: "Established international",
  icp2: "Scaling internationally",
  growing: "Early international",
  starting_icp3: "Mainly domestic",
};

export const GROWTH_LABELS: Record<string, string> = {
  high: "High growth",
  med: "Steady",
  low: "Flat or declining",
};

export const INTENT_LABELS: Record<string, string> = {
  high: "Strong intent",
  med: "Some intent",
  low: "Weak signal",
  none: "No signals",
};

export const ICP_LABELS: Record<string, string> = {
  icp1: "ICP 1 · Established Internationally D2C",
  icp2: "ICP 2 · Scaling Internationally D2C",
  icp3: "ICP 3 · Emerging Internationally D2C",
  out: "Outside ICP",
};

export const ICP_SHORT_LABELS: Record<string, string> = {
  icp1: "ICP 1",
  icp2: "ICP 2",
  icp3: "ICP 3",
  out: "Out",
};

export const TRIGGER_LABELS: Record<string, string> = {
  monthly_run: "Monthly run",
  manual_review: "Manual review",
  recalibration: "Model recalibration",
};

export function labelFor(map: Record<string, string>, key: string | null | undefined) {
  if (!key) return null;
  return map[key] ?? key;
}

export type ScoreBand = "high" | "mid" | "low" | "none";

export function scoreBand(score: number | null | undefined): ScoreBand {
  if (score == null) return "none";
  if (score > 70) return "high";
  if (score >= 40) return "mid";
  return "low";
}

export function scoreBandClass(band: ScoreBand): string {
  switch (band) {
    case "high":
      return "bg-chart-2";
    case "mid":
      return "bg-chart-4";
    case "low":
      return "bg-muted-foreground/60";
    default:
      return "bg-muted";
  }
}

export function scoreBandTextClass(band: ScoreBand): string {
  switch (band) {
    case "high":
      return "text-chart-2";
    case "mid":
      return "text-chart-4";
    case "low":
      return "text-muted-foreground";
    default:
      return "text-muted-foreground";
  }
}

export function dataBadgeFor(
  dataSource: string | null | undefined,
  reviewState: string | null | undefined,
): { label: string; tone: "verified" | "review" | "none" | "confirmed" } {
  if (reviewState === "confirmed") {
    return { label: "Verified by review", tone: "confirmed" };
  }
  switch (dataSource) {
    case "ecdb":
      return { label: "Verified", tone: "verified" };
    case "provisional":
      return { label: "AI-estimated · needs review", tone: "review" };
    case "manual":
      return { label: "No data", tone: "none" };
    default:
      return { label: "No data", tone: "none" };
  }
}

const LONDON_TZ = "Europe/London";

export function formatLondon(date: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON_TZ,
    year: "numeric",
    month: "short",
    day: "2-digit",
    ...opts,
  }).format(d);
}

export function daysSince(date: string | Date | null | undefined): number | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;
  const ms = Date.now() - d.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
