-- Migration: advance_session Single-Writer RPC + session_events table + Transition Guards + Notification Deduplication
-- Created: 2026-10-28

-- 1. Create session_events table (audit history for session timeline progression)
CREATE TABLE IF NOT EXISTS public.session_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id text NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  step text NOT NULL,
  previous_status text,
  new_status text NOT NULL,
  actor_id text,
  actor_role text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_events_booking_id ON public.session_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_session_events_step ON public.session_events(step);

ALTER TABLE public.session_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for session participants or admin" ON public.session_events;
CREATE POLICY "Enable read access for session participants or admin" ON public.session_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = session_events.booking_id
        AND (
          b.client_id = COALESCE(nullif(current_setting('request.jwt.claim.sub', true), ''), (current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)
          OR b.trainer_id = COALESCE(nullif(current_setting('request.jwt.claim.sub', true), ''), (current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)
          OR public.is_admin(COALESCE(nullif(current_setting('request.jwt.claim.sub', true), ''), (current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))
        )
    )
  );

-- 2. Add booking_id and step to notifications table for deduplication
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS booking_id text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS step text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_booking_step_dedupe
  ON public.notifications(user_id, booking_id, step)
  WHERE booking_id IS NOT NULL AND step IS NOT NULL;

-- 3. Core Single-Writer advance_session RPC
CREATE OR REPLACE FUNCTION public.advance_session(
  p_booking_id text,
  p_next_status text,
  p_actor_role text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_id text;
  v_booking record;
  v_curr text;
  v_target text;
  v_role text;
  v_otp text;
  v_user_notif_title text;
  v_user_notif_body text;
  v_trainer_notif_title text;
  v_trainer_notif_body text;
  v_scheduled_start timestamptz;
BEGIN
  -- Determine authenticated caller
  v_caller_id := COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (current_setting('request.headers', true)::jsonb->>'x-user-id')
  );

  -- Lock booking row exclusively to guarantee atomic serialized transition
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found: %', p_booking_id;
  END IF;

  -- Normalize current & target status to uppercase
  v_curr := UPPER(COALESCE(v_booking.timeline_status, 'BOOKED'));
  v_target := UPPER(TRIM(p_next_status));

  -- Idempotency check: if already at the target status, return success immediately without throwing
  IF v_curr = v_target THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', LOWER(v_curr),
      'idempotent', true,
      'message', 'Session is already at target status.'
    );
  END IF;

  -- Determine caller role (override with verified DB role if caller is known)
  IF v_caller_id IS NOT NULL THEN
    IF public.is_admin(v_caller_id) THEN
      v_role := 'admin';
    ELSIF v_booking.trainer_id = v_caller_id THEN
      v_role := 'trainer';
    ELSIF v_booking.client_id = v_caller_id THEN
      v_role := 'customer';
    ELSE
      v_role := COALESCE(p_actor_role, 'customer');
    END IF;
  ELSE
    v_role := COALESCE(p_actor_role, 'trainer');
  END IF;

  -- Strict Transition Guards Map
  CASE v_target
    WHEN 'TRAINER_ACCEPTED' THEN
      -- Handled primarily by trainer_accept_booking, but allow advance if from BOOKED or TRAINER_ASSIGNED
      IF v_curr NOT IN ('BOOKED', 'TRAINER_ASSIGNED') THEN
        RAISE EXCEPTION 'Invalid transition to TRAINER_ACCEPTED from %', v_curr;
      END IF;
      IF v_role NOT IN ('trainer', 'admin') THEN
        RAISE EXCEPTION 'Only trainer or admin can accept booking';
      END IF;

    WHEN 'TRAINER_PREPARING' THEN
      IF v_curr != 'TRAINER_ACCEPTED' THEN
        RAISE EXCEPTION 'Invalid transition to TRAINER_PREPARING from %', v_curr;
      END IF;
      IF v_role NOT IN ('trainer', 'admin') THEN
        RAISE EXCEPTION 'Only trainer or admin can advance to TRAINER_PREPARING';
      END IF;

    WHEN 'TRAINER_TRAVELLING' THEN
      IF v_curr NOT IN ('TRAINER_ACCEPTED', 'TRAINER_PREPARING') THEN
        RAISE EXCEPTION 'Invalid transition to TRAINER_TRAVELLING from %', v_curr;
      END IF;
      IF v_role NOT IN ('trainer', 'admin') THEN
        RAISE EXCEPTION 'Only trainer or admin can start travel';
      END IF;

      -- Travel Window Check: opens 25 minutes prior to scheduled start time
      v_scheduled_start := COALESCE(v_booking.scheduled_start_at, public.parse_booking_start_time(v_booking.date, v_booking.time));
      IF v_scheduled_start IS NOT NULL THEN
        IF now() < v_scheduled_start - interval '25 minutes' AND v_role != 'admin' THEN
          RAISE EXCEPTION 'Too early to start travel. Window opens 25 minutes before session time.';
        END IF;
      END IF;

    WHEN 'TRAINER_ARRIVED' THEN
      IF v_curr != 'TRAINER_TRAVELLING' THEN
        RAISE EXCEPTION 'Invalid transition to TRAINER_ARRIVED from %', v_curr;
      END IF;
      IF v_role NOT IN ('trainer', 'admin') THEN
        RAISE EXCEPTION 'Only trainer or admin can mark arrived';
      END IF;

      -- Generate 6-digit OTP if not already generated
      v_otp := to_char(floor(100000 + random() * 900000), 'FM999999');

    WHEN 'OTP_VERIFIED' THEN
      IF v_curr != 'TRAINER_ARRIVED' THEN
        RAISE EXCEPTION 'Invalid transition to OTP_VERIFIED from %', v_curr;
      END IF;

    WHEN 'WORKOUT_STARTED' THEN
      IF v_curr != 'OTP_VERIFIED' THEN
        RAISE EXCEPTION 'Invalid transition to WORKOUT_STARTED from %. OTP must be verified first.', v_curr;
      END IF;
      IF v_role NOT IN ('trainer', 'admin') THEN
        RAISE EXCEPTION 'Only trainer or admin can start workout';
      END IF;

    WHEN 'WORKOUT_COMPLETED' THEN
      IF v_curr != 'WORKOUT_STARTED' THEN
        RAISE EXCEPTION 'Invalid transition to WORKOUT_COMPLETED from %', v_curr;
      END IF;
      IF v_role NOT IN ('trainer', 'admin') THEN
        RAISE EXCEPTION 'Only trainer or admin can complete workout';
      END IF;

    WHEN 'TRAINER_REPORT_SUBMITTED' THEN
      IF v_curr != 'WORKOUT_COMPLETED' THEN
        RAISE EXCEPTION 'Invalid transition to TRAINER_REPORT_SUBMITTED from %', v_curr;
      END IF;
      IF v_role NOT IN ('trainer', 'admin') THEN
        RAISE EXCEPTION 'Only trainer or admin can submit report';
      END IF;

    WHEN 'CUSTOMER_REVIEW_PENDING' THEN
      IF v_curr NOT IN ('WORKOUT_COMPLETED', 'TRAINER_REPORT_SUBMITTED') THEN
        RAISE EXCEPTION 'Invalid transition to CUSTOMER_REVIEW_PENDING from %', v_curr;
      END IF;

    WHEN 'SESSION_CLOSED' THEN
      IF v_curr NOT IN ('WORKOUT_COMPLETED', 'TRAINER_REPORT_SUBMITTED', 'CUSTOMER_REVIEW_PENDING') THEN
        RAISE EXCEPTION 'Invalid transition to SESSION_CLOSED from %', v_curr;
      END IF;

    ELSE
      RAISE EXCEPTION 'Unrecognized target timeline status: %', p_next_status;
  END CASE;

  -- Perform the Authoritative UPDATE on bookings
  UPDATE public.bookings
  SET
    timeline_status = v_target,
    status = CASE
      WHEN v_target = 'TRAINER_ACCEPTED' AND status = 'pending' THEN 'upcoming'
      WHEN v_target IN ('WORKOUT_COMPLETED', 'SESSION_CLOSED') THEN 'completed'
      ELSE status
    END,
    travel_started_at = CASE WHEN v_target = 'TRAINER_TRAVELLING' AND travel_started_at IS NULL THEN now() ELSE travel_started_at END,
    trainer_arrived_at = CASE WHEN v_target = 'TRAINER_ARRIVED' AND trainer_arrived_at IS NULL THEN now() ELSE trainer_arrived_at END,
    grace_period_started_at = CASE WHEN v_target = 'TRAINER_ARRIVED' AND grace_period_started_at IS NULL THEN now() ELSE grace_period_started_at END,
    otp = CASE WHEN v_target = 'TRAINER_ARRIVED' THEN COALESCE(v_otp, otp) ELSE otp END,
    otp_expires_at = CASE WHEN v_target = 'TRAINER_ARRIVED' THEN now() + interval '15 minutes' ELSE otp_expires_at END,
    session_started_at = CASE WHEN v_target = 'WORKOUT_STARTED' AND session_started_at IS NULL THEN now() ELSE session_started_at END,
    session_completed_at = CASE WHEN v_target = 'WORKOUT_COMPLETED' AND session_completed_at IS NULL THEN now() ELSE session_completed_at END,
    updated_at = now()
  WHERE id = p_booking_id;

  -- Record audit event in session_events table
  INSERT INTO public.session_events (
    booking_id,
    step,
    previous_status,
    new_status,
    actor_id,
    actor_role,
    metadata
  ) VALUES (
    p_booking_id,
    LOWER(v_target),
    LOWER(v_curr),
    LOWER(v_target),
    COALESCE(v_caller_id, 'system'),
    v_role,
    jsonb_build_object('client_id', v_booking.client_id, 'trainer_id', v_booking.trainer_id)
  );

  -- Record in legacy booking_state_events table for backward compatibility
  INSERT INTO public.booking_state_events (
    booking_id,
    event_type,
    previous_state,
    new_state,
    actor_user_id,
    actor_role
  ) VALUES (
    p_booking_id,
    v_target,
    v_curr,
    v_target,
    COALESCE(v_caller_id, 'system'),
    v_role
  );

  -- Atomic Server-Side Notification Deduplication (ON CONFLICT DO NOTHING)
  CASE v_target
    WHEN 'TRAINER_ACCEPTED' THEN
      v_user_notif_title := 'Coach Confirmed! 🎉';
      v_user_notif_body := 'Your coach has accepted and confirmed your session.';
    WHEN 'TRAINER_PREPARING' THEN
      v_user_notif_title := 'Gear Prepared 🎒';
      v_user_notif_body := 'Your coach is sanitizing and packing equipment for your session.';
    WHEN 'TRAINER_TRAVELLING' THEN
      v_user_notif_title := 'Coach En Route 🚗';
      v_user_notif_body := 'Your coach is travelling to your location. Live tracking is active.';
    WHEN 'TRAINER_ARRIVED' THEN
      v_user_notif_title := 'Coach Arrived 📍';
      v_user_notif_body := 'Your coach has arrived at your address. Share your OTP to check in.';
    WHEN 'OTP_VERIFIED' THEN
      v_user_notif_title := 'Check-In Complete ✅';
      v_user_notif_body := 'Identity verified! Your workout session is ready to begin.';
    WHEN 'WORKOUT_STARTED' THEN
      v_user_notif_title := 'Workout Started 💪';
      v_user_notif_body := 'Timer active! Warm-up and workout conditioning underway.';
    WHEN 'WORKOUT_COMPLETED' THEN
      v_user_notif_title := 'Workout Completed 🏆';
      v_user_notif_body := 'Great session! Your coach is logging workout performance.';
    WHEN 'SESSION_CLOSED' THEN
      v_user_notif_title := 'Session Closed ✨';
      v_user_notif_body := 'Session records archived. Thank you for training with Virla!';
    ELSE
      v_user_notif_title := NULL;
  END CASE;

  IF v_user_notif_title IS NOT NULL AND v_booking.client_id IS NOT NULL THEN
    INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon, booking_id, step)
    VALUES (
      'notif-' || extract(epoch from now())::bigint || '-' || floor(random()*1000)::text,
      v_booking.client_id,
      v_user_notif_title,
      v_user_notif_body,
      false,
      'Just now',
      'today',
      'calendar',
      p_booking_id,
      LOWER(v_target)
    )
    ON CONFLICT (user_id, booking_id, step) WHERE booking_id IS NOT NULL AND step IS NOT NULL
    DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'previous_status', LOWER(v_curr),
    'status', LOWER(v_target),
    'booking_id', p_booking_id,
    'otp', CASE WHEN v_target = 'TRAINER_ARRIVED' THEN v_otp ELSE NULL END
  );
END;
$$;

-- 4. Update existing helper RPCs to cleanly delegate to advance_session or use atomic transitions
CREATE OR REPLACE FUNCTION public.update_session_timeline(
  p_booking_id text,
  p_target_status text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN public.advance_session(p_booking_id, p_target_status);
END;
$$;
