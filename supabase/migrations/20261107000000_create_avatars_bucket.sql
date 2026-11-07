-- Migration: Create public "avatars" storage bucket for user and trainer profile photos.
-- Run this once in the Supabase SQL editor (or `supabase db push`). Until it is applied,
-- src/utils/uploadAvatar.ts falls back to the existing "trainer-documents" bucket.

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Anyone may read avatars (they are rendered through public URLs).
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'avatars');

-- The app uploads straight from the client before the profile row is saved,
-- so both anon and authenticated sessions need insert/update on this bucket.
DROP POLICY IF EXISTS "avatars_client_insert" ON storage.objects;
CREATE POLICY "avatars_client_insert"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_client_update" ON storage.objects;
CREATE POLICY "avatars_client_update"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'avatars')
  WITH CHECK (bucket_id = 'avatars');
