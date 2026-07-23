-- 1) Lock search_path on SECURITY DEFINER helpers
alter function public.current_account_id() set search_path = public;
alter function public.is_hayas_admin() set search_path = public;

-- 2) Remove anon (public role) execute rights; keep authenticated so RLS policies keep working
revoke execute on function public.current_account_id() from public, anon;
revoke execute on function public.is_hayas_admin() from public, anon;
grant execute on function public.current_account_id() to authenticated;
grant execute on function public.is_hayas_admin() to authenticated;

-- 3) Explicit account-scoped write policies (deny all writes from client roles).
--    Data is written only by service_role, which bypasses RLS. These policies
--    document intent and follow the account-scoping pattern of the read policies.
create policy accounts_no_writes on public.accounts
  as restrictive for all to authenticated, anon
  using (false) with check (false);

create policy profiles_no_writes on public.profiles
  as restrictive for all to authenticated, anon
  using (false) with check (false);

create policy leads_no_writes on public.leads
  as restrictive for all to authenticated, anon
  using (false) with check (false);

create policy sla_no_writes on public.sla_events
  as restrictive for all to authenticated, anon
  using (false) with check (false);

create policy ops_no_writes on public.ops_log
  as restrictive for all to authenticated, anon
  using (false) with check (false);