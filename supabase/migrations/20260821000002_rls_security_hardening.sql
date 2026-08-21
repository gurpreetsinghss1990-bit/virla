-- Migration: RLS Security Hardening for device_tokens, push_delivery_logs, and slot_reservations
-- Created At: 2026-08-21
-- Target: LOCAL ONLY

-- 1. Enable RLS on target tables
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slot_reservations ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if any (ensure clean state)
DROP POLICY IF EXISTS "Enable SELECT for owner or admin" ON public.device_tokens;
DROP POLICY IF EXISTS "Enable INSERT for owner or admin" ON public.device_tokens;
DROP POLICY IF EXISTS "Enable UPDATE for owner or admin" ON public.device_tokens;
DROP POLICY IF EXISTS "Enable DELETE for owner or admin" ON public.device_tokens;

DROP POLICY IF EXISTS "Enable ALL for admin only" ON public.push_delivery_logs;

DROP POLICY IF EXISTS "Enable SELECT for authenticated users" ON public.slot_reservations;
DROP POLICY IF EXISTS "Enable INSERT for owner or admin" ON public.slot_reservations;
DROP POLICY IF EXISTS "Enable DELETE for owner, expired, or admin" ON public.slot_reservations;

-- 3. Create policies for public.device_tokens
CREATE POLICY "Enable SELECT for owner or admin" ON public.device_tokens
  FOR SELECT USING (user_id = auth.uid()::text OR public.is_admin(auth.uid()::text));

CREATE POLICY "Enable INSERT for owner or admin" ON public.device_tokens
  FOR INSERT WITH CHECK (user_id = auth.uid()::text OR public.is_admin(auth.uid()::text));

CREATE POLICY "Enable UPDATE for owner or admin" ON public.device_tokens
  FOR UPDATE USING (user_id = auth.uid()::text OR public.is_admin(auth.uid()::text))
  WITH CHECK (user_id = auth.uid()::text OR public.is_admin(auth.uid()::text));

CREATE POLICY "Enable DELETE for owner or admin" ON public.device_tokens
  FOR DELETE USING (user_id = auth.uid()::text OR public.is_admin(auth.uid()::text));

-- 4. Create database trigger for public.device_tokens same-device duplicate token cleanup
CREATE OR REPLACE FUNCTION public.handle_device_token_cleanup()
RETURNS trigger AS $$
BEGIN
  -- Privileged cleanup of existing mappings of the same token for other users
  DELETE FROM public.device_tokens
  WHERE token = NEW.token AND user_id IS DISTINCT FROM NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_device_token_cleanup ON public.device_tokens;
CREATE TRIGGER trg_device_token_cleanup
  BEFORE INSERT OR UPDATE ON public.device_tokens
  FOR EACH ROW EXECUTE FUNCTION public.handle_device_token_cleanup();

-- 5. Create policies for public.push_delivery_logs (Admin only, trigger bypasses via SECURITY DEFINER)
CREATE POLICY "Enable ALL for admin only" ON public.push_delivery_logs
  FOR ALL USING (public.is_admin(auth.uid()::text));

-- 6. Recreate public.on_notification_inserted() as SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.on_notification_inserted()
RETURNS trigger AS $$
DECLARE
  token_row record;
  payload jsonb;
  body_meta jsonb;
  msg_body text;
  msg_deep_link text;
  sound_name text;
  chan_id text;
BEGIN
  -- Parse body
  BEGIN
    body_meta := NEW.body::jsonb;
    msg_body := body_meta->>'body';
    msg_deep_link := body_meta->>'deepLink';
  EXCEPTION WHEN OTHERS THEN
    body_meta := NULL;
    msg_body := NEW.body;
    msg_deep_link := '';
  END;

  -- Distinguish chimes & channels (Section 10, 34)
  IF NEW.title LIKE '%Action Required%' OR NEW.title LIKE '%New Booking%' OR NEW.title LIKE '%Pending Booking%' THEN
    sound_name := 'virla_booking_alert.wav';
    chan_id := 'virla_bookings';
  ELSIF NEW.title LIKE '%Reminder%' OR NEW.title LIKE '%reminder%' THEN
    sound_name := 'virla_reminder.wav';
    chan_id := 'virla_session_reminders';
  ELSIF NEW.title LIKE '%Cancel%' OR NEW.title LIKE '%cancel%' OR NEW.title LIKE '%Book%' OR NEW.title LIKE '%Assign%' OR NEW.title LIKE '%Assigned%' OR NEW.title LIKE '%accepted%' THEN
    sound_name := 'virla_notification.wav';
    chan_id := 'virla_bookings';
  ELSE
    sound_name := 'default';
    chan_id := 'virla_general';
  END IF;

  -- Send Expo pushes
  FOR token_row IN
    SELECT token, platform
    FROM public.device_tokens
    WHERE user_id = NEW.user_id
  LOOP
    payload := json_build_object(
      'to', token_row.token,
      'title', NEW.title,
      'body', msg_body,
      'sound', sound_name,
      'channelId', chan_id,
      'data', json_build_object(
        'deepLink', msg_deep_link,
        'notificationId', NEW.id
      )
    );

    PERFORM net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := payload
    );

    INSERT INTO public.push_delivery_logs (notification_id, user_id, device_token, platform, payload)
    VALUES (NEW.id, NEW.user_id, token_row.token, token_row.platform, payload);
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 7. Create policies for public.slot_reservations
CREATE POLICY "Enable SELECT for authenticated users" ON public.slot_reservations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable INSERT for owner or admin" ON public.slot_reservations
  FOR INSERT WITH CHECK (client_id = auth.uid()::text OR public.is_admin(auth.uid()::text));

CREATE POLICY "Enable DELETE for owner, expired, or admin" ON public.slot_reservations
  FOR DELETE USING (
    client_id = auth.uid()::text 
    OR expires_at <= now() 
    OR public.is_admin(auth.uid()::text)
  );
