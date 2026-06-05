-- Migration: schedule BOG FX rate sync via Supabase cron
-- This job posts to the deployed schedule-bog-fx edge function every weekday at 08:00 GMT.
-- It requires pg_cron and pg_net to be enabled in the database.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove an existing schedule with the same name if present.
SELECT cron.unschedule('sync-bog-fx-rates')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'sync-bog-fx-rates'
);

-- Schedule the BOG FX sync every weekday at 08:00 GMT.
SELECT cron.schedule(
  'sync-bog-fx-rates',
  '0 8 * * 1-5',
  $$
  SELECT net.http_post(
    url := 'https://prpvozkyiybcffuccdoe.supabase.co/functions/v1/schedule-bog-fx',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
