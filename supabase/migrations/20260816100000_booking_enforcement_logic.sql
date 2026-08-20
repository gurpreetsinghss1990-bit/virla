-- Migration: Add Booking Enforcement, Reminders, and Auto-Expiration
-- Created At: 2026-08-16

-- Add reminder_sent column if not exists
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE;

-- 1. Helper to parse booking date and time into timestamptz
CREATE OR REPLACE FUNCTION public.parse_booking_start_time(b_date text, b_time text)
RETURNS timestamptz AS $$
DECLARE
  clean_date text;
  start_time text;
  combined text;
  result_ts timestamptz;
BEGIN
  -- Strip 'Today, ' or 'Tomorrow, '
  clean_date := b_date;
  IF clean_date LIKE 'Today, %' THEN
    clean_date := substring(clean_date from 8);
  ELSIF clean_date LIKE 'Tomorrow, %' THEN
    clean_date := substring(clean_date from 11);
  END IF;
  
  -- Extract start time range start (first part of "HH:MI AM - HH:MI PM")
  start_time := trim(split_part(b_time, '-', 1));
  
  -- Combine and convert
  IF clean_date ~ '^\d{4}-\d{2}-\d{2}$' THEN
    result_ts := to_timestamp(clean_date || ' ' || start_time, 'YYYY-MM-DD HH12:MI AM');
  ELSE
    result_ts := to_timestamp(clean_date || ' ' || start_time, 'Mon DD, YYYY HH12:MI AM');
  END IF;
  
  RETURN result_ts;
EXCEPTION WHEN OTHERS THEN
  RETURN now() + interval '2 hours'; -- safe fallback
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. RPC function to verify and start a session
CREATE OR REPLACE FUNCTION public.verify_and_start_session(booking_id text, entered_otp text)
RETURNS bigint AS $$
DECLARE
  b public.bookings%ROWTYPE;
  booked_start timestamptz;
  started_at bigint;
BEGIN
  -- Get the booking
  SELECT * INTO b FROM public.bookings WHERE id = booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found.';
  END IF;
  
  -- Verify status allows start
  IF b.status != 'upcoming' THEN
    RAISE EXCEPTION 'Booking is not in upcoming status.';
  END IF;
  
  -- Verify timeline status is trainer_arrived
  IF b.timeline_status != 'trainer_arrived' THEN
    RAISE EXCEPTION 'Trainer must check in before starting the session.';
  END IF;
  
  -- Verify trainer assignment
  IF b.trainer_id IS NULL OR b.trainer_id = 'searching' THEN
    RAISE EXCEPTION 'No trainer assigned to this booking.';
  END IF;
  
  -- Verify time window (±30 mins)
  booked_start := public.parse_booking_start_time(b.date, b.time);
  IF now() < booked_start - interval '30 minutes' THEN
    RAISE EXCEPTION 'Too early. Session starts at %.', b.time;
  END IF;
  IF now() > booked_start + interval '30 minutes' THEN
    RAISE EXCEPTION 'Session expired. Booked window has passed.';
  END IF;
  
  -- Verify OTP
  IF b.otp != entered_otp THEN
    RAISE EXCEPTION 'Invalid OTP. Please check and try again.';
  END IF;
  
  -- Check OTP expiry (grace period 15 mins)
  IF b.otp_expires_at IS NOT NULL AND (extract(epoch from now()) * 1000)::bigint > b.otp_expires_at THEN
    RAISE EXCEPTION 'OTP has expired. Grace period is over.';
  END IF;
  
  started_at := (extract(epoch from now()) * 1000)::bigint;

  -- Update booking
  UPDATE public.bookings
  SET 
    timeline_status = 'workout_started',
    workout_started_at = started_at
  WHERE id = booking_id;
  
  RETURN started_at;
END;
$$ LANGUAGE plpgsql;

