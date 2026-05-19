-- =============================================================================
-- Migration 027: Timesheet Module
-- Adds timesheet approval workflow fields, approval function, and summary view.
-- =============================================================================

alter table timesheets
  add column if not exists hours_worked numeric(5,2) not null default 0,
  add column if not exists work_description text,
  add column if not exists status text not null default 'draft',
  add column if not exists submitted_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_reason text,
  add column if not exists week_start date,
  add column if not exists billable boolean default true;

alter table timesheets
  add constraint chk_timesheet_status check (
    status in ('draft', 'submitted', 'approved', 'rejected')
  );

alter table timesheets
  add constraint chk_timesheet_hours check (
    hours_worked >= 0 and hours_worked <= 24
  );

create or replace function approve_timesheet(
  timesheet_id_param uuid,
  actor_uuid uuid,
  action_param text,
  rejection_reason_param text default null
)
returns jsonb as $$
declare
  ts timesheets%rowtype;
  actor profiles%rowtype;
begin
  select * into ts from timesheets where id = timesheet_id_param;
  select * into actor from profiles where user_id = actor_uuid;

  if ts.id is null then
    return jsonb_build_object('success', false, 'error', 'Timesheet not found');
  end if;

  if ts.status != 'submitted' then
    return jsonb_build_object('success', false,
      'error', 'Only submitted timesheets can be approved or rejected');
  end if;

  if actor.role not in ('project_manager', 'hr_manager', 'accountant', 'ceo') then
    return jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  end if;

  if action_param = 'approve' then
    update timesheets set
      status = 'approved',
      approved_by = actor.id,
      approved_at = now()
    where id = timesheet_id_param;

    if ts.project_id is not null and ts.hours_worked > 0 then
      perform post_project_cost(
        ts.project_id,
        'Labour',
        'Timesheet: ' || ts.hours_worked || ' hours — ' ||
          coalesce(ts.work_description, ts.description, 'Site labour'),
        0,
        'GHS',
        ts.work_date::date,
        actor_uuid,
        null, null
      );
    end if;

  elsif action_param = 'reject' then
    if rejection_reason_param is null then
      return jsonb_build_object('success', false,
        'error', 'Rejection reason is required');
    end if;

    update timesheets set
      status = 'rejected',
      rejected_reason = rejection_reason_param
    where id = timesheet_id_param;
  else
    return jsonb_build_object('success', false,
      'error', 'action_param must be approve or reject');
  end if;

  insert into audit_log (
    table_name, record_id, action, actor_id, details
  ) values (
    'timesheets', timesheet_id_param,
    upper(action_param) || '_TIMESHEET',
    actor.id,
    jsonb_build_object(
      'hours_worked', ts.hours_worked,
      'project_id', ts.project_id,
      'rejection_reason', rejection_reason_param
    )
  );

  return jsonb_build_object(
    'success', true,
    'action', action_param,
    'timesheet_id', timesheet_id_param
  );

exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$ language plpgsql security definer;

create or replace view timesheet_summary as
select
  t.id,
  t.employee_id,
  p.full_name as employee_name,
  e.employee_number,
  e.department,
  t.work_date as date,
  t.week_start,
  t.project_id,
  proj.name as project_name,
  d.name as division_name,
  t.hours_worked,
  coalesce(t.work_description, t.description) as work_description,
  t.billable,
  t.status,
  t.submitted_at,
  t.approved_at,
  t.approved_by,
  ap.full_name as approved_by_name,
  t.rejected_reason
from timesheets t
join employees e on e.id = t.employee_id
join profiles p on p.id = e.profile_id
left join projects proj on proj.id = t.project_id
left join divisions d on d.id = proj.division_id
left join profiles ap on ap.id = t.approved_by
order by t.work_date desc;

grant select on timesheet_summary to authenticated;
