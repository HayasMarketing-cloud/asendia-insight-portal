revoke select on public.accounts, public.profiles, public.leads,
  public.ops_log, public.lead_score_history from anon;
revoke select on public.kpi_summary from anon;

create policy history_no_writes on lead_score_history
  as restrictive for all to anon, authenticated
  using (false) with check (false);