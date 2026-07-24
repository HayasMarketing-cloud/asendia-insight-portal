# Project Memory

## Core
- Never silently change security posture. SECURITY DEFINER helpers, RLS grants, restrictive deny policies, view `security_invoker=on`, unauthenticated `/api/public/ingest-*` routes (x-ingest-secret auth), and the pipeline-vs-review two-owner column split on `leads` are all DELIBERATE — if a scan or task seems to require changing one, STOP and ask.
- Schema changes only via human-provided SQL run verbatim. Corrective drift fixes go into a NEW idempotent migration provided by the human — never edit historical migration files.
- Frontend is read-only except for the 5 review columns on `leads` (column-level UPDATE to authenticated). `review_reason` and `reviewed_by_name` are pipeline-owned; frontend never writes them.
- Grant/policy verification is authoritative ONLY in the Supabase SQL editor (postgres). Agent-channel reads of `information_schema` can return false negatives — never claim grants are missing based on them.

## Memories
- [Security design decisions](mem://security/design-decisions) — Full list of triaged/accepted security items the scanner may flag: SECURITY DEFINER helpers, grants model, public ingest auth, view invoker, two-owner split, schema-change policy
- [Grants authority](mem://verification/grants-authority) — Grant/policy checks authoritative only in Supabase SQL editor; agent-channel `information_schema` reads are non-authoritative
