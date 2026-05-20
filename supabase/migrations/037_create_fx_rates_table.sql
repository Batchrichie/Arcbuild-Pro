-- Migration: create fx_rates table
-- Adds a table to store daily FX rates fetched from Bank of Ghana

CREATE TABLE IF NOT EXISTS fx_rates (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rate_date date NOT NULL,
  currency text NOT NULL,
  code text NOT NULL,
  buy numeric,
  sell numeric,
  median numeric,
  source text DEFAULT 'BOG',
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS fx_rates_rate_date_code_idx ON fx_rates (rate_date, code);