-- 3. Stored procedure to automatically expire stale bookings
CREATE OR REPLACE FUNCTION public.expire_stale_bookings()
RETURNS void AS $$
DECLARE
  b RECORD;
  booked_start timestamptz;
  expire_count integer := 0;
BEGIN
  FOR b IN 
    SELECT id, date, time, status, timeline_status 
    FROM public.bookings 
    WHERE status = 'upcoming' 
      AND (timeline_status IS NULL OR timeline_status IN ('booked', 'trainer_assigned', 'trainer_accepted', 'trainer_preparing', 'trainer_travelling', 'trainer_arrived'))
  LOOP
    booked_start := public.parse_booking_start_time(b.date, b.time);
    
    IF now() > booked_start + interval '30 minutes' THEN
      UPDATE public.bookings
      SET 
        status = 'missed_session_not_started',
        timeline_status = 'session_closed'
      WHERE id = b.id;
      expire_count := expire_count + 1;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 4. Stored procedure to send 1-hour reminders
CREATE OR REPLACE FUNCTION public.send_booking_reminders()
RETURNS void AS $$
DECLARE
  b RECORD;
  booked_start timestamptz;
  client_user_name text;
  formatted_start_time text;
  client_body text;
  trainer_body text;
  notify_id_client text;
  notify_id_trainer text;
BEGIN
  FOR b IN 
    SELECT id, client_id, trainer_id, trainer_name, date, time, status
    FROM public.bookings
    WHERE status = 'upcoming'
      AND trainer_id IS NOT NULL 
      AND trainer_id != 'searching'
      AND (reminder_sent IS FALSE OR reminder_sent IS NULL)
  LOOP
    booked_start := public.parse_booking_start_time(b.date, b.time);
    
    -- Send if within 1 hour
    IF now() >= booked_start - interval '1 hour' AND now() < booked_start THEN
      
      SELECT name INTO client_user_name FROM public.users WHERE id = b.client_id;
      IF client_user_name IS NULL OR client_user_name = '' THEN
        client_user_name := 'Client';
      END IF;
      
      formatted_start_time := trim(split_part(b.time, '-', 1));
      
      client_body := json_build_object(
        'is_meta', true,
        'body', 'Your VIRLA session with Coach ' || b.trainer_name || ' starts at ' || formatted_start_time || '.',
        'type', 'Bookings',
        'priority', 'medium',
        'actionLabel', 'View Details',
        'deepLink', '/session-detail?id=' || b.id,
        'expiry', ''
      )::text;
      
      trainer_body := json_build_object(
        'is_meta', true,
        'body', 'Your VIRLA session with ' || client_user_name || ' starts at ' || formatted_start_time || '.',
        'type', 'Bookings',
        'priority', 'medium',
        'actionLabel', 'View Details',
        'deepLink', '/session-detail?id=' || b.id,
        'expiry', ''
      )::text;
      
      notify_id_client := 'notify-' || (extract(epoch from now()) * 1000)::text || '-' || floor(random() * 1000000)::text;
      notify_id_trainer := 'notify-' || (extract(epoch from now()) * 1000)::text || '-' || floor(random() * 1000000)::text;
      
      INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
      VALUES (notify_id_client, b.client_id, 'Session Reminder ⏱️', client_body, false, 'Just now', 'today', 'clock');
      
      INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
      VALUES (notify_id_trainer, b.trainer_id, 'Session Reminder ⏱️', trainer_body, false, 'Just now', 'today', 'clock');
      
      UPDATE public.bookings
      SET reminder_sent = true
      WHERE id = b.id;
      
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Enable pg_cron and schedule jobs if pg_cron is available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Schedule cron jobs
    PERFORM cron.schedule('expire-stale-bookings-job', '* * * * *', 'SELECT public.expire_stale_bookings();');
    PERFORM cron.schedule('send-booking-reminders-job', '* * * * *', 'SELECT public.send_booking_reminders();');
  END IF;
END $$;
