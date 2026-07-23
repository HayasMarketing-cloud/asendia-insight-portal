## Plan

1. **Migration** — Run exactly:
   ```sql
   alter table leads add column firmographics jsonb;
   ```
   Nothing else (no rename, no default, no index, no type change).

2. **Re-run the seed verbatim** (`seed_datos_reales_d4_2.sql`) as a single transaction via the insert tool. The previous attempt was fully rolled back, so there are no partial rows to clean up.

3. **Verify row counts** with a `SELECT count(*)` per table and confirm against the expected totals:

   | Table | Expected |
   |---|---|
   | accounts | 1 |
   | profiles | 3 (only if Rubén, Tomás, Iolanda already exist in Auth; otherwise fewer — the seed's `select from auth.users` silently skips missing users) |
   | leads | 26 (8 SQL + 8 MQL + 8 manual_review + 2 discard) |
   | sla_events | 8 |
   | ops_log | 4 (1 run_summary + 3 healthchecks) |

4. **Report back** the actual counts and flag any discrepancy — in particular, whether the 3 Hayas Auth users exist yet (if not, `profiles` will come in under 3 and you'll need to invite them from the backend before their rows appear).

No frontend changes. The `leads` page currently doesn't read `firmographics`; wiring it into the side panel for `manual_review` leads is a separate task if you want it.
