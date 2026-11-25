-- =====================================================================
-- PHASE 2 APPLY (paste into Supabase Dashboard -> SQL Editor -> Run)
-- Project: ferowbqvgsbbovnwqkae
--
-- Identity moves from the x-user-id header to the signed x-session-token.
-- Enforcement stays in 'fallback' mode, so the current app keeps working:
-- a request with a valid token is trusted, one without a token still falls
-- back to the old header. Nothing for users to notice.
--
-- Safe to run more than once: everything below only rewrites objects that
-- still read the header, and seeds the mode row with ON CONFLICT DO NOTHING.
-- =====================================================================

-- ---------- part 1 of 2 ----------
-- Phase 2: stop trusting the x-user-id header.
-- Every policy and SECURITY DEFINER function that resolved the caller from the
-- header is rewritten to call public.current_user_id(), which only returns a
-- user when the signed session token checks out.
--
-- Rollout switch: app_secrets.session_enforcement
--   'fallback' (default, set below) -> verified token first, header only if no token
--   'strict'                        -> verified token only, header ignored
-- Flip with: update public.app_secrets set value='strict' where name='session_enforcement';

INSERT INTO public.app_secrets (name, value)
VALUES ('session_enforcement', 'fallback')
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_headers JSONB;
  v_token TEXT;
  v_secret TEXT;
  v_uid TEXT;
  v_mode TEXT;
BEGIN
  v_headers := current_setting('request.headers', true)::jsonb;

  v_token := NULLIF(v_headers ->> 'x-session-token', '');
  IF v_token IS NOT NULL THEN
    SELECT value INTO v_secret FROM public.app_secrets WHERE name = 'session_secret';
    IF v_secret IS NOT NULL THEN
      SELECT user_id INTO v_uid
        FROM public.app_sessions
       WHERE token_hash = encode(sha256(convert_to(v_secret || v_token, 'UTF8')), 'hex')
         AND expires_at > now();
      IF v_uid IS NOT NULL THEN
        RETURN v_uid;
      END IF;
    END IF;
  END IF;

  -- Transitional: builds shipped before signed tokens carry no token yet.
  SELECT value INTO v_mode FROM public.app_secrets WHERE name = 'session_enforcement';
  IF v_mode IS DISTINCT FROM 'strict' THEN
    RETURN NULLIF(v_headers ->> 'x-user-id', '');
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_id() TO anon, authenticated;

DO $$
DECLARE
  v_pattern CONSTANT TEXT := 'current_setting\s*\(\s*''request\.headers''(?:\s*::\s*text)?\s*,\s*true\s*\)(\)*)\s*(?:::jsonb)?\s*(\)*)\s*->>\s*''x-user-id''(?:::text)?';
  r RECORD;
  v_qual TEXT;
  v_check TEXT;
  v_cmd TEXT;
  v_rewritten INT := 0;
  v_skipped INT := 0;
BEGIN
  FOR r IN
    SELECT policyname, tablename, permissive, roles, cmd, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'public'
       AND (coalesce(qual, '') LIKE '%x-user-id%' OR coalesce(with_check, '') LIKE '%x-user-id%')
     ORDER BY tablename, policyname
  LOOP
    v_qual := regexp_replace(coalesce(r.qual, ''), v_pattern, 'public.current_user_id()\1\2', 'gi');
    v_check := regexp_replace(coalesce(r.with_check, ''), v_pattern, 'public.current_user_id()\1\2', 'gi');

    IF v_qual LIKE '%x-user-id%' OR v_check LIKE '%x-user-id%' THEN
      RAISE NOTICE 'phase2: pattern not recognised, left untouched: %.%', r.tablename, r.policyname;
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);

    v_cmd := CASE WHEN r.cmd = 'ALL' THEN '' ELSE ' FOR ' || r.cmd END;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS %s%s TO %s%s%s',
      r.policyname,
      r.tablename,
      CASE WHEN r.permissive = 'RESTRICTIVE' THEN 'RESTRICTIVE' ELSE 'PERMISSIVE' END,
      v_cmd,
      array_to_string(r.roles, ', '),
      CASE WHEN v_qual <> '' THEN ' USING (' || v_qual || ')' ELSE '' END,
      CASE WHEN v_check <> '' THEN ' WITH CHECK (' || v_check || ')' ELSE '' END
    );

    v_rewritten := v_rewritten + 1;
  END LOOP;

  RAISE NOTICE 'phase2: policies rewritten=%, skipped=%', v_rewritten, v_skipped;
