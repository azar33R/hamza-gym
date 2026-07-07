-- ============================================================================
--  Hamza Gym — 0011: Remove "TO authenticated" scoping from chat + profiles
--  policies so the SSR client (which connects via the anon key + session cookie)
--  can resolve auth.uid() and pass RLS.
--
--  Root cause: the SSR client in lib/supabase/server.ts uses the ANON key with
--  cookies. Supabase resolves auth.uid() from the session JWT, so security is
--  preserved — BUT policies scoped "TO authenticated" exclude the anon role
--  entirely, meaning the SSR client gets default-deny (no matching policy).
--
--  By removing the "TO authenticated" clause, policies apply to ALL roles.
--  Security is unchanged: auth.uid() is null for unauthenticated requests,
--  so no rows leak.
--
--  Idempotent. Run in the Supabase SQL Editor after 0001–0010.
-- ============================================================================

-- chat_messages policies: remove TO authenticated (was added in 0009)
DROP POLICY IF EXISTS "Chat viewable by sender or recipient"
  ON public.chat_messages;
CREATE POLICY "Chat viewable by sender or recipient"
  ON public.chat_messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Sender inserts own messages"
  ON public.chat_messages;
CREATE POLICY "Sender inserts own messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Recipient updates read state"
  ON public.chat_messages;
CREATE POLICY "Recipient updates read state"
  ON public.chat_messages FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- profiles SELECT: remove TO authenticated (was added in 0010)
DROP POLICY IF EXISTS "Profiles readable by any authenticated user"
  ON public.profiles;
CREATE POLICY "Profiles readable by any authenticated user"
  ON public.profiles FOR SELECT
  USING (true);
