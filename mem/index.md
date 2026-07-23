# Project Memory

## Core
- Never silently change security posture. SECURITY DEFINER helpers, RLS grants, restrictive deny policies, view `security_invoker=on`, unauthenticated `/api/public/ingest-*` routes (x-ingest-secret auth), and the pipeline-vs-review two-owner column split on `leads` are all DELIBERATE — if a scan or task seems to require changing one, STOP and ask.
- Schema changes (tables, columns, policies, grants, functions) only via explicit human-provided SQL run verbatim. Never migrate on your own.
- Frontend is read-only except for the 6 review columns on `leads` (column-level UPDATE grant to authenticated).

## Memories
- [Security design decisions](mem://security/design-decisions) — Full list of triaged/accepted security items the scanner may flag: SECURITY DEFINER helpers, grants model, public ingest auth, view invoker, two-owner split, schema-change policy
