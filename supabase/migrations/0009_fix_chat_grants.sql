-- ============================================================================
--  Hamza Gym — 0009: Phase 5 chat GRANT repair
--  Fixes "permission denied for table chat_messages" if the grants in 0008
--  didn't apply — e.g. when the table already existed before the GRANT ran,
--  the migration was applied in pieces, or the role wasn't covered.
--
--  Mirrors the 0007 repair that fixed the same symptom for the Phase 4 tables.
--  Safe to re-run (idempotent). Run in the Supabase SQL Editor after 0008.
-- ============================================================================

-- Re-apply the table GRANTs to every role a client may connect as:
--   anon / authenticated → SSR + browser clients (subject to RLS)
--   service_role         → server actions using the service-role key (bypasses RLS)
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.chat_messages
  TO anon, authenticated, service_role;

-- Sequence backing any default columns (gen_random_uuid needs none, but keep
-- this aligned with the Phase 4 repair for future serial/identity columns).
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
--  Belt-and-braces: re-enable RLS + restate the policies so a partially-applied
--  0008 (e.g. table created but policies missing) still ends up correct.
-- ---------------------------------------------------------------------------
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- A participant can read the messages they're part of.
DROP POLICY IF EXISTS "Chat viewable by sender or recipient"
  ON public.chat_messages;
CREATE POLICY "Chat viewable by sender or recipient"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- The sender can insert their own outgoing messages.
DROP POLICY IF EXISTS "Sender inserts own messages"
  ON public.chat_messages;
CREATE POLICY "Sender inserts own messages"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- The recipient can mark inbound messages as read (sets read_at).
DROP POLICY IF EXISTS "Recipient updates read state"
  ON public.chat_messages;
CREATE POLICY "Recipient updates read state"
  ON public.chat_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- Sanity check: list the live grants so you can confirm they applied.
-- (Commented out — uncomment to inspect.)
-- SELECT grantee, table_name, privilege_type
--   FROM information_schema.role_table_grants
--   WHERE table_schema = 'public'
--     AND table_name = 'chat_messages'
--   ORDER BY grantee, privilege_type;
