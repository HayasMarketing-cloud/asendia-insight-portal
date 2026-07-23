drop policy leads_no_writes on leads;

create policy leads_no_inserts on leads
  as restrictive for insert to anon, authenticated
  with check (false);

create policy leads_no_deletes on leads
  as restrictive for delete to anon, authenticated
  using (false);