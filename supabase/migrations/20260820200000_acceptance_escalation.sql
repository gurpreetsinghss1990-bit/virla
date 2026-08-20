-- Migration: 10-Minute Acceptance Window, 5-Minute Escalation, and Auto-Acceptance
-- Created At: 2026-08-20

-- 1. Update validate_booking_transition trigger to support 10-minute manual acceptance window
CREATE OR REPLACE FUNCTION public.validate_booking_transition()
RETURNS trigger AS $$
DECLARE
  booked_start timestamptz;
  now_ms bigint;
  method text;
BEGIN
  now_ms := (extract(epoch from now()) * 1000)::bigint;

  -- If timeline_status is not changing, allow update
  IF OLD.timeline_status IS NOT DISTINCT FROM NEW.timeline_status THEN
    RETURN NEW;
  END IF;

  -- If session is closed, timeline_status cannot be changed
  IF OLD.timeline_status = 'session_closed' THEN
    RAISE EXCEPTION 'Cannot update timeline_status of a closed session.';
  END IF;

  -- Enforce state machine transitions
  IF NEW.timeline_status = 'booked' THEN
    IF OLD.timeline_status IS DISTINCT FROM 'booked' AND OLD.timeline_status IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot reset timeline_status to booked from %.', OLD.timeline_status;
    END IF;

  ELSIF NEW.timeline_status = 'trainer_assigned' THEN
    IF OLD.timeline_status IS DISTINCT FROM 'booked' AND OLD.timeline_status IS DISTINCT FROM 'trainer_assigned' THEN
      RAISE EXCEPTION 'Invalid transition to trainer_assigned from %.', OLD.timeline_status;
    END IF;

  ELSIF NEW.timeline_status = 'trainer_accepted' THEN
    IF OLD.timeline_status IS DISTINCT FROM 'booked' AND OLD.timeline_status IS DISTINCT FROM 'trainer_assigned' THEN
      RAISE EXCEPTION 'Invalid transition to trainer_accepted from %.', OLD.timeline_status;
    END IF;

    -- Standardize method names
    method := COALESCE(NEW.acceptance_method, 'manual');
    IF method = 'TRAINER_MANUAL_ACCEPT' THEN
      method := 'manual';
    ELSIF method = 'SYSTEM_AUTO_ACCEPT' THEN
      method := 'auto';
    END IF;
    NEW.acceptance_method := method;

    -- Enforce 10-minute acceptance window (600,000 ms) for manual accepts
    IF method = 'manual' AND now_ms - OLD.created_at >= 600000 THEN
      RAISE EXCEPTION 'Request has expired. The 10-minute acceptance window has closed.';
    END IF;
    
  ELSIF NEW.timeline_status = 'trainer_preparing' THEN
    IF OLD.timeline_status != 'trainer_accepted' THEN
      RAISE EXCEPTION 'Invalid transition to trainer_preparing from %.', OLD.timeline_status;
    END IF;

  ELSIF NEW.timeline_status = 'trainer_travelling' THEN
    IF OLD.timeline_status IS DISTINCT FROM 'trainer_accepted' AND OLD.timeline_status IS DISTINCT FROM 'trainer_preparing' THEN
      RAISE EXCEPTION 'Invalid transition to trainer_travelling from %.', OLD.timeline_status;
    END IF;

    -- Time-based validation for Start Travel (max 25 minutes before scheduled start time)
    booked_start := public.parse_booking_start_time(NEW.date, NEW.time);
    IF now() < booked_start - interval '25 minutes' THEN
      RAISE EXCEPTION 'Too early to start travel. Window opens 25 minutes before scheduled session time.';
    END IF;
    IF now() > booked_start + interval '30 minutes' THEN
      RAISE EXCEPTION 'Too late to start travel. Stale session window passed.';
    END IF;

    -- Record travel start timestamp
    NEW.travel_started_at := now_ms;

  ELSIF NEW.timeline_status = 'trainer_arrived' THEN
    IF OLD.timeline_status != 'trainer_travelling' THEN
      RAISE EXCEPTION 'Invalid transition to trainer_arrived from %.', OLD.timeline_status;
    END IF;

  ELSIF NEW.timeline_status = 'otp_verified' THEN
    IF OLD.timeline_status != 'trainer_arrived' THEN
      RAISE EXCEPTION 'Invalid transition to otp_verified from %.', OLD.timeline_status;
    END IF;

  ELSIF NEW.timeline_status = 'workout_started' THEN
    IF OLD.timeline_status != 'otp_verified' THEN
      RAISE EXCEPTION 'Invalid transition to workout_started from %.', OLD.timeline_status;
    END IF;
    
    NEW.workout_started_at := COALESCE(NEW.workout_started_at, now_ms);

  ELSIF NEW.timeline_status = 'workout_completed' THEN
    IF OLD.timeline_status != 'workout_started' THEN
      RAISE EXCEPTION 'Invalid transition to workout_completed from %.', OLD.timeline_status;
    END IF;

    NEW.workout_completed_at := now_ms;
    NEW.status := 'completed';

  ELSIF NEW.timeline_status = 'trainer_report_submitted' THEN
    IF OLD.timeline_status != 'workout_completed' THEN
      RAISE EXCEPTION 'Invalid transition to trainer_report_submitted from %.', OLD.timeline_status;
    END IF;

  ELSIF NEW.timeline_status = 'customer_review_pending' THEN
    IF OLD.timeline_status != 'trainer_report_submitted' THEN
      RAISE EXCEPTION 'Invalid transition to customer_review_pending from %.', OLD.timeline_status;
    END IF;

  ELSIF NEW.timeline_status = 'session_closed' THEN
    IF OLD.timeline_status IS DISTINCT FROM 'customer_review_pending' AND OLD.timeline_status IS DISTINCT FROM 'trainer_report_submitted' THEN
      RAISE EXCEPTION 'Invalid transition to session_closed from %.', OLD.timeline_status;
    END IF;
    NEW.status := 'completed';
    
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update status trigger to handle manual/system acceptance transitions and Client alert dispatch
CREATE OR REPLACE FUNCTION public.on_booking_status_updated()
RETURNS trigger AS $$
DECLARE
  notify_id text;
  client_body text;
  now_ms bigint;
  method text;
