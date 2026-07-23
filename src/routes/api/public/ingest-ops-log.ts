import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

const eventSchema = z.object({
  account_slug: z.string().trim().min(1),
  event_type: z.string().trim().min(1),
  workflow_name: z.string().trim().min(1),
  run_status: z.string().default("success"),
  run_at: z.string().nullish(),
  duration_seconds: z.number().int().nullish(),
  leads_processed: z.number().int().nullish(),
  ecdb_coverage_pct: z.number().nullish(),
  ecdb_credit_balance: z.number().int().nullish(),
  gated_count: z.number().int().nullish(),
  sql_count: z.number().int().nullish(),
  mql_count: z.number().int().nullish(),
  discarded_count: z.number().int().nullish(),
  write_errors: z.number().int().nullish(),
  api_status: z.unknown().nullish(),
  credits_consumed: z.unknown().nullish(),
  errors: z.unknown().nullish(),
  market: z.string().nullish(),
  engine_version: z.string().nullish(),
  ecdb_covered: z.number().int().nullish(),
  in_hubspot: z.number().int().nullish(),
  zi_matched: z.number().int().nullish(),
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

export const Route = createFileRoute("/api/public/ingest-ops-log")({
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

        const parsed = eventSchema.safeParse(body);
        if (!parsed.success) return bad(400, { error: "invalid event", details: parsed.error.flatten() });
        const e = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: account, error: accErr } = await supabaseAdmin
          .from("accounts")
          .select("id")
          .eq("slug", e.account_slug)
          .maybeSingle();
        if (accErr) return bad(500, { error: "db error resolving account" });
        if (!account) return bad(400, { error: "unknown account_slug" });

        const row = {
          account_id: account.id,
          event_type: e.event_type,
          workflow_name: e.workflow_name,
          run_status: e.run_status,
          run_at: e.run_at ?? new Date().toISOString(),
          duration_seconds: e.duration_seconds ?? null,
          leads_processed: e.leads_processed ?? null,
          ecdb_coverage_pct: e.ecdb_coverage_pct ?? null,
          ecdb_credit_balance: e.ecdb_credit_balance ?? null,
          gated_count: e.gated_count ?? null,
          sql_count: e.sql_count ?? null,
          mql_count: e.mql_count ?? null,
          discarded_count: e.discarded_count ?? null,
          write_errors: e.write_errors ?? null,
          api_status: (e.api_status ?? null) as never,
          credits_consumed: (e.credits_consumed ?? null) as never,
          errors: (e.errors ?? null) as never,
          market: e.market ?? null,
          engine_version: e.engine_version ?? null,
          ecdb_covered: e.ecdb_covered ?? null,
          in_hubspot: e.in_hubspot ?? null,
          zi_matched: e.zi_matched ?? null,
        };

        const { data, error } = await supabaseAdmin.from("ops_log").insert(row).select("id").single();
        if (error) return bad(500, { error: "insert failed", detail: error.message });
        return new Response(JSON.stringify({ id: data.id }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
