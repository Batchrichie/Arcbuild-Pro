-- =============================================================================
-- Migration 047: GL integrity — auto-post invoice journals, block orphan payments,
-- backfill missing invoice GL entries, integrity diagnostics.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.invoice_has_gl_posting(invoice_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM journal_entries
    WHERE source_type = 'invoice'
      AND source_id = invoice_uuid
  );
$$;

-- Allow late posting for backfill (sent/paid invoices missing GL)
CREATE OR REPLACE FUNCTION post_invoice_journal(
  invoice_uuid UUID,
  actor_uuid UUID,
  allow_late_post BOOLEAN DEFAULT FALSE
)
RETURNS JSONB AS $$
DECLARE
    inv invoices%ROWTYPE;
    actor_role TEXT;
    actor_profile_id UUID;
    division_name TEXT;
    journal_id UUID;
    revenue_account TEXT;
    total_debits NUMERIC;
    total_credits NUMERIC;
BEGIN
    SELECT * INTO inv FROM invoices WHERE id = invoice_uuid FOR UPDATE;
    IF inv.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
    END IF;

    SELECT role, id INTO actor_role, actor_profile_id
    FROM profiles
    WHERE user_id = actor_uuid
    LIMIT 1;

    IF actor_profile_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Actor profile not found');
    END IF;

    IF NOT allow_late_post AND inv.status != 'approved' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice must be approved before posting journal');
    END IF;

    IF allow_late_post AND inv.status NOT IN ('approved', 'sent', 'paid') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice status not eligible for GL backfill');
    END IF;

    IF public.invoice_has_gl_posting(invoice_uuid) THEN
        RETURN jsonb_build_object('success', true, 'message', 'Journal already posted', 'skipped', true);
    END IF;

    SELECT name INTO division_name FROM divisions WHERE id = inv.division_id;
    revenue_account := CASE division_name
        WHEN 'Construction' THEN '4100'
        WHEN 'Architecture' THEN '4200'
        WHEN 'Real Estate' THEN '4300'
        WHEN 'Logistics' THEN '4400'
        ELSE '4500'
    END;

    INSERT INTO journal_entries (
        entry_date, description, reference, source_type, source_id,
        posted_by, created_by, is_posted
    ) VALUES (
        COALESCE(inv.approved_at::date, CURRENT_DATE),
        'Invoice ' || inv.invoice_number || ' posting',
        inv.invoice_number,
        'invoice',
        invoice_uuid,
        actor_profile_id,
        actor_profile_id,
        TRUE
    ) RETURNING id INTO journal_id;

    INSERT INTO ledger_entries (
        journal_entry_id, account_code, account_name,
        debit_amount, credit_amount, description,
        client_id, project_id, division_id, currency, foreign_amount, fx_rate
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
        client_id, project_id, division_id, currency, foreign_amount, fx_rate
    ) VALUES (
        journal_id, revenue_account, COALESCE(division_name, 'General') || ' Revenue',
        0, COALESCE(inv.subtotal_ghs, inv.gross_total_ghs - COALESCE(inv.vat_amount_ghs, 0) - COALESCE(inv.nhil_amount_ghs, 0) - COALESCE(inv.getfund_amount_ghs, 0)),
        'Invoice ' || inv.invoice_number,
        inv.client_id, inv.project_id, inv.division_id,
        inv.currency, inv.subtotal, inv.fx_rate_to_ghs
    );

    IF COALESCE(inv.vat_amount_ghs, 0) > 0 THEN
        INSERT INTO ledger_entries (journal_entry_id, account_code, account_name, debit_amount, credit_amount, description, division_id)
        VALUES (journal_id, '2102', 'VAT Payable', 0, inv.vat_amount_ghs, 'VAT on Invoice ' || inv.invoice_number, inv.division_id);
    END IF;

    IF COALESCE(inv.nhil_amount_ghs, 0) > 0 THEN
        INSERT INTO ledger_entries (journal_entry_id, account_code, account_name, debit_amount, credit_amount, description, division_id)
        VALUES (journal_id, '2103', 'NHIL Payable', 0, inv.nhil_amount_ghs, 'NHIL on Invoice ' || inv.invoice_number, inv.division_id);
    END IF;

    IF COALESCE(inv.getfund_amount_ghs, 0) > 0 THEN
        INSERT INTO ledger_entries (journal_entry_id, account_code, account_name, debit_amount, credit_amount, description, division_id)
        VALUES (journal_id, '2104', 'GetFUND Levy Payable', 0, inv.getfund_amount_ghs, 'GetFUND on Invoice ' || inv.invoice_number, inv.division_id);
    END IF;

    IF COALESCE(inv.wht_amount_ghs, 0) > 0 THEN
        INSERT INTO ledger_entries (journal_entry_id, account_code, account_name, debit_amount, credit_amount, description, client_id, division_id)
        VALUES (journal_id, '1111', 'Withholding Tax Receivable', inv.wht_amount_ghs, 0, 'WHT on Invoice ' || inv.invoice_number, inv.client_id, inv.division_id);

        INSERT INTO ledger_entries (journal_entry_id, account_code, account_name, debit_amount, credit_amount, description, client_id, division_id)
        VALUES (journal_id, '1110', 'Accounts Receivable', 0, inv.wht_amount_ghs, 'WHT reduction on Invoice ' || inv.invoice_number, inv.client_id, inv.division_id);
    END IF;

    SELECT COALESCE(SUM(debit_amount), 0), COALESCE(SUM(credit_amount), 0)
    INTO total_debits, total_credits
    FROM ledger_entries
    WHERE journal_entry_id = journal_id;

    IF ABS(total_debits - total_credits) >= 0.01 THEN
        DELETE FROM ledger_entries WHERE journal_entry_id = journal_id;
        DELETE FROM journal_entries WHERE id = journal_id;
        RETURN jsonb_build_object('success', false, 'error',
          format('Invoice journal does not balance. Debits: %s, Credits: %s', total_debits, total_credits));
    END IF;

    RETURN jsonb_build_object('success', true, 'journal_entry_id', journal_id, 'total_posted_ghs', total_debits);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