BEGIN
  now_ms := (extract(epoch from now()) * 1000)::bigint;

  -- Transition from booked to trainer_accepted
  IF NEW.timeline_status = 'trainer_accepted' AND OLD.timeline_status = 'booked' THEN
    method := COALESCE(NEW.acceptance_method, 'manual');
    IF method = 'TRAINER_MANUAL_ACCEPT' THEN
      method := 'manual';
    ELSIF method = 'SYSTEM_AUTO_ACCEPT' THEN
      method := 'auto';
    END IF;
    NEW.acceptance_method := method;
    
    IF method = 'auto' THEN
      NEW.auto_accepted_at := COALESCE(NEW.auto_accepted_at, now_ms);
    ELSE
      NEW.trainer_accepted_at := COALESCE(NEW.trainer_accepted_at, now_ms);
    END IF;

    -- Dispatch confirmation alert to client
    notify_id := 'notify-' || now_ms::text || '-' || floor(random() * 1000000)::text;
    client_body := json_build_object(
      'is_meta', true,
      'body', 'Your booking is confirmed. Coach ' || NEW.trainer_name || ' is assigned to your session on ' || NEW.date || ' @ ' || NEW.time || '.',
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update background process worker to handle auto-acceptance & 5m reminders
CREATE OR REPLACE FUNCTION public.process_pending_acceptance_bookings()
RETURNS void AS $$
DECLARE
  b RECORD;
  now_ms bigint;
  notify_id text;
  client_body text;
  trainer_body text;
  admin_body text;
  admin_notify_id text;
BEGIN
  now_ms := (extract(epoch from now()) * 1000)::bigint;

  FOR b IN
    SELECT id, client_id, client_name, trainer_id, trainer_name, date, time, workout_title, created_at,
           acceptance_notification_count, last_acceptance_notification_at, acceptance_deadline
    FROM public.bookings
    WHERE status = 'upcoming'
      AND timeline_status = 'booked'
  LOOP
    -- 3.1. Auto-Accept booking after 10 minutes
    IF now_ms >= b.created_at + 10 * 60 * 1000 THEN
      UPDATE public.bookings
      SET
        timeline_status = 'trainer_accepted',
        acceptance_method = 'auto',
        auto_accepted_at = now_ms,
        acceptance_notification_count = 3,
        last_acceptance_notification_at = now_ms
      WHERE id = b.id;

      -- Client notification
      notify_id := 'notify-' || now_ms::text || '-' || floor(random() * 1000000)::text;
      client_body := json_build_object(
        'is_meta', true,
        'body', 'Your booking for ' || b.workout_title || ' is confirmed. Coach ' || b.trainer_name || ' is assigned to your session on ' || b.date || ' @ ' || b.time || '.',
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
        'body', 'Session automatically accepted because no response was received within 10 minutes.',
        'type', 'Trainer Updates',
        'priority', 'high',
        'actionLabel', 'View Details',
        'deepLink', '/session-detail?id=' || b.id,
        'expiry', ''
      )::text;

      INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
      VALUES (notify_id, b.trainer_id, 'Booking Automatically Accepted ⚠️', trainer_body, false, 'Just now', 'today', 'alert-circle');

      -- Admin notification (Operational alert)
      admin_notify_id := 'notify-' || now_ms::text || '-' || floor(random() * 1000000)::text;
      admin_body := json_build_object(
        'is_meta', true,
        'body', 'A booking for ' || b.client_name || ' (ID: ' || b.id || ') was auto-accepted because Coach ' || b.trainer_name || ' did not respond within 10 minutes. Please contact the trainer.',
        'type', 'Admin Alerts',
        'priority', 'high',
        'actionLabel', 'View Details',
        'deepLink', '/admin-panel',
        'expiry', ''
      )::text;

      INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
      VALUES (admin_notify_id, 'u-testadmin', 'Booking Request Auto-Accepted 🚨', admin_body, false, 'Just now', 'today', 'alert-triangle');

    -- 3.2. Pending Acceptance Reminder after 5 minutes
    ELSIF now_ms >= b.created_at + 5 * 60 * 1000 AND b.acceptance_notification_count = 1 THEN
      notify_id := 'notify-' || now_ms::text || '-' || floor(random() * 1000000)::text;
      trainer_body := json_build_object(
        'is_meta', true,
        'body', 'URGENT: Booking request for ' || b.workout_title || ' on ' || b.date || ' @ ' || b.time || ' is still awaiting your action (5 mins left).',
        'type', 'Trainer Updates',
        'priority', 'high',
        'actionLabel', 'View Details',
        'deepLink', '/session-detail?id=' || b.id,
        'expiry', ''
      )::text;

      INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
      VALUES (notify_id, b.trainer_id, 'Urgent: Pending Booking Request — 5 Mins Left! 🔔', trainer_body, false, 'Just now', 'today', 'bell');

      -- Update notification count
      UPDATE public.bookings
      SET
        acceptance_notification_count = 2,
        last_acceptance_notification_at = now_ms
      WHERE id = b.id;

    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
