-- Migration: Trainer ID Verification Schema
-- Created At: 2026-08-31

-- 1. Create verification documents table
CREATE TABLE IF NOT EXISTS public.trainer_verification_documents (
    id TEXT PRIMARY KEY,
    trainer_id TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    verification_status TEXT NOT NULL DEFAULT 'PENDING',
    extracted_name TEXT,
    confidence NUMERIC,
    match_result TEXT,
    trainer_attested BOOLEAN DEFAULT FALSE,
    uploaded_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for trainer queries
CREATE INDEX IF NOT EXISTS idx_trainer_verification_docs_trainer_id ON public.trainer_verification_documents(trainer_id);

-- Enable RLS on trainer_verification_documents
ALTER TABLE public.trainer_verification_documents ENABLE ROW LEVEL SECURITY;

-- 2. Define RLS Policies for trainer_verification_documents
DROP POLICY IF EXISTS select_trainer_verification_documents ON public.trainer_verification_documents;
CREATE POLICY select_trainer_verification_documents ON public.trainer_verification_documents
  FOR SELECT TO public
  USING (trainer_id = public.get_auth_user_id() OR public.is_admin(public.get_auth_user_id()));

DROP POLICY IF EXISTS insert_trainer_verification_documents ON public.trainer_verification_documents;
CREATE POLICY insert_trainer_verification_documents ON public.trainer_verification_documents
  FOR INSERT TO public
  WITH CHECK (trainer_id = public.get_auth_user_id());

DROP POLICY IF EXISTS update_trainer_verification_documents ON public.trainer_verification_documents;
CREATE POLICY update_trainer_verification_documents ON public.trainer_verification_documents
  FOR UPDATE TO public
  USING (public.is_admin(public.get_auth_user_id()));

-- 3. Configure storage bucket for private trainer-verification
INSERT INTO storage.buckets (id, name, public)
VALUES ('trainer-verification', 'trainer-verification', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 4. Define Storage Policies
DROP POLICY IF EXISTS "Allow trainers to upload verification documents" ON storage.objects;
CREATE POLICY "Allow trainers to upload verification documents" ON storage.objects
  FOR INSERT TO public
  WITH CHECK (bucket_id = 'trainer-verification' AND split_part(name, '/', 1) = public.get_auth_user_id());

DROP POLICY IF EXISTS "Allow trainers to select own verification documents" ON storage.objects;
CREATE POLICY "Allow trainers to select own verification documents" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'trainer-verification' AND split_part(name, '/', 1) = public.get_auth_user_id());

DROP POLICY IF EXISTS "Allow admins to select all verification documents" ON storage.objects;
CREATE POLICY "Allow admins to select all verification documents" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'trainer-verification' AND public.is_admin(public.get_auth_user_id()));