END $$;

DO $$
DECLARE
  v_pattern CONSTANT TEXT := 'current_setting\s*\(\s*''request\.headers''(?:\s*::\s*text)?\s*,\s*true\s*\)(\)*)\s*(?:::jsonb)?\s*(\)*)\s*->>\s*''x-user-id''(?:::text)?';
  r RECORD;
  v_def TEXT;
  v_new TEXT;
  v_code TEXT;
  v_done INT := 0;
  v_skipped INT := 0;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS signature, p.proname, pg_get_functiondef(p.oid) AS def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosecdef
       AND pg_get_functiondef(p.oid) ~* 'x-user-id'
     ORDER BY p.proname
  LOOP
    v_def := r.def;
    v_new := regexp_replace(v_def, v_pattern, 'public.current_user_id()\1\2', 'gi');

    -- Comments still mention x-user-id; only real code left over means an unknown pattern.
    v_code := regexp_replace(v_new, '--[^\n]*', '', 'g');

    IF v_code ~* 'x-user-id' THEN
      RAISE NOTICE 'phase2: function left untouched (unknown pattern): %', r.signature;
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Any syntax or semantic error here aborts the whole migration.
    EXECUTE v_new;
    v_done := v_done + 1;
  END LOOP;

  RAISE NOTICE 'phase2: functions rewritten=%, skipped=%', v_done, v_skipped;
END $$;


-- ---------- part 2 of 2 (repair pass, idempotent) ----------
-- Repair pass for phase 2 (identity from signed session tokens).
--
-- Why this file exists: 20261120170000_switch_identity_to_session_token.sql may
-- already be recorded as applied with an older body that skipped every function
-- whose body merely mentioned x-user-id in a comment (create_booking,
-- purchase_credits, transfer_credits, find_recipient_by_phone). Supabase will
-- not re-run a recorded migration, so the same rewrite is repeated here.
--
-- Everything below is idempotent: policies and functions that already call
-- public.current_user_id() no longer match the WHERE clauses and are untouched.
--
-- Mode stays 'fallback' (token first, header only when no token is presented),
-- so no client behaviour changes until the switch is flipped on purpose:
--   update public.app_secrets set value='strict' where name='session_enforcement';

INSERT INTO public.app_secrets (name, value)
VALUES ('session_enforcement', 'fallback')
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_headers JSONB;
  v_token TEXT;
  v_secret TEXT;
  v_uid TEXT;
  v_mode TEXT;
BEGIN
  v_headers := current_setting('request.headers', true)::jsonb;

  v_token := NULLIF(v_headers ->> 'x-session-token', '');
  IF v_token IS NOT NULL THEN
    SELECT value INTO v_secret FROM public.app_secrets WHERE name = 'session_secret';
    IF v_secret IS NOT NULL THEN
      SELECT user_id INTO v_uid
        FROM public.app_sessions
       WHERE token_hash = encode(sha256(convert_to(v_secret || v_token, 'UTF8')), 'hex')
         AND expires_at > now();
      IF v_uid IS NOT NULL THEN
        RETURN v_uid;
      END IF;
    END IF;
  END IF;

  -- Transitional: builds shipped before signed tokens carry no token yet.
  SELECT value INTO v_mode FROM public.app_secrets WHERE name = 'session_enforcement';
  IF v_mode IS DISTINCT FROM 'strict' THEN
    RETURN NULLIF(v_headers ->> 'x-user-id', '');
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_id() TO anon, authenticated;

