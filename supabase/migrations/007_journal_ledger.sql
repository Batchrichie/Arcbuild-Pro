-- =============================================================================
-- ARCBUILD PRO — Migration 007: Journal and Ledger Posting
-- Phase 2, Module 2.3
--
-- Adds system service actor support, the ledger posting tables, balance validation,
-- and invoice journal / FX variance posting functions.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STEP 0: System service account and missing chart-of-accounts codes
-- -----------------------------------------------------------------------------

INSERT INTO roles (name, description)
VALUES ('system', 'System service account for Edge Function actor tracking')
ON CONFLICT (name) DO NOTHING;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'users'
          AND n.nspname = 'auth'
    ) THEN
        INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at)
        SELECT
            '00000000-0000-0000-0000-000000000001'::uuid,
            'authenticated',
            'system',
            'system@arcbuild.local',
            NOW(),
            jsonb_build_object('full_name', 'ARCBUILD System', 'role', 'system'),
            NOW()
        WHERE NOT EXISTS (
            SELECT 1 FROM auth.users WHERE id = '00000000-0000-0000-0000-000000000001'::uuid
        );

        -- Insert a profiles row whose primary key equals the system user's UUID.
        INSERT INTO profiles (id, user_id, role, full_name)
        SELECT id, id, 'system', 'ARCBUILD System'
        FROM auth.users
        WHERE id = '00000000-0000-0000-0000-000000000001'::uuid
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
END;
$$;

-- No COA inserts here; use existing seeded chart_of_accounts from migration 001.
-- Ensure we do not duplicate or conflict with Phase 1 COA seeds.

-- -----------------------------------------------------------------------------
-- STEP 1: Ledger posting table + journal entry metadata
-- -----------------------------------------------------------------------------

-- Consolidate Phase 1 `journal_lines` into the ledger structure.
-- If `journal_lines` exists, rename it to `ledger_entries` and extend its schema to the
-- full transactional ledger format. This avoids having two parallel line tables.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'journal_lines') THEN
        -- If ledger_entries already exists, drop it to avoid duplication, then rename
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ledger_entries') THEN
            DROP TABLE ledger_entries;
        END IF;

        ALTER TABLE journal_lines RENAME TO ledger_entries;

        -- Add transactional columns if missing
        ALTER TABLE ledger_entries
            ADD COLUMN IF NOT EXISTS account_name text DEFAULT '';

        ALTER TABLE ledger_entries
            ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id);

        ALTER TABLE ledger_entries
            ADD COLUMN IF NOT EXISTS division_id uuid REFERENCES divisions(id);

        ALTER TABLE ledger_entries
            ADD COLUMN IF NOT EXISTS currency text DEFAULT 'GHS';

        ALTER TABLE ledger_entries
            ADD COLUMN IF NOT EXISTS foreign_amount numeric(18,2);

        ALTER TABLE ledger_entries
            ADD COLUMN IF NOT EXISTS fx_rate numeric(18,6);

        -- Ensure column names match the newer naming convention
        BEGIN
            ALTER TABLE ledger_entries RENAME COLUMN debit TO debit_amount;
        EXCEPTION WHEN undefined_column THEN
            -- already renamed
            NULL;
        END;

        BEGIN
            ALTER TABLE ledger_entries RENAME COLUMN credit TO credit_amount;
        EXCEPTION WHEN undefined_column THEN
            NULL;
        END;

        -- Add indexes used by the ledger engine
        CREATE INDEX IF NOT EXISTS idx_ledger_account_code ON ledger_entries(account_code);
        CREATE INDEX IF NOT EXISTS idx_ledger_journal_entry ON ledger_entries(journal_entry_id);
        CREATE INDEX IF NOT EXISTS idx_ledger_project ON ledger_entries(project_id);
        CREATE INDEX IF NOT EXISTS idx_ledger_division ON ledger_entries(division_id);
        CREATE INDEX IF NOT EXISTS idx_ledger_client ON ledger_entries(client_id);
    ELSE
        -- If journal_lines does not exist, create ledger_entries with the desired schema
        CREATE TABLE IF NOT EXISTS ledger_entries (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            journal_entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE RESTRICT,
            account_code text NOT NULL REFERENCES chart_of_accounts(account_code),
            account_name text NOT NULL,
            debit_amount numeric(18,2) DEFAULT 0,
            credit_amount numeric(18,2) DEFAULT 0,
            description text,
            client_id uuid REFERENCES clients(id),
            project_id uuid REFERENCES projects(id),
            division_id uuid REFERENCES divisions(id),
            currency text DEFAULT 'GHS',
            foreign_amount numeric(18,2),
            fx_rate numeric(18,6),
            created_at timestamptz DEFAULT now(),
            constraint debit_or_credit_not_both check (NOT (debit_amount > 0 AND credit_amount > 0)),
            constraint amounts_not_negative check (debit_amount >= 0 AND credit_amount >= 0)
        );

        CREATE INDEX IF NOT EXISTS idx_ledger_account_code ON ledger_entries(account_code);
        CREATE INDEX IF NOT EXISTS idx_ledger_journal_entry ON ledger_entries(journal_entry_id);
        CREATE INDEX IF NOT EXISTS idx_ledger_project ON ledger_entries(project_id);
        CREATE INDEX IF NOT EXISTS idx_ledger_division ON ledger_entries(division_id);
        CREATE INDEX IF NOT EXISTS idx_ledger_client ON ledger_entries(client_id);
    END IF;
