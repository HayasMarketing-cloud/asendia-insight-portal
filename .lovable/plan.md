## Part 1 — Hardening migration

Run exactly as sent:

```sql
revoke select on public.accounts, public.profiles, public.leads,
  public.ops_log, public.lead_score_history from anon;
revoke select on public.kpi_summary from anon;

create policy history_no_writes on lead_score_history
  as restrictive for all to anon, authenticated
  using (false) with check (false);
```

Then verify a fresh OTP login still works (auth exchange doesn't touch PostgREST reads; `/leads` and `/kpis` continue to work under `authenticated`).

## Part 2 — Three endpoints (TanStack, not Supabase Edge Functions)

Files:

1. **`src/routes/api/public/ingest-leads.ts`** — POST + OPTIONS.
   - Timing-safe `x-ingest-secret` check against `INGEST_SECRET`. Wrong/missing → 401.
   - Zod-validate the batch shape and per-lead payload. Reject with `{ domain, reason }` per-lead; never fail siblings.
   - Enum enforcement in-code:
     - `status` ∈ {sql, mql, discarded, manual_review}
     - `international_maturity` ∈ {established_icp1, icp2, growing, starting_icp3}
     - `growth_momentum` ∈ {high, med, low}
     - `buyer_intent_signals` ∈ {high, med, low, none}
     - `asendia_icp_segment` ∈ {icp1, icp2, icp3, out}
     - `asendia_region` ∈ {Asendia_UK, Asendia_Europe, Asendia_North_America, Asendia_Asia}
   - Resolve `account_id` from `account_slug` (service role, loaded via `await import(...)` inside handler). Unknown slug → 400.
   - Per lead: derive `data_source` (`ecdb` / `provisional` / `manual`), keep `score_total = null` when absent, store optional `ai_assist`.
   - Existence check: single `select id, domain from leads where account_id=? and domain in (...)` to split inserted vs updated in the response.
   - Upsert on `(account_id, domain)` with `onConflict: 'account_id,domain'`. **Explicit column list** — the six review columns are never in the payload sent to PostgREST, so they stay untouched on update.
   - Append one row per accepted lead to `lead_score_history` (`account_id, domain, recorded_at=now(), score_total, score_breakdown, status, data_source, engine_version, intl_revenue_share, gmv_growth_yoy_pct, trigger_source ?? 'monthly_run'`). Bulk insert.
   - 200 `{ inserted, updated, rejected: [...] }` for accepted/partial. 401 for bad secret. 400 for malformed/unknown slug. 5xx for transient errors (N8N retries).

2. **`src/routes/api/public/ingest-ops-log.ts`** — POST + OPTIONS.
   - Same secret check. Zod-validate; all event-specific fields nullable.
   - Accept new fields: `market`, `engine_version`, `ecdb_covered`, `in_hubspot`, `zi_matched`, `discarded_count`.
   - Insert one row into `ops_log`. Return 200 `{ id }`.

3. **`src/lib/rescore.functions.ts`** — `createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(...).handler(...)`.
   - Reads `process.env.N8N_RESCORE_URL` and `process.env.RESCORE_SECRET` inside the handler.
   - Missing URL → 503 `{ error: 'rescore webhook not configured yet' }`.
   - Zod input: `{ account_slug, domain, review_values }`. `reviewed_by = context.userId` (never from client).
   - POST to `N8N_RESCORE_URL` with `x-rescore-secret` header; return N8N's status + body. Neither secret nor URL ever leaves the server.

Handlers read all `process.env.*` inside the handler body (never module scope). Service-role client is `await import('@/integrations/supabase/client.server')` inside the handler. No changes to `src/start.ts`, `src/routes/__root.tsx`, or any frontend file.

## Secrets

After the code is in place I'll request `INGEST_SECRET` and `RESCORE_SECRET` via `add_secret`. `N8N_RESCORE_URL` stays unset (503 is the expected state).

## Preview vs published — where tests run

TanStack server routes under `src/routes/api/public/*` are part of the deployed app. They serve on both the preview build (`project--cc6fc6eb-e6cf-41a3-bd60-8817902bfa38-dev.lovable.app`) and the published build (`project--cc6fc6eb-e6cf-41a3-bd60-8817902bfa38.lovable.app` / `asendia-insight-portal.lovable.app`). Smoke tests will hit the published URL after `preview_ui--publish` runs, because unprefixed server-side secrets (`INGEST_SECRET`, etc.) require a publish to reach production. Preview receives the new secrets immediately if you prefer to test there first — I can test on either. Default: publish, then test on the immutable project URL.

## Verification checklist (I'll run all)

1. Confirm the hardening migration applied — re-check anon grants on all five tables + `kpi_summary`, and the new `history_no_writes` policy exists.
2. Fresh OTP login end-to-end; then confirm `/leads` and `/kpis` still render.
3. `ingest-leads` smoke test against the immutable project URL:
   - Send batch of 3 (1 valid, 1 invalid enum, 1 missing `domain`) → expect 200 `inserted:1, updated:0, rejected:2`.
   - Re-send the valid lead → expect `inserted:0, updated:1`.
   - Confirm review columns of a pre-seeded row are untouched after the update.
   - Confirm `lead_score_history` row count grew.
   - Bad `x-ingest-secret` → 401.
4. `ingest-ops-log` smoke test: one `run_summary`, one `healthcheck` → both 200. `ops_log` count +2.
5. Cleanup: delete test rows via service role.

## Final report will include

- Migration + login verification results.
- **The immutable URL that N8N should use** (`project--cc6fc6eb-e6cf-41a3-bd60-8817902bfa38.lovable.app/api/public/…`). The pretty `asendia-insight-portal.lovable.app` URL and any future custom domain both change; the immutable one does not.
- Confirmation that `/api/public/*` is live on **both** preview and published builds.
- Smoke-test outcomes.
