import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

const STATUS = ["sql", "mql", "discarded", "manual_review"] as const;
const INTL_MATURITY = ["established_icp1", "icp2", "growing", "starting_icp3"] as const;
const GROWTH = ["high", "med", "low"] as const;
const INTENT = ["high", "med", "low", "none"] as const;
const ICP = ["icp1", "icp2", "icp3", "out"] as const;
const REGION = [
  "Asendia_UK",
  "Asendia_Europe",
  "Asendia_North_America",
  "Asendia_Asia",
] as const;

const leadSchema = z.object({
  domain: z.string().trim().min(1).max(253),
  company_name: z.string().trim().min(1).max(500),
  hubspot_company_id: z.string().nullish(),
  status: z.enum(STATUS),
  intl_revenue_share: z.number().nullish(),
  countries_with_revenue: z.number().int().nullish(),
  gmv: z.number().nullish(),
  gmv_growth_yoy_pct: z.number().nullish(),
  orders_annual: z.number().int().nullish(),
  international_maturity: z.enum(INTL_MATURITY).nullish(),
  growth_momentum: z.enum(GROWTH).nullish(),
  buyer_intent_signals: z.enum(INTENT).nullish(),
  asendia_icp_segment: z.enum(ICP).nullish(),
  asendia_region: z.enum(REGION).nullish(),
  score_total: z.number().nullish(),
  score_breakdown: z.string().nullish(),
  score_last_calculated_at: z.string().nullish(),
  missing_ecdb: z.boolean().nullish(),
  high_intent_override: z.boolean().nullish(),
  review_reason: z.string().nullish(),
  sugarcrm_url: z.string().nullish(),
  hubspot_updated_at: z.string().nullish(),
  firmographics: z.unknown().nullish(),
  ai_assist: z.unknown().nullish(),
});

const batchSchema = z.object({
  account_slug: z.string().trim().min(1).max(100),
  engine_version: z.string().nullish(),
  trigger_source: z.string().nullish(),
  leads: z.array(z.unknown()).min(0).max(100),
});

