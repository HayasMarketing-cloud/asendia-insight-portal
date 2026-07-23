-- v0.3 Alineación con Data Contract N8N → Dashboard
delete from ops_log;
delete from leads;

drop view if exists sla_status;
drop table if exists sla_events;

alter table leads drop constraint if exists leads_status_check;
alter table leads drop constraint if exists leads_asendia_icp_segment_check;
alter table leads drop constraint if exists leads_score_confidence_check;

alter table leads drop constraint if exists leads_account_id_hubspot_company_id_key;
alter table leads alter column hubspot_company_id drop not null;
alter table leads alter column domain set not null;
alter table leads add constraint leads_account_domain_key unique (account_id, domain);

alter table leads drop column if exists score_confidence;
alter table leads add column data_source text not null default 'manual';

alter table leads drop column if exists sequence_engagement;

alter table leads add column ai_assist jsonb;

alter table leads add column review_state text;
alter table leads add column reviewed_by uuid;
alter table leads add column reviewed_by_name text;
alter table leads add column reviewed_at timestamptz;
alter table leads add column review_notes text;
alter table leads add column review_values jsonb;

alter table ops_log drop constraint if exists ops_log_event_type_check;
alter table ops_log drop constraint if exists ops_log_run_status_check;
alter table ops_log rename column discard_count to discarded_count;
alter table ops_log add column market text;
alter table ops_log add column engine_version text;
alter table ops_log add column ecdb_covered integer;
alter table ops_log add column in_hubspot integer;
alter table ops_log add column zi_matched integer;

create table lead_score_history (
  id                  uuid primary key default gen_random_uuid(),
  account_id          uuid not null references accounts(id),
  domain              text not null,
  recorded_at         timestamptz not null default now(),
  score_total         numeric,
  score_breakdown     text,
  status              text,
  data_source         text,
  engine_version      text,
  intl_revenue_share  numeric,
  gmv_growth_yoy_pct  numeric,
  trigger_source      text
);

create index idx_history_account_domain
  on lead_score_history (account_id, domain, recorded_at desc);

alter table lead_score_history enable row level security;

create policy history_read on lead_score_history for select
  using (account_id = current_account_id() or is_hayas_admin());

grant select on lead_score_history to authenticated;

grant update (review_state, reviewed_by, reviewed_by_name, reviewed_at,
              review_notes, review_values)
  on leads to authenticated;

create policy leads_review_update on leads for update
  using (account_id = current_account_id() or is_hayas_admin())
  with check (account_id = current_account_id() or is_hayas_admin());

drop view if exists kpi_summary;
create view kpi_summary as
select
  account_id,
  count(*) filter (where status = 'sql')           as sql_count,
  count(*) filter (where status = 'mql')           as mql_count,
  count(*) filter (where status = 'manual_review') as manual_count,
  count(*) filter (where status = 'discarded')     as discarded_count,
  count(*) filter (where high_intent_override)     as high_intent_count,
  count(*) filter (where data_source = 'ecdb')     as ecdb_covered_count,
  count(*)                                         as total_leads,
  round(
    100.0 * count(*) filter (where not missing_ecdb) / nullif(count(*), 0), 1
  ) as coverage_rate_pct,
  round(avg(score_total), 1)                       as avg_score
from leads
group by account_id;

alter view kpi_summary set (security_invoker = on);
grant select on kpi_summary to authenticated;

alter publication supabase_realtime add table leads;