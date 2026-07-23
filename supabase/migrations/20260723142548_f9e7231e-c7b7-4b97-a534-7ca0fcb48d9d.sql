revoke insert, update, delete on public.leads from authenticated, anon;
revoke insert, update, delete on public.accounts from authenticated, anon;
revoke insert, update, delete on public.profiles from authenticated, anon;
revoke insert, update, delete on public.ops_log from authenticated, anon;
revoke insert, update, delete on public.lead_score_history from authenticated, anon;

grant update (review_state, reviewed_by, reviewed_by_name, reviewed_at,
              review_notes, review_values)
  on public.leads to authenticated;