---
name: Security design decisions (triaged & accepted)
description: Human-approved security decisions the scanner may flag but must NEVER be silently changed — SECURITY DEFINER helpers, grants model, public ingest routes, view invoker, two-owner column split, schema-change policy
type: constraint
---

DELIBERATE decisions. Never "fix", revert, or modify. If a scan flags one or you believe it's wrong, STOP and ask — silent security changes are forbidden.

1. **SECURITY DEFINER helpers** — `current_account_id()` and `is_hayas_admin()` are SECURITY DEFINER by design with `SET search_path = public`. Called from RLS policies; must read profiles without re-triggering RLS (INVOKER causes policy-recursion). Linter warning accepted. Do NOT convert to INVOKER.

2. **RLS + grants model** (verified, archived):
   - `authenticated`: SELECT on all tables/views (RLS-filtered by account) + column-level UPDATE ONLY on the 6 review columns of `leads` (review_state, reviewed_by, reviewed_by_name, reviewed_at, review_notes, review_values).
   - `anon`: zero grants on tables and views. Do not re-grant.
   - Restrictive deny policies: INSERT/DELETE denied on leads; FOR ALL denied on accounts, profiles, ops_log, lead_score_history. Do not drop or broaden.
   - Never add table-level INSERT/UPDATE/DELETE grants to authenticated or anon.

3. **Public ingest routes** (`/api/public/ingest-leads`, `ingest-ops-log`) are intentionally unauthenticated at the platform level; auth is the `x-ingest-secret` header (timing-safe compare). Do not add JWT requirements. Do not remove the 405 handlers for non-POST methods.

4. **Views** `kpi_summary` (and any future view) must keep `security_invoker = on`.

5. **Two-owner column split** — Pipeline-owned columns of `leads` are never writable from the frontend; review columns are never written by ingestion. Preserve in any refactor.

6. **Schema changes** (tables, columns, policies, grants, functions) only happen through explicit human-provided SQL run verbatim. If a task seems to require a schema change, ASK — never migrate on your own.
