## Plan

1. Run exactly this migration, nothing else:
   ```sql
   alter view public.kpi_summary set (security_invoker = on);
   alter view public.sla_status set (security_invoker = on);
   ```
2. Verify /kpis still renders after switching the views to invoker semantics (grants to `authenticated` are already in place from the previous migration, and RLS on the underlying tables scopes rows via `current_account_id()` / `is_hayas_admin()`).
3. Leave the SECURITY DEFINER functions untouched — flagged as intentional.

No frontend changes.