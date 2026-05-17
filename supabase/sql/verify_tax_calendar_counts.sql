-- Verify tax_calendar rows and status assignments
select count(*) as calendar_rows,
       count(case when status = 'due' then 1 end) as due_count,
       count(case when status = 'upcoming' then 1 end) as upcoming_count
from tax_calendar;
