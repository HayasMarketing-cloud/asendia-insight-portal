
create or replace function public.current_account_id()
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select account_id from profiles where id = auth.uid();
$$;

create or replace function public.is_hayas_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    (select role = 'hayas_admin' from profiles where id = auth.uid()),
    false
  );
$$;
