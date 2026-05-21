-- =============================================================================
-- Migration 040: Recreate record_invoice_payment function
-- Ensures the payment recording function exists with the expected public schema
-- signature and behavior.
-- =============================================================================

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

    SELECT role, id INTO actor_role, actor_profile_id
    FROM profiles
    WHERE user_id = acting_user_id
    LIMIT 1;

    IF actor_role IS NULL THEN
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
        SELECT account_name
        INTO cash_account_name
        FROM chart_of_accounts
        WHERE account_code = payment_account_code
          AND account_type = 'asset'
          AND is_active = TRUE
        LIMIT 1;

        IF cash_account_name IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Invalid payment account selected');
        END IF;

        cash_account := payment_account_code;
    ELSE
        cash_account := CASE inv.currency
            WHEN 'GHS' THEN '1101'
            WHEN 'USD' THEN '1102'
            WHEN 'GBP' THEN '1103'
            WHEN 'EUR' THEN '1104'
            ELSE NULL
        END;

        cash_account_name := CASE cash_account
            WHEN '1101' THEN 'Cash — GHS'
            WHEN '1102' THEN 'Cash — USD'
            WHEN '1103' THEN 'Cash — GBP'
            WHEN '1104' THEN 'Cash — EUR'
            ELSE NULL
        END;

        IF cash_account IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Unsupported invoice currency: ' || COALESCE(inv.currency, 'NULL'));
        END IF;
    END IF;

    INSERT INTO journal_entries (
        entry_date,
        description,
        reference,
        source_type,
        source_id,
        posted_by,
        created_by,
        is_posted
    ) VALUES (
        payment_date_val,
        'Payment received — Invoice ' || inv.invoice_number,
        inv.invoice_number,
        'payment',
        invoice_uuid,
        actor_profile_id,
        actor_profile_id,
        TRUE
    ) RETURNING id INTO journal_id;

    INSERT INTO ledger_entries (
        journal_entry_id, account_code, account_name,
        debit_amount, credit_amount, description,
        client_id, project_id, division_id,
        currency, foreign_amount, fx_rate
    ) VALUES (
        journal_id, cash_account, cash_account_name,
        amount_received_ghs, 0,
        'Payment received for invoice ' || inv.invoice_number,
        inv.client_id, inv.project_id, inv.division_id,
        inv.currency, NULL, NULL
    );

    IF ABS(fx_variance) > 0.01 THEN
        IF fx_variance > 0 THEN
            INSERT INTO ledger_entries (
                journal_entry_id, account_code, account_name,
                debit_amount, credit_amount, description,
                client_id, project_id, division_id,
                currency, foreign_amount, fx_rate
            ) VALUES (
                journal_id, '1110', 'Accounts Receivable',
                0, expected_receipt,
                'Accounts Receivable reduction for invoice ' || inv.invoice_number,
                inv.client_id, inv.project_id, inv.division_id,
                inv.currency, NULL, NULL
            );

            INSERT INTO ledger_entries (
                journal_entry_id, account_code, account_name,
                debit_amount, credit_amount, description,
                client_id, project_id, division_id,
                currency, foreign_amount, fx_rate
            ) VALUES (
                journal_id, '4501', 'FX Gain',
                0, fx_variance,
                'Foreign exchange gain on invoice payment ' || inv.invoice_number,
                inv.client_id, inv.project_id, inv.division_id,
                inv.currency, NULL, NULL
            );
        ELSE
            INSERT INTO ledger_entries (
                journal_entry_id, account_code, account_name,
                debit_amount, credit_amount, description,
                client_id, project_id, division_id,
                currency, foreign_amount, fx_rate
            ) VALUES (
                journal_id, '1110', 'Accounts Receivable',
                0, expected_receipt,
                'Accounts Receivable reduction for invoice ' || inv.invoice_number,
                inv.client_id, inv.project_id, inv.division_id,
                inv.currency, NULL, NULL
            );

            INSERT INTO ledger_entries (
                journal_entry_id, account_code, account_name,
                debit_amount, credit_amount, description,
                client_id, project_id, division_id,
                currency, foreign_amount, fx_rate
            ) VALUES (
                journal_id, '6303', 'FX Loss',
                ABS(fx_variance), 0,
                'Foreign exchange loss on invoice payment ' || inv.invoice_number,
                inv.client_id, inv.project_id, inv.division_id,
                inv.currency, NULL, NULL
            );
        END IF;
    ELSE
        INSERT INTO ledger_entries (
            journal_entry_id, account_code, account_name,
            debit_amount, credit_amount, description,
            client_id, project_id, division_id,
            currency, foreign_amount, fx_rate
        ) VALUES (
            journal_id, '1110', 'Accounts Receivable',
            0, amount_received_ghs,
            'Accounts Receivable reduction for invoice ' || inv.invoice_number,
            inv.client_id, inv.project_id, inv.division_id,
            inv.currency, NULL, NULL
        );
    END IF;

    SELECT COALESCE(SUM(debit_amount), 0), COALESCE(SUM(credit_amount), 0)
    INTO total_debits, total_credits
    FROM ledger_entries
    WHERE journal_entry_id = journal_id;

    IF ABS(total_debits - total_credits) >= 0.01 THEN
        RAISE EXCEPTION 'Payment journal does not balance. DR: %, CR: %', total_debits, total_credits;
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
        'UPDATE',
        'invoices',
        invoice_uuid,
        jsonb_build_object(
            'payment_date', inv.payment_date,
            'payment_reference', inv.payment_reference,
            'fx_gain_loss_ghs', inv.fx_gain_loss_ghs,
            'status', inv.status
        ),
        jsonb_build_object(
            'payment_date', payment_date_val,
            'payment_reference', payment_reference_val,
            'fx_gain_loss_ghs', fx_gain_loss,
            'status', 'paid',
            'journal_entry_id', journal_id
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'fx_gain_loss_ghs', fx_gain_loss,
        'journal_entry_id', journal_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
