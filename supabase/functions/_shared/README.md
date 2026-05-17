# Shared Edge Function Secrets

This folder contains shared helpers for Supabase Edge Functions.

## Required secrets

Configure these secrets in Supabase Dashboard → Settings → Edge Function Secrets:

- `RESEND_API_KEY`
- `ALERT_FROM_EMAIL`
- `SYSTEM_ACTOR_ID`

The alert system also requires the following environment values at runtime:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
