-- Migration: Trainer Booking Acceptance, Auto-Acceptance Cron, and Dynamic Sound Customization
-- Created At: 2026-08-16

-- 1. Extend bookings table schema with trainer acceptance tracking metadata
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS acceptance_notification_count INTEGER DEFAULT 1;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS last_acceptance_notification_at BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS acceptance_method TEXT DEFAULT NULL;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS acceptance_deadline BIGINT DEFAULT (extract(epoch from now()) * 1000 + 30 * 60 * 1000)::bigint;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS auto_accepted_at BIGINT DEFAULT NULL;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS trainer_accepted_at BIGINT DEFAULT NULL;

-- 2. Create status trigger to handle manual/system acceptance transitions and Client alert dispatch
CREATE OR REPLACE FUNCTION public.on_booking_status_updated()
RETURNS trigger AS $$
DECLARE
  notify_id text;
  client_body text;
  now_ms bigint;
BEGIN
  now_ms := (extract(epoch from now()) * 1000)::bigint;

  -- Transition from booked to trainer_accepted
  IF NEW.timeline_status = 'trainer_accepted' AND OLD.timeline_status = 'booked' THEN
    NEW.acceptance_method := COALESCE(NEW.acceptance_method, 'TRAINER_MANUAL_ACCEPT');
    NEW.trainer_accepted_at := COALESCE(NEW.trainer_accepted_at, now_ms);

    -- Dispatch confirmation alert to client
    notify_id := 'notify-' || now_ms::text || '-' || floor(random() * 1000000)::text;
    client_body := json_build_object(
      'is_meta', true,
      'body', 'Coach ' || NEW.trainer_name || ' has accepted your VIRLA session for ' || NEW.date || ' @ ' || NEW.time || '.',
      'type', 'Bookings',
      'priority', 'high',
      'actionLabel', 'View Details',
      'deepLink', '/session-detail?id=' || NEW.id,
      'expiry', ''
    )::text;

    INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
    VALUES (notify_id, NEW.client_id, 'Trainer Assigned ⚡', client_body, false, 'Just now', 'today', 'check-circle');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_booking_status_updated ON public.bookings;
CREATE TRIGGER trg_booking_status_updated
BEFORE UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.on_booking_status_updated();

-- 3. Create background process worker to handle auto-acceptance & T+15m reminders
CREATE OR REPLACE FUNCTION public.process_pending_acceptance_bookings()
RETURNS void AS $$
DECLARE
  b RECORD;
  now_ms bigint;
  notify_id text;
  client_body text;
  trainer_body text;
BEGIN
  now_ms := (extract(epoch from now()) * 1000)::bigint;

  FOR b IN
    SELECT id, client_id, trainer_id, trainer_name, date, time, workout_title, created_at,
           acceptance_notification_count, last_acceptance_notification_at, acceptance_deadline
    FROM public.bookings
    WHERE status = 'upcoming'
      AND timeline_status = 'booked'
  LOOP
    -- 3.1. Auto-Accept booking after 30 minutes
    IF now_ms >= b.acceptance_deadline THEN
      UPDATE public.bookings
      SET
        timeline_status = 'trainer_accepted',
        acceptance_method = 'SYSTEM_AUTO_ACCEPT',
        auto_accepted_at = now_ms
      WHERE id = b.id;

      -- Client notification
      notify_id := 'notify-' || now_ms::text || '-' || floor(random() * 1000000)::text;
      client_body := json_build_object(
        'is_meta', true,
        'body', 'Your booking is confirmed. Coach ' || b.trainer_name || ' is assigned to your session on ' || b.date || ' @ ' || b.time || '.',
        'type', 'Bookings',
        'priority', 'high',
        'actionLabel', 'View Details',
        'deepLink', '/session-detail?id=' || b.id,
        'expiry', ''
      )::text;

      INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
      VALUES (notify_id, b.client_id, 'Trainer Assigned ⚡', client_body, false, 'Just now', 'today', 'check-circle');

      -- Trainer notification
      notify_id := 'notify-' || now_ms::text || '-' || floor(random() * 1000000)::text;
      trainer_body := json_build_object(
        'is_meta', true,
        'body', 'Session automatically accepted because no response was received within 30 minutes.',
        'type', 'Trainer Updates',
        'priority', 'high',
        'actionLabel', 'View Details',
        'deepLink', '/session-detail?id=' || b.id,
        'expiry', ''
      )::text;

      INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
      VALUES (notify_id, b.trainer_id, 'Booking Automatically Accepted ⚠️', trainer_body, false, 'Just now', 'today', 'alert-circle');

    -- 3.2. Pending Acceptance Reminder after 15 minutes
    ELSIF now_ms >= b.last_acceptance_notification_at + 15 * 60 * 1000 THEN
      notify_id := 'notify-' || now_ms::text || '-' || floor(random() * 1000000)::text;
      trainer_body := json_build_object(
        'is_meta', true,
        'body', 'Action Required: You have a pending booking request for ' || b.workout_title || ' on ' || b.date || ' @ ' || b.time || '.',
        'type', 'Trainer Updates',
        'priority', 'high',
        'actionLabel', 'View Details',
        'deepLink', '/session-detail?id=' || b.id,
        'expiry', ''
      )::text;

      INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
      VALUES (notify_id, b.trainer_id, 'Pending Booking Request — Action Required 🔔', trainer_body, false, 'Just now', 'today', 'bell');

      -- Update notification timestamps/counts to prevent infinite trigger loops
      UPDATE public.bookings
      SET
        acceptance_notification_count = b.acceptance_notification_count + 1,
        last_acceptance_notification_at = now_ms
      WHERE id = b.id;

    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 4. Register background cron job
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('process-pending-acceptance-bookings-job', '* * * * *', 'SELECT public.process_pending_acceptance_bookings();');
  END IF;
END $$;

-- 5. Update push delivery trigger to customize chimes based on action requirements
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
$$ LANGUAGE plpgsql;