END;
$$;

-- Ensure journal_entries has the metadata columns required by the ledger system
ALTER TABLE journal_entries
    ADD COLUMN IF NOT EXISTS entry_number text;
ALTER TABLE journal_entries
    ADD COLUMN IF NOT EXISTS source_type text;
ALTER TABLE journal_entries
    ADD COLUMN IF NOT EXISTS source_id uuid;
ALTER TABLE journal_entries
    ADD COLUMN IF NOT EXISTS posted_by uuid REFERENCES profiles(id) ON DELETE RESTRICT;
ALTER TABLE journal_entries
    ADD COLUMN IF NOT EXISTS is_reversed boolean DEFAULT false;
ALTER TABLE journal_entries
    ADD COLUMN IF NOT EXISTS reversal_of uuid REFERENCES journal_entries(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_entries_entry_number ON journal_entries(entry_number);

-- -----------------------------------------------------------------------------
-- STEP 2: Journal entry numbering trigger
-- -----------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS journal_entry_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_journal_entry_number()
RETURNS trigger AS $$
BEGIN
    IF NEW.entry_number IS NULL OR NEW.entry_number = '' THEN
        NEW.entry_number := 'JE-' || extract(year FROM now())::text
            || '-' || lpad(nextval('journal_entry_number_seq')::text, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_journal_entry_number ON journal_entries;
CREATE TRIGGER set_journal_entry_number
    BEFORE INSERT ON journal_entries
    FOR EACH ROW
    WHEN (NEW.entry_number IS NULL OR NEW.entry_number = '')
    EXECUTE FUNCTION generate_journal_entry_number();

-- -----------------------------------------------------------------------------
-- STEP 3: Balance validation helper
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION validate_journal_balance(journal_uuid uuid)
RETURNS boolean AS $$
DECLARE
    total_debits numeric;
    total_credits numeric;
BEGIN
    SELECT
        COALESCE(SUM(debit_amount), 0),
        COALESCE(SUM(credit_amount), 0)
    INTO total_debits, total_credits
    FROM ledger_entries
    WHERE journal_entry_id = journal_uuid;

    RETURN ABS(total_debits - total_credits) < 0.01;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- STEP 4: Ledger RLS for service-mode access only
-- -----------------------------------------------------------------------------

ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ledger_entries_ceo_select ON ledger_entries;
CREATE POLICY ledger_entries_ceo_select ON ledger_entries FOR SELECT
    USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('ceo', 'accountant', 'director'));

-- -----------------------------------------------------------------------------
-- STEP 5: Invoice journal posting function
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION post_invoice_journal(invoice_uuid uuid, actor_uuid uuid)
RETURNS jsonb AS $$
DECLARE
    inv invoices%ROWTYPE;
    actor_role text;
    actor_profile_id uuid;
    division_name text;
    journal_id uuid;
    cash_account text;
    revenue_account text;
    total_debits numeric;
    total_credits numeric;
BEGIN
    SELECT * INTO inv FROM invoices WHERE id = invoice_uuid FOR UPDATE;
    IF inv.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
    END IF;

    SELECT role, id INTO actor_role, actor_profile_id
    FROM profiles
    WHERE user_id = actor_uuid
    LIMIT 1;

    IF actor_role IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Actor profile not found');
    END IF;

    IF inv.status != 'approved' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice must be approved before posting journal');
    END IF;

    IF EXISTS (
        SELECT 1
        FROM journal_entries
        WHERE source_type = 'invoice'
          AND source_id = invoice_uuid
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Journal already posted for this invoice');
    END IF;

    SELECT name INTO division_name FROM divisions WHERE id = inv.division_id;
    revenue_account := CASE division_name
        WHEN 'Construction' THEN '4100'
        WHEN 'Architecture' THEN '4200'
        WHEN 'Real Estate' THEN '4300'
        WHEN 'Logistics' THEN '4400'
        ELSE NULL
    END;

    IF revenue_account IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unknown division: ' || COALESCE(division_name, 'NULL'));
    END IF;

    cash_account := CASE inv.currency
        WHEN 'GHS' THEN '1101'
        WHEN 'USD' THEN '1102'
        WHEN 'GBP' THEN '1103'
        WHEN 'EUR' THEN '1104'
        ELSE NULL
    END;

    IF cash_account IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unsupported invoice currency: ' || inv.currency);
    END IF;

    INSERT INTO journal_entries (
        entry_date,
        description,
        reference,
        source_type,
        source_id,
        posted_by,
        created_by
    ) VALUES (
        CURRENT_DATE,
        'Invoice ' || inv.invoice_number || ' posting',
        inv.invoice_number,
        'invoice',
        invoice_uuid,
        actor_profile_id,
        actor_profile_id
    ) RETURNING id INTO journal_id;

    INSERT INTO ledger_entries (
        journal_entry_id, account_code, account_name,
        debit_amount, credit_amount, description,
        client_id, project_id, division_id,
        currency, foreign_amount, fx_rate
    ) VALUES (
        journal_id, '1110', 'Accounts Receivable',
        inv.gross_total_ghs, 0,
        'Invoice ' || inv.invoice_number,
        inv.client_id, inv.project_id, inv.division_id,
        inv.currency, inv.gross_total, inv.fx_rate_to_ghs
    );

    INSERT INTO ledger_entries (
        journal_entry_id, account_code, account_name,
        debit_amount, credit_amount, description,
        client_id, project_id, division_id,
        currency, foreign_amount, fx_rate
    ) VALUES (
        journal_id, revenue_account, division_name || ' Revenue',
        0, COALESCE(inv.subtotal_ghs, inv.gross_total_ghs - COALESCE(inv.vat_amount_ghs,0) - COALESCE(inv.nhil_amount_ghs,0) - COALESCE(inv.getfund_amount_ghs,0)),
        'Invoice ' || inv.invoice_number,
        inv.client_id, inv.project_id, inv.division_id,
        inv.currency, inv.subtotal, inv.fx_rate_to_ghs
    );

    IF inv.vat_amount > 0 THEN
        INSERT INTO ledger_entries (
            journal_entry_id, account_code, account_name,
            debit_amount, credit_amount, description, division_id
        ) VALUES (
            journal_id, '2102', 'VAT Payable',
            0, inv.vat_amount_ghs,
            'VAT on Invoice ' || inv.invoice_number,
            inv.division_id
        );
    END IF;

    IF inv.nhil_amount > 0 THEN
        INSERT INTO ledger_entries (
            journal_entry_id, account_code, account_name,
            debit_amount, credit_amount, description, division_id
        ) VALUES (
            journal_id, '2103', 'NHIL Payable',
            0, inv.nhil_amount_ghs,
            'NHIL on Invoice ' || inv.invoice_number,
            inv.division_id
        );
    END IF;

    IF inv.getfund_amount > 0 THEN
        INSERT INTO ledger_entries (
            journal_entry_id, account_code, account_name,
            debit_amount, credit_amount, description, division_id
        ) VALUES (
            journal_id, '2104', 'GetFUND Levy Payable',
            0, inv.getfund_amount_ghs,
            'GetFUND on Invoice ' || inv.invoice_number,
            inv.division_id
        );
    END IF;

    IF inv.wht_amount > 0 THEN
        INSERT INTO ledger_entries (
            journal_entry_id, account_code, account_name,
            debit_amount, credit_amount, description, client_id, division_id
        ) VALUES (
            journal_id, '1111', 'Withholding Tax Receivable',
            inv.wht_amount_ghs, 0,
            'WHT on Invoice ' || inv.invoice_number,
            inv.client_id, inv.division_id
        );

        INSERT INTO ledger_entries (
            journal_entry_id, account_code, account_name,
            debit_amount, credit_amount, description, client_id, division_id
        ) VALUES (
            journal_id, '1110', 'Accounts Receivable',
            0, inv.wht_amount_ghs,
            'WHT reduction on Invoice ' || inv.invoice_number,
            inv.client_id, inv.division_id
        );
    END IF;

    SELECT
        COALESCE(SUM(debit_amount), 0),
        COALESCE(SUM(credit_amount), 0)
    INTO total_debits, total_credits
    FROM ledger_entries
    WHERE journal_entry_id = journal_id;

    IF ABS(total_debits - total_credits) >= 0.01 THEN
        RAISE EXCEPTION 'Journal does not balance. Debits: %, Credits: %', total_debits, total_credits;
    END IF;

    INSERT INTO audit_log (
        user_id,
        action,
        table_name,
        record_id,
        old_value,
        new_value,
        created_at
    ) VALUES (
        actor_profile_id,
        'INSERT',
        'journal_entries',
        journal_id,
        NULL,
        jsonb_build_object(
            'invoice_id', invoice_uuid,
            'invoice_number', inv.invoice_number,
            'total_debits', total_debits,
            'total_credits', total_credits,
            'division', division_name
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'journal_entry_id', journal_id,
        'total_posted_ghs', total_debits
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', sqlerrm);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- -----------------------------------------------------------------------------
-- STEP 6: FX gain/loss journal posting
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION post_fx_gainloss_journal(invoice_uuid uuid, actor_uuid uuid)
RETURNS jsonb AS $$
DECLARE
    inv invoices%ROWTYPE;
    actor_role text;
    actor_profile_id uuid;
    journal_id uuid;
    cash_account text;
    amount numeric;
BEGIN
    SELECT * INTO inv FROM invoices WHERE id = invoice_uuid FOR UPDATE;
    IF inv.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
    END IF;

    SELECT role, id INTO actor_role, actor_profile_id
    FROM profiles
    WHERE user_id = actor_uuid
    LIMIT 1;

    IF actor_role IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Actor profile not found');
    END IF;

    IF ABS(inv.fx_gain_loss_ghs) < 0.01 THEN
        RETURN jsonb_build_object('success', true, 'message', 'No FX variance to post');
    END IF;

    cash_account := CASE inv.currency
        WHEN 'GHS' THEN '1101'
        WHEN 'USD' THEN '1102'
        WHEN 'GBP' THEN '1103'
        WHEN 'EUR' THEN '1104'
        ELSE NULL
    END;

    IF cash_account IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unsupported invoice currency: ' || inv.currency);
    END IF;

    INSERT INTO journal_entries (
        entry_date,
        description,
        reference,
        source_type,
        source_id,
        posted_by,
        created_by
    ) VALUES (
        CURRENT_DATE,
        CASE WHEN inv.fx_gain_loss_ghs > 0 THEN 'FX Gain on Invoice ' || inv.invoice_number
             ELSE 'FX Loss on Invoice ' || inv.invoice_number END,
        inv.invoice_number,
        'fx_adjustment',
        invoice_uuid,
        actor_profile_id,
        actor_profile_id
    ) RETURNING id INTO journal_id;

    amount := ABS(inv.fx_gain_loss_ghs);

    IF inv.fx_gain_loss_ghs > 0 THEN
        INSERT INTO ledger_entries (
            journal_entry_id, account_code, account_name,
            debit_amount, credit_amount, description, division_id
        ) VALUES (
            journal_id, cash_account, 'Cash and Bank',
            amount, 0,
            'FX gain on ' || inv.invoice_number,
            inv.division_id
        );

        INSERT INTO ledger_entries (
            journal_entry_id, account_code, account_name,
            debit_amount, credit_amount, description
        ) VALUES (
            journal_id, '4501', 'FX Gain',
            0, amount,
            'FX gain on ' || inv.invoice_number
        );
    ELSE
        INSERT INTO ledger_entries (
            journal_entry_id, account_code, account_name,
            debit_amount, credit_amount, description
        ) VALUES (
            journal_id, '6303', 'FX Loss',
            amount, 0,
            'FX loss on ' || inv.invoice_number
        );

        INSERT INTO ledger_entries (
            journal_entry_id, account_code, account_name,
            debit_amount, credit_amount, description, division_id
        ) VALUES (
            journal_id, cash_account, 'Cash and Bank',
            0, amount,
            'FX loss on ' || inv.invoice_number,
            inv.division_id
        );
    END IF;

    IF NOT validate_journal_balance(journal_id) THEN
        RAISE EXCEPTION 'FX journal does not balance for invoice %', inv.invoice_number;
    END IF;

    INSERT INTO audit_log (
        user_id,
        action,
        table_name,
        record_id,
        old_value,
        new_value,
        created_at
    ) VALUES (
        actor_profile_id,
        'INSERT',
        'journal_entries',
        journal_id,
        NULL,
        jsonb_build_object(
            'invoice_id', invoice_uuid,
            'invoice_number', inv.invoice_number,
            'fx_gain_loss_ghs', inv.fx_gain_loss_ghs
        ),
        NOW()
    );

    RETURN jsonb_build_object('success', true, 'journal_entry_id', journal_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', sqlerrm);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