DO $$
DECLARE
  v_pattern CONSTANT TEXT := 'current_setting\s*\(\s*''request\.headers''(?:\s*::\s*text)?\s*,\s*true\s*\)(\)*)\s*(?:::jsonb)?\s*(\)*)\s*->>\s*''x-user-id''(?:::text)?';
  r RECORD;
  v_qual TEXT;
  v_check TEXT;
  v_cmd TEXT;
  v_rewritten INT := 0;
  v_skipped INT := 0;
BEGIN
  FOR r IN
    SELECT policyname, tablename, permissive, roles, cmd, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'public'
       AND (coalesce(qual, '') LIKE '%x-user-id%' OR coalesce(with_check, '') LIKE '%x-user-id%')
     ORDER BY tablename, policyname
  LOOP
    v_qual := regexp_replace(coalesce(r.qual, ''), v_pattern, 'public.current_user_id()\1\2', 'gi');
    v_check := regexp_replace(coalesce(r.with_check, ''), v_pattern, 'public.current_user_id()\1\2', 'gi');

    IF v_qual LIKE '%x-user-id%' OR v_check LIKE '%x-user-id%' THEN
      RAISE NOTICE 'phase2: pattern not recognised, left untouched: %.%', r.tablename, r.policyname;
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);

    v_cmd := CASE WHEN r.cmd = 'ALL' THEN '' ELSE ' FOR ' || r.cmd END;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS %s%s TO %s%s%s',
      r.policyname,
      r.tablename,
      CASE WHEN r.permissive = 'RESTRICTIVE' THEN 'RESTRICTIVE' ELSE 'PERMISSIVE' END,
      v_cmd,
      array_to_string(r.roles, ', '),
      CASE WHEN v_qual <> '' THEN ' USING (' || v_qual || ')' ELSE '' END,
      CASE WHEN v_check <> '' THEN ' WITH CHECK (' || v_check || ')' ELSE '' END
    );

    v_rewritten := v_rewritten + 1;
  END LOOP;

  RAISE NOTICE 'phase2: policies rewritten=%, skipped=%', v_rewritten, v_skipped;
END $$;

DO $$
DECLARE
  v_pattern CONSTANT TEXT := 'current_setting\s*\(\s*''request\.headers''(?:\s*::\s*text)?\s*,\s*true\s*\)(\)*)\s*(?:::jsonb)?\s*(\)*)\s*->>\s*''x-user-id''(?:::text)?';
  r RECORD;
  v_def TEXT;
  v_new TEXT;
  v_code TEXT;
  v_done INT := 0;
  v_skipped INT := 0;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS signature, p.proname, pg_get_functiondef(p.oid) AS def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosecdef
       AND pg_get_functiondef(p.oid) ~* 'x-user-id'
     ORDER BY p.proname
  LOOP
    v_def := r.def;
    v_new := regexp_replace(v_def, v_pattern, 'public.current_user_id()\1\2', 'gi');

    -- Comments still mention x-user-id; only real code left over means an unknown pattern.
    v_code := regexp_replace(v_new, '--[^\n]*', '', 'g');

    IF v_code ~* 'x-user-id' THEN
      RAISE NOTICE 'phase2: function left untouched (unknown pattern): %', r.signature;
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Any syntax or semantic error here aborts the whole migration.
    EXECUTE v_new;
    v_done := v_done + 1;
  END LOOP;

  RAISE NOTICE 'phase2: functions rewritten=%, skipped=%', v_done, v_skipped;
END $$;


-- =====================================================================
-- VERIFY (run these two selects after the notices come back)
-- =====================================================================
select
  (select count(*) from pg_policies where schemaname = 'public'
     and (qual like '%x-user-id%' or with_check like '%x-user-id%'))            as policies_still_reading_header,
  (select count(*) from pg_policies where schemaname = 'public'
     and (qual like '%current_user_id%' or with_check like '%current_user_id%')) as policies_using_session_token,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosrc like '%current_user_id%')          as functions_using_session_token;

select name, value from public.app_secrets where name = 'session_enforcement';
