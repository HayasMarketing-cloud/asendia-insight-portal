-- =====================================================================
-- PORTAL DE CLIENTE HAYAS — Esquema Supabase v0.2
-- Módulo 1: Dashboard Lead Accelerator (Asendia)
-- =====================================================================

create table accounts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now()
);

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  account_id  uuid references accounts(id),
  role        text not null default 'viewer'
              check (role in ('viewer', 'admin', 'hayas_admin')),
  full_name   text,
  email       text not null,
  created_at  timestamptz not null default now()
);

create table leads (
  id                       uuid primary key default gen_random_uuid(),
  account_id               uuid not null references accounts(id),
  hubspot_company_id       text not null,
  company_name             text not null,
  domain                   text,
  intl_revenue_share       numeric,
  countries_with_revenue   int,
  gmv                      numeric,
  gmv_growth_yoy_pct       numeric,
  orders_annual            int,
  international_maturity   text,
  growth_momentum          text,
  buyer_intent_signals     text,
  asendia_icp_segment      text
                           check (asendia_icp_segment
                                  in ('icp1','icp2','icp3','out')),
  asendia_region           text,
  score_total              numeric,
  score_breakdown          text,
  score_confidence         text not null default 'full'
                           check (score_confidence in ('full','proxy')),
  score_last_calculated_at timestamptz,
  status                   text not null
                           check (status in ('sql','mql',
                                             'manual_review','discard')),
  missing_ecdb             boolean default false,
  high_intent_override     boolean default false,
  review_reason            text,
  sugarcrm_url             text,
  sequence_engagement      jsonb,
  hubspot_updated_at       timestamptz,
  synced_at                timestamptz not null default now(),
  unique (account_id, hubspot_company_id)
);

create index idx_leads_account_status on leads (account_id, status);
create index idx_leads_account_icp    on leads (account_id, asendia_icp_segment);

create table sla_events (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid not null references accounts(id),
  lead_id        uuid not null references leads(id) on delete cascade,
  sla_applies    boolean not null default true,
  routing_type   text check (routing_type
                             in ('new_lead','account_update','opp_note')),
  sql_marked_at  timestamptz not null,
  accepted_at    timestamptz,
  created_at     timestamptz not null default now()
);

create index idx_sla_account on sla_events (account_id, sql_marked_at);

create view sla_status as
select
  s.account_id,
  s.lead_id,
  l.company_name,
  s.routing_type,
  s.sql_marked_at,
  s.accepted_at,
  case
    when not s.sla_applies then 'no_sla'
    when s.accepted_at is not null
         and s.accepted_at <= s.sql_marked_at + interval '48 hours'
      then 'met'
    when s.accepted_at is not null
      then 'breached'
    when now() <= s.sql_marked_at + interval '48 hours'
      then 'within_window'
    else 'overdue'
  end as sla_state
from sla_events s
join leads l on l.id = s.lead_id
where s.sla_applies;

create table ops_log (
  id                 uuid primary key default gen_random_uuid(),
  account_id         uuid not null references accounts(id),
  event_type         text not null
                     check (event_type in ('run_summary','healthcheck')),
  run_at             timestamptz not null default now(),
  workflow_name      text not null,
  run_status         text not null default 'success'
                     check (run_status in ('success','warning','error')),
  leads_processed    int,
  ecdb_coverage_pct  numeric,
  gated_count        int,
  sql_count          int,
  mql_count          int,
  discard_count      int,
  write_errors       int,
  api_status         jsonb,
  ecdb_credit_balance int,
  credits_consumed   jsonb,
  errors             jsonb,
  duration_seconds   int
);

create index idx_ops_account_run on ops_log (account_id, event_type, run_at desc);

create view kpi_summary as
select
  account_id,
  count(*) filter (where status = 'sql')           as sql_count,
  count(*) filter (where status = 'mql')           as mql_count,
  count(*) filter (where status = 'manual_review') as manual_count,
  count(*) filter (where status = 'discard')       as discard_count,
  count(*) filter (where high_intent_override)     as high_intent_count,
  count(*)                                         as total_leads,
  round(
    100.0 * count(*) filter (where not missing_ecdb) / nullif(count(*), 0), 1
  ) as coverage_rate_pct
from leads
group by account_id;

alter table accounts   enable row level security;
alter table profiles   enable row level security;
alter table leads      enable row level security;
alter table sla_events enable row level security;
alter table ops_log    enable row level security;

create function current_account_id() returns uuid
language sql stable security definer as $$
  select account_id from profiles where id = auth.uid();
$$;

create function is_hayas_admin() returns boolean
language sql stable security definer as $$
  select coalesce(
    (select role = 'hayas_admin' from profiles where id = auth.uid()),
    false
  );
$$;

create policy leads_read on leads for select
  using (account_id = current_account_id() or is_hayas_admin());

create policy sla_read on sla_events for select
  using (account_id = current_account_id() or is_hayas_admin());

create policy ops_read on ops_log for select
  using (account_id = current_account_id() or is_hayas_admin());

create policy accounts_read on accounts for select
  using (id = current_account_id() or is_hayas_admin());

create policy profiles_read on profiles for select
  using (id = auth.uid() or is_hayas_admin());
