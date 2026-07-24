---
name: Grant/policy verification authority
description: Grant and policy verification is authoritative ONLY in the Supabase SQL editor (postgres role). Agent-channel reads of information_schema are not authoritative.
type: constraint
---

Grant/policy verification happens ONLY in the Supabase SQL editor (running as postgres). The agent's SQL channel can return role-visibility false negatives against `information_schema.column_privileges` and similar catalogs — a "0 rows" result from this channel is NOT proof grants are missing. A column-specific REVOKE cannot remove other columns' grants; treat contradictions with the SQL editor's CSV export as the agent channel being wrong.

**How to apply:**
- Never claim grants/policies are missing or present based solely on agent-channel queries.
- Report agent-channel reads as indicative only; defer authoritative confirmation to the human via Supabase SQL editor.
- Do not "fix" perceived missing grants — schema changes are human-SQL only (see Core).

**Migration hygiene:** Never edit historical migration files to correct drift. Corrective changes go into a NEW idempotent migration, provided by the human.
