-- ============================================================================
--  Hamza Gym — Phase 5: Subscriber ↔ Coach direct messaging
--  Run this in the Supabase SQL Editor after 0001–0007.
--  Idempotent where possible.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  1. Extend notification_type so DMs can carry a push notification
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'dm';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
--  2. chat_messages: 1:1 messages between a sender and a recipient.
--    For this app, the pair is always (subscriber, coach). The table is
--    generic so a future group-chat could reuse it.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  body         text NOT NULL,
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (sender_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS chat_messages_created_idx
  ON public.chat_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_parties_idx
  ON public.chat_messages (sender_id, recipient_id);

-- ---------------------------------------------------------------------------
--  3. Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- A participant can read the messages they're part of.
DROP POLICY IF EXISTS "Chat viewable by sender or recipient"
  ON public.chat_messages;
CREATE POLICY "Chat viewable by sender or recipient"
  ON public.chat_messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- The sender can insert their own outgoing messages.
DROP POLICY IF EXISTS "Sender inserts own messages"
  ON public.chat_messages;
CREATE POLICY "Sender inserts own messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- The recipient can mark inbound messages as read (sets read_at).
DROP POLICY IF EXISTS "Recipient updates read state"
  ON public.chat_messages;
CREATE POLICY "Recipient updates read state"
  ON public.chat_messages FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- ---------------------------------------------------------------------------
--  4. GRANTs (mirror the 0004/0006 pattern — anon + authenticated)
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.chat_messages TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
