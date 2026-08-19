-- Migration: Fix Trainer Approval and Admin RLS Policies
-- Created At: 2026-08-19

-- 1. Create a security definer helper to check if a user is an admin without recursion
CREATE OR REPLACE FUNCTION public.is_admin(user_id text)
RETURNS boolean AS $$
BEGIN
  IF user_id IS NULL OR user_id = '' THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update RLS policies for public.users table
DROP POLICY IF EXISTS "Enable SELECT for self only" ON public.users;
CREATE POLICY "Enable SELECT for self or admin" ON public.users FOR SELECT
  USING (
    id = (current_setting('request.headers', true)::jsonb->>'x-user-id')
    OR public.is_admin(current_setting('request.headers', true)::jsonb->>'x-user-id')
  );

DROP POLICY IF EXISTS "Enable UPDATE for self only" ON public.users;
CREATE POLICY "Enable UPDATE for self or admin" ON public.users FOR UPDATE
  USING (
    id = (current_setting('request.headers', true)::jsonb->>'x-user-id')
    OR public.is_admin(current_setting('request.headers', true)::jsonb->>'x-user-id')
  )
  WITH CHECK (
    id = (current_setting('request.headers', true)::jsonb->>'x-user-id')
    OR public.is_admin(current_setting('request.headers', true)::jsonb->>'x-user-id')
  );

DROP POLICY IF EXISTS "Enable DELETE for self only" ON public.users;
CREATE POLICY "Enable DELETE for self or admin" ON public.users FOR DELETE
  USING (
    id = (current_setting('request.headers', true)::jsonb->>'x-user-id')
    OR public.is_admin(current_setting('request.headers', true)::jsonb->>'x-user-id')
  );

-- Admins also need to be able to INSERT/UPSERT into users (e.g. creating/seeding users)
DROP POLICY IF EXISTS "Enable INSERT for admin" ON public.users;
CREATE POLICY "Enable INSERT for admin" ON public.users FOR INSERT
  WITH CHECK (public.is_admin(current_setting('request.headers', true)::jsonb->>'x-user-id'));


-- 3. Update RLS policies for public.user_profiles table
DROP POLICY IF EXISTS "Enable SELECT for self only" ON public.user_profiles;
CREATE POLICY "Enable SELECT for self or admin" ON public.user_profiles FOR SELECT
  USING (
    user_id = (current_setting('request.headers', true)::jsonb->>'x-user-id')
    OR public.is_admin(current_setting('request.headers', true)::jsonb->>'x-user-id')
  );

DROP POLICY IF EXISTS "Enable UPDATE for self only" ON public.user_profiles;
CREATE POLICY "Enable UPDATE for self or admin" ON public.user_profiles FOR UPDATE
  USING (
    user_id = (current_setting('request.headers', true)::jsonb->>'x-user-id')
    OR public.is_admin(current_setting('request.headers', true)::jsonb->>'x-user-id')
  )
  WITH CHECK (
    user_id = (current_setting('request.headers', true)::jsonb->>'x-user-id')
    OR public.is_admin(current_setting('request.headers', true)::jsonb->>'x-user-id')
  );

DROP POLICY IF EXISTS "Enable INSERT for self only" ON public.user_profiles;
CREATE POLICY "Enable INSERT for self or admin" ON public.user_profiles FOR INSERT
  WITH CHECK (
    user_id = (current_setting('request.headers', true)::jsonb->>'x-user-id')
    OR public.is_admin(current_setting('request.headers', true)::jsonb->>'x-user-id')
  );

DROP POLICY IF EXISTS "Enable DELETE for self only" ON public.user_profiles;
CREATE POLICY "Enable DELETE for self or admin" ON public.user_profiles FOR DELETE
  USING (
    user_id = (current_setting('request.headers', true)::jsonb->>'x-user-id')
    OR public.is_admin(current_setting('request.headers', true)::jsonb->>'x-user-id')
  );


-- 4. Update RLS policies for public.trainer_applications table
DROP POLICY IF EXISTS "Enable SELECT for owner or admin" ON public.trainer_applications;
CREATE POLICY "Enable SELECT for owner or admin" ON public.trainer_applications FOR SELECT
  USING (
    phone = (SELECT phone FROM public.users WHERE id = (current_setting('request.headers', true)::jsonb->>'x-user-id'))
    OR public.is_admin(current_setting('request.headers', true)::jsonb->>'x-user-id')
  );

DROP POLICY IF EXISTS "Enable UPDATE for owner or admin" ON public.trainer_applications;
CREATE POLICY "Enable UPDATE for owner or admin" ON public.trainer_applications FOR UPDATE
  USING (
    phone = (SELECT phone FROM public.users WHERE id = (current_setting('request.headers', true)::jsonb->>'x-user-id'))
    OR public.is_admin(current_setting('request.headers', true)::jsonb->>'x-user-id')
  )
  WITH CHECK (
    phone = (SELECT phone FROM public.users WHERE id = (current_setting('request.headers', true)::jsonb->>'x-user-id'))
    OR public.is_admin(current_setting('request.headers', true)::jsonb->>'x-user-id')
  );
