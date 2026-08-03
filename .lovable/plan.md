# Support the fifth lead status: `excluded`

## Diagnosis (verified before planning)

- `public.leads` has **no CHECK constraint and no enum** on `status` — its only constraints are the primary key, the `(account_id, domain)` unique key, and the account foreign key. **No SQL migration is required** for the database to accept `excluded`.
- `kpi_summary` counts `status = 'sql' | 'mql' | 'manual_review' | 'discarded'` plus `count(*) AS total_leads`. So `excluded` leads would **not** be counted as discarded (good), but they **would** silently inflate `total_leads`, which is the denominator behind every percentage on the KPIs page. This must be corrected in the frontend, since the view is DB-owned.
- The Manual Review queue query already filters `status = 'manual_review'`, so a lead flipped to `excluded` leaves the queue automatically with review columns untouched. No change needed there beyond outcome labelling.
- The rescore server function has no status enum to widen — it only forwards `review_values` and polls the lead row back; validation of accepted statuses lives in the ingest route (`z.enum(["sql","mql","discarded","manual_review"])`) and in the display label maps.
- Current data: mql 27, sql 10, discarded 5, manual_review 40, excluded 0.

## Point 2 — SQL for you to run

None is needed for `status` itself. If you want `excluded` reflected in `kpi_summary` server-side later, that is a separate view change; this plan handles it in the frontend instead so no schema change is involved. If you'd still prefer a defensive CHECK constraint, I'll hand you the script on request — I will not run any migration.

## Changes

### 1. Validation — `src/routes/api/public/ingest-leads.ts`
Add `"excluded"` to the `STATUS` tuple used by both the lead schema and the history rows. No other ingest logic changes. The dashboard never generates the value.

### 2. Labels — `src/lib/lead-presentation.ts`
Add `excluded: "Excluded — open opportunity"` to `STATUS_LABELS`.

### 3. Badge + CRM Sync — `src/routes/_authenticated/leads.tsx`
- `statusBadgeClass`: `excluded` → neutral slate styling (`bg-muted text-muted-foreground border-border`, same neutral family as discarded; no red/amber tokens).
- Row badge and detail-sheet badge: when status is `excluded`, wrap the badge in a tooltip whose content is the full `review_reason` (fall back to the label text when `review_reason` is null). `review_reason` is already selected by the leads query.
- `CrmSyncCell`: unchanged behaviour already yields `—` for any non-`sql` status; add `excluded` to the explanatory comment so the intent is explicit.
- `STATUS_OPTIONS` filter list: add `"excluded"`. The `default` filter view keeps excluding `manual_review` and `discarded`, and now also `excluded`, so it stays a "live pipeline" view; `Excluded` and `All` reach them.

### 4. KPIs — `src/routes/_authenticated/kpis.tsx`
- Extend the existing scores query to also select `status` (read-only) so an `excluded_count` can be derived client-side without a view change.
- New denominator: `qualifiedTotal = total_leads − excluded_count`. All percentage cards (`SQL`, `MQL`, `Discarded`, `Manual review`, coverage-derived text) use `qualifiedTotal`.
- "Total companies scored" card shows `qualifiedTotal`, with a secondary line noting the excluded count when it is greater than zero.
- New card `Excluded` (neutral styling, no percentage) with the note "Excluded: open opportunity already in SugarCRM".
- Funnel is already built from `sql + mql + discarded` only, so `excluded` cannot enter it — confirmed, no change beyond a comment.
- Score histogram counts all scored leads; excluded leads keep their score and remain in the histogram (it is a score distribution, not a conversion metric).

### 5. Manual Review — `src/routes/_authenticated/manual-review.tsx`
- Add `excluded: "Excluded — open opportunity"` to `OUTCOME_LABELS` so a rescore that lands on `excluded` reads correctly in the outcome banner and queue chip.
- No change to the queue query: status already governs membership, and review columns are never touched by this change.

## Not touched

Scoring logic, review-column ownership, `lead_score_history` writes, RLS policies, grants, and every pipeline-owned column. No RLS change is needed for this work.

## Verification

Typecheck, then a visual pass on `/leads` (Excluded filter option present, neutral badge, tooltip text) and `/kpis` (Excluded card renders, percentages recomputed off the reduced denominator). With today's data the excluded count is 0, so KPI percentages must be unchanged from current production values — that is the regression check.

I will list every changed file for your review before publishing.