function bad(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function secretOk(header: string | null, expected: string) {
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function deriveDataSource(missingEcdb: boolean | null | undefined, aiAssist: unknown): string {
  if (missingEcdb === false) return "ecdb";
  if (missingEcdb === true && aiAssist && typeof aiAssist === "object") {
    const candidates = (aiAssist as Record<string, unknown>).candidates;
    if (Array.isArray(candidates) && candidates.length > 0) return "provisional";
  }
  return "manual";
}

export const Route = createFileRoute("/api/public/ingest-leads")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "POST, OPTIONS",
            "access-control-allow-headers": "content-type, x-ingest-secret",
            "access-control-max-age": "86400",
          },
        }),
      POST: async ({ request }) => {
        const expected = process.env.INGEST_SECRET;
        if (!expected) return bad(500, { error: "INGEST_SECRET not configured" });
        if (!secretOk(request.headers.get("x-ingest-secret"), expected)) {
          return bad(401, { error: "unauthorized" });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return bad(400, { error: "invalid json" });
        }

        const parsed = batchSchema.safeParse(body);
        if (!parsed.success) return bad(400, { error: "invalid batch", details: parsed.error.flatten() });

        const { account_slug, engine_version, trigger_source, leads } = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: account, error: accErr } = await supabaseAdmin
          .from("accounts")
          .select("id")
          .eq("slug", account_slug)
          .maybeSingle();
        if (accErr) return bad(500, { error: "db error resolving account" });
        if (!account) return bad(400, { error: "unknown account_slug" });
        const account_id = account.id;

        const WRITABLE_KEYS = new Set([
          "company_name", "hubspot_company_id", "status",
          "intl_revenue_share", "countries_with_revenue", "gmv", "gmv_growth_yoy_pct",
          "orders_annual", "international_maturity", "growth_momentum",
          "buyer_intent_signals", "asendia_icp_segment", "asendia_region",
          "score_total", "score_breakdown", "score_last_calculated_at",
          "missing_ecdb", "high_intent_override", "review_reason",
          "sugarcrm_url", "hubspot_updated_at", "firmographics", "ai_assist",
        ]);

        type Accepted = {
          lead: z.infer<typeof leadSchema>;
          data_source: string;
          providedKeys: Set<string>;
        };
        const accepted: Accepted[] = [];
        const rejected: Array<{ domain: string; reason: string }> = [];

        for (const raw of leads) {
          const r = leadSchema.safeParse(raw);
          const rawObj = (raw && typeof raw === "object") ? (raw as Record<string, unknown>) : {};
          if (!r.success) {
            const domain = typeof rawObj.domain === "string" ? rawObj.domain : "(missing)";
            const firstIssue = r.error.issues[0];
            const reason = firstIssue ? `${firstIssue.path.join(".") || "root"}: ${firstIssue.message}` : "invalid lead";
            rejected.push({ domain, reason });
            continue;
          }
          const providedKeys = new Set(Object.keys(rawObj).filter((k) => WRITABLE_KEYS.has(k)));
          accepted.push({
            lead: r.data,
            data_source: deriveDataSource(r.data.missing_ecdb, r.data.ai_assist),
            providedKeys,
          });
        }

        if (accepted.length === 0) {
          return new Response(JSON.stringify({ inserted: 0, updated: 0, rejected }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        // Determine which domains already exist for this account
        const domains = accepted.map((a) => a.lead.domain);
        const { data: existing, error: exErr } = await supabaseAdmin
          .from("leads")
          .select("domain")
          .eq("account_id", account_id)
          .in("domain", domains);
        if (exErr) return bad(500, { error: "db error checking existing", detail: exErr.message });
        const existingSet = new Set((existing ?? []).map((r) => r.domain));

        const nowIso = new Date().toISOString();

        // Build a full-column row (used for INSERTs)
        function fullRow({ lead, data_source }: Accepted) {
          return {
            account_id,
            domain: lead.domain,
            company_name: lead.company_name,
            hubspot_company_id: lead.hubspot_company_id ?? null,
            status: lead.status,
            intl_revenue_share: lead.intl_revenue_share ?? null,
            countries_with_revenue: lead.countries_with_revenue ?? null,
            gmv: lead.gmv ?? null,
            gmv_growth_yoy_pct: lead.gmv_growth_yoy_pct ?? null,
            orders_annual: lead.orders_annual ?? null,
            international_maturity: lead.international_maturity ?? null,
            growth_momentum: lead.growth_momentum ?? null,
            buyer_intent_signals: lead.buyer_intent_signals ?? null,
            asendia_icp_segment: lead.asendia_icp_segment ?? null,
            asendia_region: lead.asendia_region ?? null,
            score_total: lead.score_total ?? null,
            score_breakdown: lead.score_breakdown ?? null,
            score_last_calculated_at: lead.score_last_calculated_at ?? null,
            missing_ecdb: lead.missing_ecdb ?? false,
            high_intent_override: lead.high_intent_override ?? false,
            review_reason: lead.review_reason ?? null,
            sugarcrm_url: lead.sugarcrm_url ?? null,
            hubspot_updated_at: lead.hubspot_updated_at ?? null,
            firmographics: (lead.firmographics ?? null) as never,
            ai_assist: (lead.ai_assist ?? null) as never,
            data_source,
            synced_at: nowIso,
          };
        }

        // INSERT new rows (all columns)
        const toInsert = accepted.filter((a) => !existingSet.has(a.lead.domain));
        if (toInsert.length > 0) {
          const { error: insErr } = await supabaseAdmin
            .from("leads")
            .insert(toInsert.map(fullRow));
          if (insErr) return bad(500, { error: "insert failed", detail: insErr.message });
        }

        // UPDATE existing rows: only columns that were actually provided in the payload
        // (this preserves omitted fields like score_total, firmographics from earlier runs)
        for (const a of accepted) {
          if (!existingSet.has(a.lead.domain)) continue;
          const patch: Record<string, unknown> = {
            data_source: a.data_source,
            synced_at: nowIso,
          };
          const full = fullRow(a) as Record<string, unknown>;
          for (const key of a.providedKeys) {
            patch[key] = full[key];
          }
          const { error: updErr } = await supabaseAdmin
            .from("leads")
            .update(patch)
            .eq("account_id", account_id)
            .eq("domain", a.lead.domain);
          if (updErr) return bad(500, { error: "update failed", detail: updErr.message });
        }

        // Append score history rows
        const historyRows = accepted.map(({ lead, data_source }) => ({
          account_id,
          domain: lead.domain,
          recorded_at: nowIso,
          score_total: lead.score_total ?? null,
          score_breakdown: lead.score_breakdown ?? null,
          status: lead.status,
          data_source,
          engine_version: engine_version ?? null,
          intl_revenue_share: lead.intl_revenue_share ?? null,
          gmv_growth_yoy_pct: lead.gmv_growth_yoy_pct ?? null,
          trigger_source: trigger_source ?? "monthly_run",
        }));
        const { error: histErr } = await supabaseAdmin.from("lead_score_history").insert(historyRows);
        if (histErr) return bad(500, { error: "history insert failed", detail: histErr.message });

        const inserted = toInsert.length;
        const updated = accepted.length - inserted;

        return new Response(JSON.stringify({ inserted, updated, rejected }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
