-- Migration: Add SECURITY DEFINER to status updated and process bookings functions
-- Created At: 2026-08-20

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
