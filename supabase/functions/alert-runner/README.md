# Alert Runner Edge Function

This Edge Function runs the Smart Alert System for ARCBUILD PRO.

## Scheduling

The alert runner should be scheduled to execute daily.

### Option A — Supabase cron (pg_cron)

Use the Supabase SQL editor to schedule a daily POST to the deployed function URL.

```sql
-- Run daily at 7:00 AM UTC
select cron.schedule(
  'daily-alert-runner',
  '0 7 * * *',
  $$
  select net.http_post(
    url := current_setting('app.alert_runner_url'),
    headers := '{"Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb
  )
  $$
);
```

### Option B — External scheduler

Use an external scheduler to POST to the function endpoint:

```text
https://<project-ref>.supabase.co/functions/v1/alert-runner
```

## Notes

- The function must be deployed with access to the Supabase service role key.
- The Edge Function reads the following secrets from the environment:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SYSTEM_ACTOR_ID`
  - `RESEND_API_KEY`
  - `ALERT_FROM_EMAIL`
