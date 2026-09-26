-- ============================================================================
--  Store each member's phone number on profiles.
--
--  Why: DM deep-links and "message by phone number" need to resolve a typed
--  number to a member. The number currently only lives in auth.users.phone,
--  which the app can't query with the anon/authenticated key.
--
--  The column is the NORMALIZED E.164 form (+2010XXXXXXXX), which is exactly
--  what lib/phone.ts normalizeEGPhone() produces, so the app can compare
--  directly.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text;

COMMENT ON COLUMN public.profiles.phone IS
  'Normalized E.164 phone (+20…). Mirrors auth.users.phone, kept in sync by trigger.';

-- ---------------------------------------------------------------------------
--  1. Backfill existing members from auth.users
--
--  Supabase stores auth.users.phone WITHOUT the leading "+" ("201006857031"),
--  so we mirror it verbatim — the app compares against both spellings anyway,
--  but keeping one canonical form avoids surprise duplicates.
-- ---------------------------------------------------------------------------
UPDATE public.profiles p
   SET phone = regexp_replace(u.phone, '^\+', '')
  FROM auth.users u
 WHERE u.id = p.id
   AND p.phone IS NULL
   AND u.phone IS NOT NULL;

-- Any row a previous run of this file wrote with a leading "+".
UPDATE public.profiles
   SET phone = regexp_replace(phone, '^\+', '')
 WHERE phone LIKE '+%';

-- ---------------------------------------------------------------------------
--  2. Index for phone lookups
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS profiles_phone_idx
  ON public.profiles (phone)
  WHERE phone IS NOT NULL;

-- ---------------------------------------------------------------------------
--  3. Keep profiles.phone in sync with auth.users.phone
--     - on signup (insert)
--     - on phone/email updates (update of phone)
--     - when a coach adds a member without going through the trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_profile_phone ()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.phone IS NOT NULL THEN
    UPDATE public.profiles
       SET phone = regexp_replace(NEW.phone, '^\+', '')
     WHERE id = NEW.id
       AND phone IS DISTINCT FROM regexp_replace(NEW.phone, '^\+', '');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_phone_set ON auth.users;
CREATE TRIGGER on_auth_user_phone_set
  AFTER INSERT OR UPDATE OF phone ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.sync_profile_phone();

-- ---------------------------------------------------------------------------
--  4. Also stamp the phone in handle_new_user so the profile row is correct
--     from the moment it's created (rather than a moment later by the trigger
--     above).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user ()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, subscription_status, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    'subscriber',
    'inactive',
    regexp_replace(NEW.phone, '^\+', '')
  )
  ON CONFLICT (id) DO UPDATE
    SET phone = COALESCE(EXCLUDED.phone, public.profiles.phone);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user ();