CREATE OR REPLACE FUNCTION transition_invoice_status(
    invoice_uuid UUID,
    new_status invoice_status,
    acting_user_id UUID,
    rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    inv invoices%ROWTYPE;
    actor_role TEXT;
    actor_profile_id UUID;
    journal_result JSONB;
BEGIN
    SELECT * INTO inv FROM invoices WHERE id = invoice_uuid;
    IF inv.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
    END IF;

    SELECT role, id INTO actor_role, actor_profile_id
    FROM profiles
    WHERE user_id = acting_user_id
    LIMIT 1;

    IF actor_profile_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Actor profile not found');
    END IF;

    IF NOT (
        (inv.status = 'draft' AND new_status = 'pending_approval'
            AND inv.requires_approval = TRUE AND actor_role = 'accountant')
        OR (inv.status = 'draft' AND new_status = 'approved'
            AND inv.requires_approval = FALSE AND actor_role = 'accountant')
        OR (inv.status = 'pending_approval' AND new_status = 'approved'
            AND actor_role IN ('ceo', 'director'))
        OR (inv.status = 'pending_approval' AND new_status = 'rejected'
            AND actor_role IN ('ceo', 'director') AND rejection_reason IS NOT NULL)
        OR (inv.status = 'rejected' AND new_status = 'draft' AND actor_role = 'accountant')
        OR (inv.status = 'approved' AND new_status = 'sent'
            AND actor_role IN ('accountant', 'system'))
        OR (inv.status = 'sent' AND new_status = 'paid' AND actor_role = 'accountant')
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('Transition from %s to %s is not permitted for role %s', inv.status, new_status, actor_role)
        );
    END IF;

    -- Post invoice to GL before marking sent (while status is still approved)
    IF new_status = 'sent' AND inv.status = 'approved' AND NOT public.invoice_has_gl_posting(invoice_uuid) THEN
        journal_result := post_invoice_journal(invoice_uuid, acting_user_id, FALSE);
        IF NOT COALESCE((journal_result->>'success')::BOOLEAN, FALSE) THEN
            RETURN jsonb_build_object('success', false, 'error', COALESCE(journal_result->>'error', 'Failed to post invoice to ledger'));
        END IF;
    END IF;

    UPDATE invoices SET
        status = new_status,
        approved_by = CASE WHEN new_status = 'approved' THEN acting_user_id ELSE approved_by END,
        approved_at = CASE WHEN new_status = 'approved' THEN NOW() ELSE approved_at END,
        rejected_by = CASE WHEN new_status = 'rejected' THEN acting_user_id ELSE rejected_by END,
        rejected_at = CASE WHEN new_status = 'rejected' THEN NOW() ELSE rejected_at END,
        rejection_note = CASE
            WHEN new_status = 'rejected' THEN rejection_reason
            WHEN new_status = 'draft' THEN NULL
            ELSE rejection_note
        END,
        updated_at = NOW()
    WHERE id = invoice_uuid;

    -- Post invoice to GL immediately on approval
    IF new_status = 'approved' AND NOT public.invoice_has_gl_posting(invoice_uuid) THEN
        journal_result := post_invoice_journal(invoice_uuid, acting_user_id, FALSE);
        IF NOT COALESCE((journal_result->>'success')::BOOLEAN, FALSE) THEN
            RAISE EXCEPTION 'Invoice approved but GL posting failed: %', COALESCE(journal_result->>'error', 'unknown');
        END IF;
    END IF;

    INSERT INTO audit_log (user_id, action, table_name, record_id, old_value, new_value, created_at)
    VALUES (
        actor_profile_id, 'UPDATE', 'invoices', invoice_uuid,
        jsonb_build_object('from_status', inv.status, 'to_status', new_status),
        jsonb_build_object('from_status', inv.status, 'to_status', new_status),
        NOW()
    );

    RETURN jsonb_build_object('success', true, 'new_status', new_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


CREATE OR REPLACE FUNCTION public.backfill_missing_invoice_journals(acting_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    inv RECORD;
    jr JSONB;
    posted INT := 0;
    skipped INT := 0;
    errors JSONB := '[]'::JSONB;
BEGIN
    FOR inv IN
        SELECT id, invoice_number, status
        FROM invoices
        WHERE status IN ('approved', 'sent', 'paid')
          AND NOT public.invoice_has_gl_posting(id)
        ORDER BY created_at
    LOOP
        jr := post_invoice_journal(inv.id, acting_user_id, TRUE);
        IF COALESCE((jr->>'success')::BOOLEAN, FALSE) THEN
            IF COALESCE((jr->>'skipped')::BOOLEAN, FALSE) THEN
                skipped := skipped + 1;
            ELSE
                posted := posted + 1;
            END IF;
        ELSE
            errors := errors || jsonb_build_array(jsonb_build_object(
                'invoice_number', inv.invoice_number,
                'error', jr->>'error'
            ));
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', jsonb_array_length(errors) = 0,
        'posted', posted,
        'skipped', skipped,
        'errors', errors
    );
END;
$$;


CREATE OR REPLACE FUNCTION public.get_gl_integrity_report()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    total_dr NUMERIC;
    total_cr NUMERIC;
    issues JSONB := '[]'::JSONB;
    inv RECORD;
    acct RECORD;
BEGIN
    SELECT COALESCE(SUM(debit_amount), 0), COALESCE(SUM(credit_amount), 0)
    INTO total_dr, total_cr
    FROM ledger_entries;

    IF ABS(total_dr - total_cr) > 0.01 THEN
        issues := issues || jsonb_build_array(jsonb_build_object(
            'severity', 'critical',
            'code', 'trial_balance_imbalance',
            'message', format('Trial balance out by GHS %s (Debits %s vs Credits %s)',
                ABS(total_dr - total_cr)::TEXT, total_dr::TEXT, total_cr::TEXT)
        ));
    END IF;

    FOR inv IN
        SELECT i.invoice_number, i.status, i.gross_total_ghs
        FROM invoices i
        WHERE i.status IN ('sent', 'paid')
          AND NOT public.invoice_has_gl_posting(i.id)
    LOOP
        issues := issues || jsonb_build_array(jsonb_build_object(
            'severity', 'critical',
            'code', 'missing_invoice_journal',
            'message', format('Invoice %s (%s) has no GL posting — AR debit missing before payments', inv.invoice_number, inv.status),
            'invoice_number', inv.invoice_number
        ));
    END LOOP;

    FOR acct IN
        SELECT le.account_code, coa.account_name, coa.account_type,
               SUM(le.debit_amount) AS dr, SUM(le.credit_amount) AS cr
        FROM ledger_entries le
        JOIN chart_of_accounts coa ON coa.account_code = le.account_code
        GROUP BY le.account_code, coa.account_name, coa.account_type
        HAVING (
            (coa.account_type = 'asset' AND SUM(le.debit_amount) - SUM(le.credit_amount) < -0.01)
            OR (coa.account_type = 'expense' AND SUM(le.credit_amount) - SUM(le.debit_amount) > 0.01)
            OR (coa.account_type = 'revenue' AND SUM(le.debit_amount) - SUM(le.credit_amount) > 0.01)
        )
    LOOP
        issues := issues || jsonb_build_array(jsonb_build_object(
            'severity', 'warning',
            'code', 'abnormal_balance',
            'message', format('Account %s (%s) has an unusual balance — debits %s, credits %s. Check for reversed journals.',
                acct.account_code, acct.account_name, acct.dr::TEXT, acct.cr::TEXT),
            'account_code', acct.account_code
        ));
    END LOOP;

    RETURN jsonb_build_object(
        'balanced', ABS(total_dr - total_cr) <= 0.01,
        'total_debits', total_dr,
        'total_credits', total_cr,
        'difference', total_dr - total_cr,
        'issues', issues
    );
END;
$$;


-- Patch payment recording: require invoice GL before accepting payment
CREATE OR REPLACE FUNCTION public.record_invoice_payment(
    invoice_uuid UUID,
    payment_date_val DATE,
    payment_reference_val TEXT,
    amount_received_ghs NUMERIC,
    payment_account_code TEXT DEFAULT NULL,
    acting_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    inv invoices%ROWTYPE;
    actor_role TEXT;
    actor_profile_id UUID;
    result JSONB;
    fx_gain_loss NUMERIC;
    journal_id UUID;
    cash_account TEXT;
    cash_account_name TEXT;
    expected_receipt NUMERIC;
    fx_variance NUMERIC;
    total_debits NUMERIC;
    total_credits NUMERIC;
BEGIN
    SELECT * INTO inv FROM invoices WHERE id = invoice_uuid;
    IF inv.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
    END IF;

    IF inv.status != 'sent' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice must be in SENT status to record payment');
    END IF;

    IF NOT public.invoice_has_gl_posting(invoice_uuid) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invoice has not been posted to the general ledger. Approve/post the invoice journal before recording payment.'
        );
    END IF;

    SELECT role, id INTO actor_role, actor_profile_id
    FROM profiles
    WHERE user_id = acting_user_id
    LIMIT 1;

    IF actor_profile_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Actor profile not found');
    END IF;

    fx_gain_loss := amount_received_ghs - COALESCE(inv.expected_receipt_ghs, 0);
    expected_receipt := COALESCE(inv.expected_receipt_ghs, 0);
    fx_variance := fx_gain_loss;

    UPDATE invoices SET
        payment_date = payment_date_val,
        payment_reference = payment_reference_val,
        fx_gain_loss_ghs = fx_gain_loss,
        updated_at = NOW()
    WHERE id = invoice_uuid;

    result := transition_invoice_status(invoice_uuid, 'paid', acting_user_id);
    IF NOT COALESCE((result->>'success')::BOOLEAN, FALSE) THEN
        RETURN result;
    END IF;

    IF payment_account_code IS NOT NULL THEN
        SELECT account_name INTO cash_account_name
        FROM chart_of_accounts
        WHERE account_code = payment_account_code AND account_type = 'asset' AND is_active = TRUE
        LIMIT 1;
        IF cash_account_name IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Invalid payment account selected');
        END IF;
        cash_account := payment_account_code;
    ELSE
        cash_account := CASE inv.currency
            WHEN 'GHS' THEN '1101' WHEN 'USD' THEN '1102' WHEN 'GBP' THEN '1103' WHEN 'EUR' THEN '1104' ELSE NULL END;
        cash_account_name := CASE cash_account
            WHEN '1101' THEN 'Cash — GHS' WHEN '1102' THEN 'Cash — USD'
            WHEN '1103' THEN 'Cash — GBP' WHEN '1104' THEN 'Cash — EUR' ELSE NULL END;
        IF cash_account IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Unsupported invoice currency');
        END IF;
    END IF;

    INSERT INTO journal_entries (
        entry_date, description, reference, source_type, source_id,
        posted_by, created_by, is_posted
    ) VALUES (
        payment_date_val,
        'Payment received — Invoice ' || inv.invoice_number,
        inv.invoice_number, 'payment', invoice_uuid,
        actor_profile_id, actor_profile_id, TRUE
    ) RETURNING id INTO journal_id;

    INSERT INTO ledger_entries (
        journal_entry_id, account_code, account_name,
        debit_amount, credit_amount, description,
        client_id, project_id, division_id, currency
    ) VALUES (
        journal_id, cash_account, cash_account_name,
        amount_received_ghs, 0,
        'Payment received for invoice ' || inv.invoice_number,
        inv.client_id, inv.project_id, inv.division_id, inv.currency
    );

    IF ABS(fx_variance) > 0.01 THEN
        IF fx_variance > 0 THEN
            INSERT INTO ledger_entries (journal_entry_id, account_code, account_name, debit_amount, credit_amount, description, client_id, project_id, division_id, currency)
            VALUES (journal_id, '1110', 'Accounts Receivable', 0, expected_receipt, 'AR clearance ' || inv.invoice_number, inv.client_id, inv.project_id, inv.division_id, inv.currency);
            INSERT INTO ledger_entries (journal_entry_id, account_code, account_name, debit_amount, credit_amount, description, client_id, project_id, division_id, currency)
            VALUES (journal_id, '4501', 'FX Gain', 0, fx_variance, 'FX gain on payment ' || inv.invoice_number, inv.client_id, inv.project_id, inv.division_id, inv.currency);
        ELSE
            INSERT INTO ledger_entries (journal_entry_id, account_code, account_name, debit_amount, credit_amount, description, client_id, project_id, division_id, currency)
            VALUES (journal_id, '1110', 'Accounts Receivable', 0, expected_receipt, 'AR clearance ' || inv.invoice_number, inv.client_id, inv.project_id, inv.division_id, inv.currency);
            INSERT INTO ledger_entries (journal_entry_id, account_code, account_name, debit_amount, credit_amount, description, client_id, project_id, division_id, currency)
            VALUES (journal_id, '6303', 'FX Loss', ABS(fx_variance), 0, 'FX loss on payment ' || inv.invoice_number, inv.client_id, inv.project_id, inv.division_id, inv.currency);
        END IF;
    ELSE
        INSERT INTO ledger_entries (journal_entry_id, account_code, account_name, debit_amount, credit_amount, description, client_id, project_id, division_id, currency)
        VALUES (journal_id, '1110', 'Accounts Receivable', 0, amount_received_ghs, 'AR clearance ' || inv.invoice_number, inv.client_id, inv.project_id, inv.division_id, inv.currency);
    END IF;

    SELECT COALESCE(SUM(debit_amount), 0), COALESCE(SUM(credit_amount), 0)
    INTO total_debits, total_credits FROM ledger_entries WHERE journal_entry_id = journal_id;

    IF ABS(total_debits - total_credits) >= 0.01 THEN
        RAISE EXCEPTION 'Payment journal does not balance. DR: %, CR: %', total_debits, total_credits;
    END IF;

    RETURN jsonb_build_object('success', true, 'journal_entry_id', journal_id, 'fx_gain_loss_ghs', fx_gain_loss);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.invoice_has_gl_posting(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_missing_invoice_journals(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_gl_integrity_report() TO authenticated;
