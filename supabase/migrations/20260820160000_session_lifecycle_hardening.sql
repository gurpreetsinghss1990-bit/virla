-- Migration: Hardening post-booking session delivery lifecycle
-- Created At: 2026-08-20

-- 1. Add travel_started_at and workout_completed_at columns to bookings table
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS travel_started_at BIGINT DEFAULT NULL;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS workout_completed_at BIGINT DEFAULT NULL;

-- 2. Adjust parse_booking_start_time helper to offset by India Standard Time (UTC+5:30)
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
  
  -- Subtract 5.5 hours to align UTC database now() comparison with IST calendar times
  RETURN result_ts - interval '5 hours 30 minutes';
EXCEPTION WHEN OTHERS THEN
  RETURN now() + interval '2 hours'; -- safe fallback
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Redefine verify_and_start_session to transition timeline_status to 'otp_verified' instead of 'workout_started'
CREATE OR REPLACE FUNCTION public.verify_and_start_session(booking_id text, entered_otp text)
RETURNS bigint AS $$
DECLARE
  b public.bookings%ROWTYPE;
  booked_start timestamptz;
  verified_at bigint;
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
    RAISE EXCEPTION 'Trainer must check in before verifying OTP.';
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
  
  verified_at := (extract(epoch from now()) * 1000)::bigint;

  -- Update booking to otp_verified status
  UPDATE public.bookings
  SET 
    timeline_status = 'otp_verified'
  WHERE id = booking_id;
  
  RETURN verified_at;
END;
$$ LANGUAGE plpgsql;

-- 4. Create authoritative timeline validation trigger function
CREATE OR REPLACE FUNCTION public.validate_booking_transition()
RETURNS trigger AS $$
DECLARE
  booked_start timestamptz;
  now_ms bigint;
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
    
  ELSE
    RAISE EXCEPTION 'Invalid timeline_status: %', NEW.timeline_status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bind trigger alphabetically as a_validate_booking_transition (runs before trg_booking_status_updated)
DROP TRIGGER IF EXISTS a_validate_booking_transition ON public.bookings;
CREATE TRIGGER a_validate_booking_transition
BEFORE UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.validate_booking_transition();


-- 5. Extend public.on_booking_status_updated trigger to handle notification for trainer_travelling
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

  -- Transition to trainer_travelling
  IF NEW.timeline_status = 'trainer_travelling' AND OLD.timeline_status IS DISTINCT FROM 'trainer_travelling' THEN
    notify_id := 'notify-' || now_ms::text || '-' || floor(random() * 1000000)::text;
    client_body := json_build_object(
      'is_meta', true,
      'body', 'Your trainer has started travelling for your session.',
      'type', 'Bookings',
      'priority', 'high',
      'actionLabel', 'View Details',
      'deepLink', '/session-detail?id=' || NEW.id,
      'expiry', ''
    )::text;

    INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
    VALUES (notify_id, NEW.client_id, 'Trainer En Route 🚗', client_body, false, 'Just now', 'today', 'navigation');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
