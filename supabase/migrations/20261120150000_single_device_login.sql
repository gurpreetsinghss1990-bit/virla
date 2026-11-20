-- Single-device login enforcement
-- One user id may hold exactly one active device session at a time.
-- Login on a second device is refused (strict mode) with the name of the device
-- currently holding the session.

CREATE TABLE IF NOT EXISTS public.user_devices (
  user_id      TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  device_id    TEXT NOT NULL,
  device_name  TEXT,
  token_hash   TEXT NOT NULL,
  logged_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.device_login_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL,
  device_id  TEXT NOT NULL,
  device_name TEXT,
  action     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_login_log_user ON public.device_login_log (user_id, created_at DESC);

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_login_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.device_is_active(p_user_id TEXT, p_token TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_devices
    WHERE user_id = p_user_id
      AND revoked_at IS NULL
      AND token_hash = md5(p_token)
      AND last_seen_at > now() - interval '30 days'
  );
$$;

-- Claims the single active device slot for a user.
-- Returns ok:false + the device currently holding the session when another device already has it.
CREATE OR REPLACE FUNCTION public.claim_device(
  p_user_id TEXT,
  p_device_id TEXT,
  p_device_name TEXT,
  p_token TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.user_devices%ROWTYPE;
  v_hash TEXT := md5(p_token);
BEGIN
  IF p_user_id IS NULL OR p_device_id IS NULL OR p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_request');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_user');
  END IF;

  SELECT * INTO v_row FROM public.user_devices WHERE user_id = p_user_id FOR UPDATE;

  -- A device that has not checked in for 14 days (app uninstalled, phone lost) no longer holds the slot.
  IF FOUND AND v_row.revoked_at IS NULL AND v_row.device_id <> p_device_id
     AND v_row.last_seen_at > now() - interval '14 days' THEN
    INSERT INTO public.device_login_log (user_id, device_id, device_name, action)
    VALUES (p_user_id, p_device_id, p_device_name, 'blocked_duplicate');
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'active_elsewhere',
      'device_name', COALESCE(v_row.device_name, 'another device'),
      'logged_in_at', v_row.logged_in_at,
      'last_seen_at', v_row.last_seen_at
    );
  END IF;

  INSERT INTO public.user_devices AS d (user_id, device_id, device_name, token_hash, logged_in_at, last_seen_at, revoked_at)
  VALUES (p_user_id, p_device_id, p_device_name, v_hash, now(), now(), NULL)
  ON CONFLICT (user_id) DO UPDATE SET
    device_name  = EXCLUDED.device_name,
    token_hash   = EXCLUDED.token_hash,
    logged_in_at = CASE WHEN d.device_id = EXCLUDED.device_id THEN d.logged_in_at ELSE now() END,
    last_seen_at = now(),
    revoked_at   = NULL,
    device_id    = EXCLUDED.device_id;

  INSERT INTO public.device_login_log (user_id, device_id, device_name, action)
  VALUES (p_user_id, p_device_id, p_device_name, 'login');

  RETURN jsonb_build_object('ok', true, 'device_name', p_device_name);
END;
$$;

-- Called periodically by the client. Reports revocation so the old device logs itself out.
CREATE OR REPLACE FUNCTION public.heartbeat_device(
  p_user_id TEXT,
  p_token TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.user_devices%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_token IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'revoked', true, 'reason', 'invalid_request');
  END IF;

  SELECT * INTO v_row FROM public.user_devices WHERE user_id = p_user_id;

  IF NOT FOUND OR v_row.revoked_at IS NOT NULL OR v_row.token_hash <> md5(p_token) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'revoked', true,
      'device_name', COALESCE(v_row.device_name, NULL)
    );
  END IF;

  UPDATE public.user_devices SET last_seen_at = now() WHERE user_id = p_user_id;
  RETURN jsonb_build_object('ok', true, 'revoked', false, 'device_name', v_row.device_name);
END;
$$;

-- Frees the slot on explicit logout so the same user can log in elsewhere.
CREATE OR REPLACE FUNCTION public.release_device(
  p_user_id TEXT,
  p_token TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.user_devices%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_token IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  SELECT * INTO v_row FROM public.user_devices WHERE user_id = p_user_id FOR UPDATE;
  IF FOUND AND v_row.token_hash = md5(p_token) THEN
    DELETE FROM public.user_devices WHERE user_id = p_user_id;
    INSERT INTO public.device_login_log (user_id, device_id, device_name, action)
    VALUES (p_user_id, v_row.device_id, v_row.device_name, 'logout');
    RETURN jsonb_build_object('ok', true);
  END IF;

  RETURN jsonb_build_object('ok', false);
END;
$$;

-- Hard stop for writes coming from a device whose session was revoked.
-- Requests without an x-device-token header (older builds) are left untouched.
CREATE OR REPLACE FUNCTION public.enforce_device_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT;
  v_token TEXT;
BEGIN
  v_uid := NULLIF(current_setting('request.headers', true)::jsonb ->> 'x-user-id', '');
  v_token := NULLIF(current_setting('request.headers', true)::jsonb ->> 'x-device-token', '');

  -- No user header at all: server-side jobs, service_role and SQL editor.
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Admins act from the admin panel, which is not a per-user phone.
  IF EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_uid AND u.role = 'admin') THEN
    RETURN NEW;
  END IF;

  -- Requests from app builds older than single-device login carry no device token.
  IF v_token IS NULL THEN
    RAISE EXCEPTION 'DEVICE_UPDATE_REQUIRED' USING ERRCODE = 'P0401';
  END IF;

  IF NOT public.device_is_active(v_uid, v_token) THEN
    RAISE EXCEPTION 'DEVICE_SESSION_REVOKED' USING ERRCODE = 'P0401';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_device_guard ON public.bookings;
CREATE TRIGGER trg_bookings_device_guard
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_device_session();

DROP TRIGGER IF EXISTS trg_credit_transactions_device_guard ON public.credit_transactions;
CREATE TRIGGER trg_credit_transactions_device_guard
  BEFORE INSERT ON public.credit_transactions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_device_session();

GRANT EXECUTE ON FUNCTION public.claim_device(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.heartbeat_device(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_device(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.device_is_active(TEXT, TEXT) TO anon, authenticated;

-- Single-device rollout starts from a clean slate: no device holds a slot yet.
TRUNCATE public.user_devices;
