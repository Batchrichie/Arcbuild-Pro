-- =============================================================================
-- 054: Employee number auto-generation sequence and trigger
-- =============================================================================

-- Sequence used for new employee_number values.
CREATE SEQUENCE IF NOT EXISTS employee_number_seq START 1;

-- Helper function to generate a formatted employee number.
CREATE OR REPLACE FUNCTION generate_employee_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN 'EMP-' || LPAD(NEXTVAL('employee_number_seq')::TEXT, 4, '0');
END;
$$;

-- Trigger function to auto-assign employee_number on insert.
-- Application logic in invite-user/index.ts enforces override permissions.
-- This trigger is defense-in-depth: it generates a number only when none is provided.
CREATE OR REPLACE FUNCTION set_employee_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF COALESCE(TRIM(NEW.employee_number), '') = '' THEN
        NEW.employee_number := generate_employee_number();
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_employee_number ON employees;

CREATE TRIGGER set_employee_number
    BEFORE INSERT ON employees
    FOR EACH ROW
    EXECUTE FUNCTION set_employee_number();
