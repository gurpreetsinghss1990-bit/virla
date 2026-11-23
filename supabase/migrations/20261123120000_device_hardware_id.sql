-- Identity of a phone, not of an install.
-- Clearing app data / reinstalling used to change the install id and lock the user out
-- with "Already logged in on <their own old install>". The hardware id (Android SSAID,
-- iOS identifierForVendor) survives that, so the same phone re-claims its own slot.
-- A device that has been silent for 48 hours releases the slot as well.

ALTER TABLE public.user_devices ADD COLUMN IF NOT EXISTS hardware_id TEXT;
CREATE INDEX IF NOT EXISTS idx_user_devices_hardware ON public.user_devices (hardware_id);

DROP FUNCTION IF EXISTS public.claim_device(TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.claim_device(
  p_user_id TEXT,
  p_device_id TEXT,
  p_device_name TEXT,
  p_token TEXT,
  p_hardware_id TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.user_devices%ROWTYPE;
  v_hash TEXT := md5(p_token);
  v_same_phone BOOLEAN := FALSE;
BEGIN
  IF p_user_id IS NULL OR p_device_id IS NULL OR p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_request');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_user');
  END IF;

  SELECT * INTO v_row FROM public.user_devices WHERE user_id = p_user_id FOR UPDATE;

  IF FOUND THEN
    v_same_phone := v_row.device_id = p_device_id
      OR (p_hardware_id IS NOT NULL AND p_hardware_id <> ''
          AND v_row.hardware_id = p_hardware_id);

    -- A different phone may only take the slot once the holder has been silent for 48 hours.
    IF NOT v_same_phone AND v_row.revoked_at IS NULL
       AND v_row.last_seen_at > now() - interval '48 hours' THEN
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
  END IF;

  INSERT INTO public.user_devices AS d
    (user_id, device_id, device_name, token_hash, hardware_id, logged_in_at, last_seen_at, revoked_at)
  VALUES
    (p_user_id, p_device_id, p_device_name, v_hash, NULLIF(p_hardware_id, ''), now(), now(), NULL)
  ON CONFLICT (user_id) DO UPDATE SET
    device_id    = EXCLUDED.device_id,
    device_name  = EXCLUDED.device_name,
    token_hash   = EXCLUDED.token_hash,
    hardware_id  = COALESCE(EXCLUDED.hardware_id, d.hardware_id),
    logged_in_at = CASE WHEN d.device_id = EXCLUDED.device_id THEN d.logged_in_at ELSE now() END,
    last_seen_at = now(),
    revoked_at   = NULL;

  INSERT INTO public.device_login_log (user_id, device_id, device_name, action)
  VALUES (p_user_id, p_device_id, p_device_name,
          CASE WHEN v_same_phone THEN 'login_same_phone' ELSE 'login' END);

  RETURN jsonb_build_object('ok', true, 'device_name', p_device_name);
END;
$$;
