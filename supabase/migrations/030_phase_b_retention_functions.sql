-- =============================================================================
-- Migration 030: Phase B Retention Functions
-- Adds journal posting functions for client retention withholding,
-- retention release, and subcontractor retention withholding.
-- =============================================================================

CREATE OR REPLACE FUNCTION post_retention_withheld_journal(
    p_invoice_id        UUID,
    p_project_id        UUID,
    p_retention_amount  NUMERIC,
    p_posted_by         UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    inv invoices%ROWTYPE;
    journal_id UUID;
    ar_name TEXT;
    retention_name TEXT;
BEGIN
    SELECT * INTO inv FROM invoices WHERE id = p_invoice_id;
    IF inv.id IS NULL THEN
        RAISE EXCEPTION 'Invoice not found';
    END IF;

    SELECT account_name INTO retention_name FROM chart_of_accounts WHERE account_code = '1300';
    SELECT account_name INTO ar_name         FROM chart_of_accounts WHERE account_code = '1110';

    retention_name := COALESCE(retention_name, 'Retention Receivable');
    ar_name := COALESCE(ar_name, 'Accounts Receivable');

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
        CURRENT_DATE,
        'Retention withheld on invoice ' || inv.invoice_number,
        inv.invoice_number,
        'retention_withheld',
        p_invoice_id,
        p_posted_by,
        p_posted_by,
        TRUE
    ) RETURNING id INTO journal_id;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'journal_lines'
    ) THEN
        INSERT INTO journal_lines (
            journal_entry_id, account_code, debit, credit, project_id, description
        ) VALUES (
            journal_id,
            '1300',
            p_retention_amount,
            0,
            p_project_id,
            'Retention receivable held for invoice ' || inv.invoice_number
        );

        INSERT INTO journal_lines (
            journal_entry_id, account_code, debit, credit, project_id, description
        ) VALUES (
            journal_id,
            '1110',
            0,
            p_retention_amount,
            p_project_id,
            'Accounts receivable reduction for invoice ' || inv.invoice_number
        );
    END IF;

    INSERT INTO ledger_entries (
        journal_entry_id, account_code, account_name,
        debit_amount, credit_amount, description,
        client_id, project_id, division_id,
        currency, foreign_amount, fx_rate
    ) VALUES (
        journal_id, '1300', retention_name,
        p_retention_amount, 0,
        'Retention receivable held for invoice ' || inv.invoice_number,
        inv.client_id, p_project_id, inv.division_id,
        inv.currency, NULL, NULL
    );

    INSERT INTO ledger_entries (
        journal_entry_id, account_code, account_name,
        debit_amount, credit_amount, description,
        client_id, project_id, division_id,
        currency, foreign_amount, fx_rate
    ) VALUES (
        journal_id, '1110', ar_name,
        0, p_retention_amount,
        'Accounts receivable reduction for invoice ' || inv.invoice_number,
        inv.client_id, p_project_id, inv.division_id,
        inv.currency, NULL, NULL
    );

    RETURN journal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION post_retention_released_journal(
    p_retention_ledger_id  UUID,
    p_project_id           UUID,
    p_release_amount       NUMERIC,
    p_release_invoice_id   UUID,
    p_posted_by            UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    retention_row retention_ledger%ROWTYPE;
    journal_id UUID;
    ar_name TEXT;
    retention_name TEXT;
BEGIN
    SELECT * INTO retention_row FROM retention_ledger WHERE id = p_retention_ledger_id;
    IF retention_row.id IS NULL THEN
        RAISE EXCEPTION 'Retention ledger entry not found';
    END IF;

    SELECT account_name INTO retention_name FROM chart_of_accounts WHERE account_code = '1300';
    SELECT account_name INTO ar_name         FROM chart_of_accounts WHERE account_code = '1110';

    retention_name := COALESCE(retention_name, 'Retention Receivable');
    ar_name := COALESCE(ar_name, 'Accounts Receivable');

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
        CURRENT_DATE,
        'Retention released for retention ledger ' || retention_row.id,
        COALESCE((SELECT invoice_number FROM invoices WHERE id = p_release_invoice_id), retention_row.id::TEXT),
        'retention_released',
        p_retention_ledger_id,
        p_posted_by,
        p_posted_by,
        TRUE
    ) RETURNING id INTO journal_id;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'journal_lines'
    ) THEN
        INSERT INTO journal_lines (
            journal_entry_id, account_code, debit, credit, project_id, description
        ) VALUES (
            journal_id,
            '1110',
            p_release_amount,
            0,
            p_project_id,
            'Accounts receivable created for released retention'
        );

        INSERT INTO journal_lines (
            journal_entry_id, account_code, debit, credit, project_id, description
        ) VALUES (
            journal_id,
            '1300',
            0,
            p_release_amount,
            p_project_id,
            'Retention receivable cleared for retention ledger ' || retention_row.id
        );
    END IF;

    INSERT INTO ledger_entries (
        journal_entry_id, account_code, account_name,
        debit_amount, credit_amount, description,
        client_id, project_id, division_id,
        currency, foreign_amount, fx_rate
    ) VALUES (
        journal_id, '1110', ar_name,
        p_release_amount, 0,
        'Accounts receivable created for released retention',
        retention_row.client_id, p_project_id, retention_row.project_id,
        (SELECT currency FROM invoices WHERE id = p_release_invoice_id), NULL, NULL
    );

    INSERT INTO ledger_entries (
        journal_entry_id, account_code, account_name,
        debit_amount, credit_amount, description,
        client_id, project_id, division_id,
        currency, foreign_amount, fx_rate
    ) VALUES (
        journal_id, '1300', retention_name,
        0, p_release_amount,
        'Retention receivable cleared for retention ledger ' || retention_row.id,
        retention_row.client_id, p_project_id, retention_row.project_id,
        (SELECT currency FROM invoices WHERE id = p_release_invoice_id), NULL, NULL
    );

    UPDATE retention_ledger
    SET status = 'fully_released',
        released_amount = p_release_amount,
        balance_amount = 0,
        release_date = CURRENT_DATE,
        release_invoice_id = p_release_invoice_id,
        updated_at = NOW()
    WHERE id = p_retention_ledger_id;

    RETURN journal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION post_subcontractor_retention_journal(
    p_subcontractor_id  UUID,
    p_project_id        UUID,
    p_retention_amount  NUMERIC,
    p_posted_by         UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    journal_id UUID;
    ap_name TEXT;
    retention_payable_name TEXT;
BEGIN
    SELECT account_name INTO ap_name FROM chart_of_accounts WHERE account_code = '2100';
    SELECT account_name INTO retention_payable_name FROM chart_of_accounts WHERE account_code = '2109';

    ap_name := COALESCE(ap_name, 'Accounts Payable');
    retention_payable_name := COALESCE(retention_payable_name, 'Retention Payable');

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
        CURRENT_DATE,
        'Subcontractor retention held for subcontractor ' || p_subcontractor_id,
        p_subcontractor_id::TEXT,
        'subcontractor_retention',
        p_subcontractor_id,
        p_posted_by,
        p_posted_by,
        TRUE
    ) RETURNING id INTO journal_id;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'journal_lines'
    ) THEN
        INSERT INTO journal_lines (
            journal_entry_id, account_code, debit, credit, project_id, description
        ) VALUES (
            journal_id,
            '2100',
            p_retention_amount,
            0,
            p_project_id,
            'Accounts payable reduction for subcontractor retention'
        );

        INSERT INTO journal_lines (
            journal_entry_id, account_code, debit, credit, project_id, description
        ) VALUES (
            journal_id,
            '2109',
            0,
            p_retention_amount,
            p_project_id,
            'Retention payable held for subcontractor retention'
        );
    END IF;

    INSERT INTO ledger_entries (
        journal_entry_id, account_code, account_name,
        debit_amount, credit_amount, description,
        client_id, project_id, division_id,
        currency, foreign_amount, fx_rate
    ) VALUES (
        journal_id, '2100', ap_name,
        p_retention_amount, 0,
        'Accounts payable reduction for subcontractor retention',
        NULL, p_project_id, NULL,
        NULL, NULL, NULL
    );

    INSERT INTO ledger_entries (
        journal_entry_id, account_code, account_name,
        debit_amount, credit_amount, description,
        client_id, project_id, division_id,
        currency, foreign_amount, fx_rate
    ) VALUES (
        journal_id, '2109', retention_payable_name,
        0, p_retention_amount,
        'Retention payable held for subcontractor retention',
        NULL, p_project_id, NULL,
        NULL, NULL, NULL
    );

    RETURN journal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
