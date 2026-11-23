-- Phase 2 dry run: READ ONLY. Paste into Supabase SQL Editor.
-- Shows exactly what 20261120170000_switch_identity_to_session_token.sql will rewrite.

-- A. policies that still resolve the caller from the header
SELECT tablename, policyname, cmd,
       coalesce(qual, '')        AS using_expr,
       coalesce(with_check, '')  AS check_expr
  FROM pg_policies
 WHERE schemaname = 'public'
   AND (coalesce(qual, '') LIKE '%x-user-id%' OR coalesce(with_check, '') LIKE '%x-user-id%')
 ORDER BY tablename, policyname;

-- B. how many per table
SELECT tablename, count(*) AS policies_to_rewrite
  FROM pg_policies
 WHERE schemaname = 'public'
   AND (coalesce(qual, '') LIKE '%x-user-id%' OR coalesce(with_check, '') LIKE '%x-user-id%')
 GROUP BY tablename
 ORDER BY policies_to_rewrite DESC;

-- C. SECURITY DEFINER functions that read the header
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.prosecdef
   AND pg_get_functiondef(p.oid) ~* 'x-user-id'
 ORDER BY p.proname;

-- D. rollout switch (should print 'fallback' after the migration runs)
SELECT name, value FROM public.app_secrets WHERE name = 'session_enforcement';
