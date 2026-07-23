DELETE FROM lead_score_history WHERE domain IN ('rokit.co.uk','foliosociety.com') OR domain LIKE 'test-%';
DELETE FROM leads WHERE domain IN ('rokit.co.uk','foliosociety.com') OR domain LIKE 'test-%';
DELETE FROM ops_log WHERE workflow_name = 'lead-accelerator__healthcheck' AND run_at = '2026-07-24T07:00:00Z';