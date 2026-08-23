-- Migration: Profile RLS hardening for JWT and custom header fallbacks
-- Created At: 2026-08-23
-- Description: Redefines RLS policies on users and user_profiles to correctly resolve user identity using either JWT claims or the x-user-id fallback.

-- 1. Recreate users SELECT policy
DROP POLICY IF EXISTS "Enable SELECT for self or admin" ON public.users;
CREATE POLICY "Enable SELECT for self or admin" ON public.users FOR SELECT
  USING (
    id = COALESCE(nullif(current_setting('request.jwt.claim.sub', true), ''), (current_setting('request.headers', true)::jsonb->>'x-user-id'))
    OR public.is_admin(COALESCE(nullif(current_setting('request.jwt.claim.sub', true), ''), (current_setting('request.headers', true)::jsonb->>'x-user-id')))
  );

-- 2. Recreate users UPDATE policy
DROP POLICY IF EXISTS "Enable UPDATE for self or admin" ON public.users;
CREATE POLICY "Enable UPDATE for self or admin" ON public.users FOR UPDATE
  USING (
    id = COALESCE(nullif(current_setting('request.jwt.claim.sub', true), ''), (current_setting('request.headers', true)::jsonb->>'x-user-id'))
    OR public.is_admin(COALESCE(nullif(current_setting('request.jwt.claim.sub', true), ''), (current_setting('request.headers', true)::jsonb->>'x-user-id')))
  )
  WITH CHECK (
    id = COALESCE(nullif(current_setting('request.jwt.claim.sub', true), ''), (current_setting('request.headers', true)::jsonb->>'x-user-id'))
    OR public.is_admin(COALESCE(nullif(current_setting('request.jwt.claim.sub', true), ''), (current_setting('request.headers', true)::jsonb->>'x-user-id')))
  );

-- 3. Recreate users DELETE policy
DROP POLICY IF EXISTS "Enable DELETE for self or admin" ON public.users;
CREATE POLICY "Enable DELETE for self or admin" ON public.users FOR DELETE
  USING (
    id = COALESCE(nullif(current_setting('request.jwt.claim.sub', true), ''), (current_setting('request.headers', true)::jsonb->>'x-user-id'))
    OR public.is_admin(COALESCE(nullif(current_setting('request.jwt.claim.sub', true), ''), (current_setting('request.headers', true)::jsonb->>'x-user-id')))
  );

-- 4. Recreate users INSERT policy (Admin only)
DROP POLICY IF EXISTS "Enable INSERT for admin" ON public.users;
CREATE POLICY "Enable INSERT for admin" ON public.users FOR INSERT
  WITH CHECK (public.is_admin(COALESCE(nullif(current_setting('request.jwt.claim.sub', true), ''), (current_setting('request.headers', true)::jsonb->>'x-user-id'))));

-- 5. Helper function to fetch credits bypassing RLS (breaks infinite recursion in WITH CHECK)
CREATE OR REPLACE FUNCTION public.get_profile_credits(p_profile_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT credits_balance FROM public.user_profiles WHERE id = p_profile_id);
END;
$$;

-- 6. Recreate user_profiles UPDATE policy
DROP POLICY IF EXISTS "Enable UPDATE profile details except credits" ON public.user_profiles;
CREATE POLICY "Enable UPDATE profile details except credits" ON public.user_profiles
  FOR UPDATE USING (
    user_id = COALESCE(nullif(current_setting('request.jwt.claim.sub', true), ''), (current_setting('request.headers', true)::jsonb->>'x-user-id'))
    OR public.is_admin(COALESCE(nullif(current_setting('request.jwt.claim.sub', true), ''), (current_setting('request.headers', true)::jsonb->>'x-user-id')))
  )
  WITH CHECK (
    (
      user_id = COALESCE(nullif(current_setting('request.jwt.claim.sub', true), ''), (current_setting('request.headers', true)::jsonb->>'x-user-id'))
      AND credits_balance IS NOT DISTINCT FROM public.get_profile_credits(id)
    )
    OR public.is_admin(COALESCE(nullif(current_setting('request.jwt.claim.sub', true), ''), (current_setting('request.headers', true)::jsonb->>'x-user-id')))
  );

