-- Server-signed session tokens: the client proves who it is with a token the
-- server issued, instead of a plain x-user-id header anyone could forge.
-- Additive phase: RLS still reads x-user-id, so nothing breaks until policies
-- are switched over in the next migration.

CREATE TABLE IF NOT EXISTS public.app_secrets (
  name TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 64 hex chars of entropy derived from core functions only (no pgcrypto needed).
INSERT INTO public.app_secrets (name, value)
VALUES ('session_secret',
        encode(sha256(convert_to(
          gen_random_uuid()::text || gen_random_uuid()::text || clock_timestamp()::text,
          'UTF8')), 'hex'))
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.app_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 days',
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_sessions_user ON public.app_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_expiry ON public.app_sessions (expires_at);

ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.app_secrets FROM anon, authenticated;
REVOKE ALL ON public.app_sessions FROM anon, authenticated;

-- Issues a fresh token for a device that already holds the account's device slot.
CREATE OR REPLACE FUNCTION public.issue_session_token(
  p_user_id TEXT,
  p_device_id TEXT,
  p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret TEXT;
  v_raw TEXT;
  v_hash TEXT;
BEGIN
  IF p_user_id IS NULL OR p_device_id IS NULL OR p_token IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_request');
  END IF;

  IF NOT public.device_is_active(p_user_id, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'device_not_active');
  END IF;

  SELECT value INTO v_secret FROM public.app_secrets WHERE name = 'session_secret';
  IF v_secret IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_configured');
  END IF;

  v_raw := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_hash := encode(sha256(convert_to(v_secret || v_raw, 'UTF8')), 'hex');

  -- One live token per phone: signing in again replaces the previous one.
  DELETE FROM public.app_sessions
   WHERE user_id = p_user_id AND device_id = p_device_id;

  INSERT INTO public.app_sessions (token_hash, user_id, device_id)
  VALUES (v_hash, p_user_id, p_device_id);

  RETURN jsonb_build_object('ok', true, 'token', v_raw, 'expires_at', now() + interval '30 days');
END;
$$;

-- Resolves the caller from the signed token. NULL when the token is missing,
-- forged, expired or revoked.
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
  v_secret TEXT;
  v_hash TEXT;
  v_uid TEXT;
BEGIN
  v_token := NULLIF(current_setting('request.headers', true)::jsonb ->> 'x-session-token', '');
  IF v_token IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT value INTO v_secret FROM public.app_secrets WHERE name = 'session_secret';
  IF v_secret IS NULL THEN
    RETURN NULL;
  END IF;

  v_hash := encode(sha256(convert_to(v_secret || v_token, 'UTF8')), 'hex');

  SELECT user_id INTO v_uid
    FROM public.app_sessions
   WHERE token_hash = v_hash
     AND expires_at > now();

  RETURN v_uid;
END;
$$;

-- Keeps the token (and its device slot) alive while the app is running.
CREATE OR REPLACE FUNCTION public.touch_session_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret TEXT;
  v_hash TEXT;
  v_row public.app_sessions%ROWTYPE;
BEGIN
  IF p_token IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_request');
  END IF;

  SELECT value INTO v_secret FROM public.app_secrets WHERE name = 'session_secret';
  v_hash := encode(sha256(convert_to(v_secret || p_token, 'UTF8')), 'hex');

  SELECT * INTO v_row FROM public.app_sessions WHERE token_hash = v_hash;
  IF NOT FOUND OR v_row.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  IF NOT public.device_is_active(v_row.user_id,
       NULLIF(current_setting('request.headers', true)::jsonb ->> 'x-device-token', '')) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'device_revoked');
  END IF;

  UPDATE public.app_sessions SET last_used_at = now() WHERE token_hash = v_hash;

  RETURN jsonb_build_object('ok', true, 'user_id', v_row.user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_session_token(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret TEXT;
  v_hash TEXT;
BEGIN
  IF p_token IS NULL THEN
    RETURN false;
  END IF;

  SELECT value INTO v_secret FROM public.app_secrets WHERE name = 'session_secret';
  IF v_secret IS NULL THEN
    RETURN false;
  END IF;

  v_hash := encode(sha256(convert_to(v_secret || p_token, 'UTF8')), 'hex');
  DELETE FROM public.app_sessions WHERE token_hash = v_hash;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_session_token(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.touch_session_token(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_session_token(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.issue_session_token(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_session_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_session_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_id() TO anon, authenticated;
