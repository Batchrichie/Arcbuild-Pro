-- Run once in Supabase SQL Editor to correct reversed Utilities (6202)
SELECT public.fix_utilities_6202_journal();

-- If function does not exist yet, run migration 049_post_manual_journal_security_definer.sql first,
-- or execute the INSERT block from that migration manually.
