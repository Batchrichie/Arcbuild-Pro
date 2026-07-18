-- =============================================================================
-- ARCBUILD PRO — Migration 003: Auth Trigger
-- Phase 1, Step 5
--
-- Creates a trigger on auth.users that automatically inserts a row into
-- public.profiles whenever a new user is created via Supabase Auth.
--
-- The role and full_name are read from raw_user_meta_data, which is
-- populated at signup via: supabase.auth.signUp({ data: { full_name, role } })
--
-- If role is not provided or is invalid, it defaults to 'employee'.
-- =============================================================================


-- =============================================================================
-- Function: handle_new_user()
-- Fires AFTER INSERT on auth.users.
-- Inserts a corresponding row in public.profiles.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _role TEXT;
    _full_name TEXT;
BEGIN
    -- Read role from signup metadata; default to 'employee' if missing or invalid
    _role := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'role'), ''),
        'employee'
    );

    -- Validate role is one of the 7 defined system roles
    IF _role NOT IN ('ceo', 'admin', 'accountant', 'project_manager', 'hr_manager', 'employee', 'client') THEN
        _role := 'employee';
    END IF;

    -- Read full_name from signup metadata; fall back to email prefix
    _full_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        SPLIT_PART(NEW.email, '@', 1)
    );

    -- Insert the profile row
    INSERT INTO public.profiles (user_id, role, full_name)
    VALUES (NEW.id, _role, _full_name);

    RETURN NEW;
END;
$$;


-- =============================================================================
-- Trigger: on_auth_user_created
-- Fires AFTER each INSERT on auth.users.
-- =============================================================================

-- Drop if exists (safe to re-run)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();


-- =============================================================================
-- END OF MIGRATION 003
-- =============================================================================
-- To verify after running:
--   SELECT trigger_name, event_manipulation, event_object_table, action_timing
--   FROM information_schema.triggers
--   WHERE trigger_name = 'on_auth_user_created';
-- =============================================================================
