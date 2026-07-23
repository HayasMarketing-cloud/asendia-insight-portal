## §8 External Certification — Execution Plan

Yes, I can run this. Confirmed available:
- `curl` in the sandbox → real HTTPS calls to the production immutable URL
- `INGEST_SECRET` present as an env var (will be passed via `-H` from `$INGEST_SECRET`, never echoed, never written to a file)
- `psql` (read-only) for the count/verification queries in step 10
- `supabase--migration` for the final `DELETE` cleanup (sandbox `psql` is SELECT/INSERT only, so deletes must go through a migration — this is the one deviation from "do it all in shell")

### Execution order (matches the attached script exactly)

1. Test 1 — `POST /ingest-ops-log` healthcheck, correct secret → expect `200` + `{id}`
2. Test 2 — same payload, wrong secret → expect `401`, no row inserted
3. Test 3 — `GET` both endpoints → expect `405` on each
4. Tests 4–9 — the six `/ingest-leads` payloads from the script (SQL lead, MQL, discarded, manual_review with `ai_assist`, partial re-upsert of rokit.co.uk to verify review-column preservation and score stability at 88, and the `score_total: null` case for foliosociety.com)
5. Step 10 — verification via `psql` read-only:
   - `leads` count = 33, `ops_log` count = 1 (the wrong-secret call MUST NOT have inserted), `lead_score_history` count = 35
   - `rokit.co.uk` still has `score_total = 88` and its review columns untouched by the partial upsert
   - `foliosociety.com` has `score_total IS NULL` (not coerced to 0)
6. Cleanup via one `supabase--migration`:
   - `DELETE FROM lead_score_history WHERE domain IN ('rokit.co.uk','foliosociety.com') OR domain LIKE 'test-%'`
   - `DELETE FROM leads WHERE domain IN ('rokit.co.uk','foliosociety.com') OR domain LIKE 'test-%'`
   - `DELETE FROM ops_log WHERE workflow_name = 'lead-accelerator__healthcheck' AND run_at = '2026-07-24T07:00:00Z'`
7. Final counts re-read via `psql` to confirm zero test residue.

### Deliverable

A pass/fail table with one row per test (1–10), each showing: expected, observed HTTP code / row count / field value, and PASS/FAIL. Final counts reported at the bottom.

### One thing to confirm before I run

The script file I have shows lines 1–33 (through test 4's header). I'll read the remaining ~55 lines (tests 4–9 payloads + step 10 wording) verbatim from `/mnt/user-uploads/certificacion_s8_curls.sh` at the start of build mode and execute them exactly as written — no edits, no "improvements". If a payload references a domain or field I don't expect, I stop and report rather than guess.

Ready to execute on switch to build mode.