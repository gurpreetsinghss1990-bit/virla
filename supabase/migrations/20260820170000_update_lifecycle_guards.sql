-- Migration: Update Lifecycle Validation Guards
-- Created At: 2026-08-20

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
