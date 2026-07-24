do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('accounts','profiles','ops_log','lead_score_history')
      and permissive = 'RESTRICTIVE' and cmd = 'ALL'
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

create policy profiles_no_inserts on profiles as restrictive for insert to anon, authenticated with check (false);
create policy profiles_no_updates on profiles as restrictive for update to anon, authenticated using (false) with check (false);
create policy profiles_no_deletes on profiles as restrictive for delete to anon, authenticated using (false);

create policy accounts_no_inserts on accounts as restrictive for insert to anon, authenticated with check (false);
create policy accounts_no_updates on accounts as restrictive for update to anon, authenticated using (false) with check (false);
create policy accounts_no_deletes on accounts as restrictive for delete to anon, authenticated using (false);

create policy ops_log_no_inserts on ops_log as restrictive for insert to anon, authenticated with check (false);
create policy ops_log_no_updates on ops_log as restrictive for update to anon, authenticated using (false) with check (false);
create policy ops_log_no_deletes on ops_log as restrictive for delete to anon, authenticated using (false);

create policy history_no_inserts on lead_score_history as restrictive for insert to anon, authenticated with check (false);
create policy history_no_updates on lead_score_history as restrictive for update to anon, authenticated using (false) with check (false);
create policy history_no_deletes on lead_score_history as restrictive for delete to anon, authenticated using (false);