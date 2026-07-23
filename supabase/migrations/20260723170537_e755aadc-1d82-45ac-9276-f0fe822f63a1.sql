delete from lead_score_history where domain like '\_\_probe-%' escape '\';
delete from leads where domain like '\_\_probe-%' escape '\';