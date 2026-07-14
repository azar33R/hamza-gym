-- ============================================================================
--  Hamza Gym — 0035: Chat photos + plan-ending notification type
--
--  * chat-photos public storage bucket (authenticated users upload to their
--    own folder; anyone can read).
--  * chat_messages.image_url column; body made nullable so photo-only
--    messages are allowed.
--  * 'plan_ending' notification type for the auto renewal reminder.
--
--  Idempotent. Run in the Supabase SQL Editor after 0034.
-- ============================================================================

-- 1) New notification type.
DO $$ BEGIN
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'plan_ending';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Chat photo storage bucket (public) + policies.
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-photos', 'chat-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "chat-photos public read" ON storage.objects;
CREATE POLICY "chat-photos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-photos');

DROP POLICY IF EXISTS "chat-photos participant write" ON storage.objects;
CREATE POLICY "chat-photos participant write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-photos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "chat-photos owner delete" ON storage.objects;
CREATE POLICY "chat-photos owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'chat-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3) chat_messages: add image_url, relax body NOT NULL.
DO $$ BEGIN
  ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS image_url text;
EXCEPTION WHEN others THEN NULL; END $$;

ALTER TABLE public.chat_messages ALTER COLUMN body DROP NOT NULL;
