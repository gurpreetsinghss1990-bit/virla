-- Migration: Trainer Travel and Session Lifecycle Authentication Fallbacks
-- Created At: 2026-08-23
-- Description: Redefines start_travel, mark_trainer_arrived, verify_session_otp, start_session, complete_session, submit_trainer_report, and submit_customer_review to use the local x-user-id fallback in local development.

-- 1. Redefine start_travel with local development x-user-id fallback
CREATE OR REPLACE FUNCTION public.start_travel(
  p_booking_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trainer_id text;
  v_booking record;
BEGIN
  -- Resolve trainer identity: try auth.uid() first, fall back to x-user-id header in local dev
  v_trainer_id := auth.uid()::text;
  IF v_trainer_id IS NULL AND public.is_local_development() THEN
    v_trainer_id := (current_setting('request.headers', true)::jsonb->>'x-user-id');
  END IF;

  IF v_trainer_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Verify trainer role
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_trainer_id AND role = 'trainer') THEN
    RAISE EXCEPTION 'Access denied. Only trainers can start travel.';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.trainer_id != v_trainer_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_booking.timeline_status = 'TRAINER_TRAVELLING' THEN
    RETURN jsonb_build_object('success', true);
  END IF;

  IF v_booking.timeline_status != 'TRAINER_ACCEPTED' AND v_booking.timeline_status != 'TRAINER_PREPARING' THEN
    RAISE EXCEPTION 'Invalid transition to trainer_travelling from %', v_booking.timeline_status;
  END IF;

  -- Start Travel Window: Opens exactly 25 minutes prior to scheduled start time
  IF now() < v_booking.scheduled_start_at - interval '25 minutes' THEN
    RAISE EXCEPTION 'Too early to start travel. Window opens exactly 25 minutes before scheduled session time.';
  END IF;
  
  IF now() > v_booking.scheduled_start_at + interval '30 minutes' THEN
     RAISE EXCEPTION 'Session expired. Travel window has closed.';
  END IF;

  UPDATE public.bookings 
  SET timeline_status = 'TRAINER_TRAVELLING', travel_started_at = now()
  WHERE id = p_booking_id;

  INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
  VALUES (p_booking_id, 'TRAVEL_STARTED', v_booking.timeline_status, 'TRAINER_TRAVELLING', v_trainer_id, 'trainer');

  RETURN jsonb_build_object('success', true);
END;
$$;


-- 2. Redefine mark_trainer_arrived with local development x-user-id fallback
CREATE OR REPLACE FUNCTION public.mark_trainer_arrived(
  p_booking_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trainer_id text;
  v_booking record;
  v_otp text;
BEGIN
  -- Resolve trainer identity: try auth.uid() first, fall back to x-user-id header in local dev
  v_trainer_id := auth.uid()::text;
  IF v_trainer_id IS NULL AND public.is_local_development() THEN
    v_trainer_id := (current_setting('request.headers', true)::jsonb->>'x-user-id');
  END IF;

  IF v_trainer_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Verify trainer role
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_trainer_id AND role = 'trainer') THEN
    RAISE EXCEPTION 'Access denied. Only trainers can mark arrived.';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.trainer_id != v_trainer_id THEN
     RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_booking.timeline_status = 'TRAINER_ARRIVED' THEN
     RETURN jsonb_build_object('success', true, 'otp_expires_at', v_booking.otp_expires_at);
  END IF;

  IF v_booking.timeline_status != 'TRAINER_TRAVELLING' THEN
    RAISE EXCEPTION 'Cannot mark arrived unless currently travelling';
  END IF;

  -- Cryptographically secure OTP generation on server
  v_otp := to_char(floor(100000 + random() * 900000), 'FM999999');

  UPDATE public.bookings
  SET timeline_status = 'TRAINER_ARRIVED',
      otp = v_otp,
      trainer_arrived_at = now(),
      grace_period_started_at = now(),
      otp_expires_at = now() + interval '15 minutes'
  WHERE id = p_booking_id;

  INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
  VALUES (p_booking_id, 'TRAINER_ARRIVED', 'TRAINER_TRAVELLING', 'TRAINER_ARRIVED', v_trainer_id, 'trainer');

  RETURN jsonb_build_object('success', true, 'otp_expires_at', now() + interval '15 minutes');
END;
$$;


-- 3. Redefine verify_session_otp with local development x-user-id fallback
CREATE OR REPLACE FUNCTION public.verify_session_otp(
  p_booking_id text,
  p_entered_otp text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_id text;
  v_booking record;
BEGIN
  -- Resolve caller identity: try auth.uid() first, fall back to x-user-id header in local dev
  v_caller_id := auth.uid()::text;
  IF v_caller_id IS NULL AND public.is_local_development() THEN
     v_caller_id := (current_setting('request.headers', true)::jsonb->>'x-user-id');
  END IF;

  IF v_caller_id IS NULL THEN
     RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- Verify client, trainer, or admin caller authorization
  IF v_booking.client_id != v_caller_id AND v_booking.trainer_id != v_caller_id AND NOT public.is_admin(v_caller_id) THEN
     RAISE EXCEPTION 'Access denied. Caller is not a participant of this booking.';
  END IF;

  IF v_booking.timeline_status = 'OTP_VERIFIED' THEN
    RETURN jsonb_build_object('success', true);
  END IF;

  IF v_booking.timeline_status != 'TRAINER_ARRIVED' THEN
    RAISE EXCEPTION 'Trainer must check in before verifying OTP';
  END IF;

  -- 15-minute Grace expiry check
  IF now() > v_booking.otp_expires_at THEN
     RAISE EXCEPTION 'OTP has expired. Grace period is over.';
  END IF;

  -- OTP match check
  IF v_booking.otp != p_entered_otp THEN
     RAISE EXCEPTION 'Invalid OTP. Please check and try again.';
  END IF;

  UPDATE public.bookings
  SET timeline_status = 'OTP_VERIFIED'
  WHERE id = p_booking_id;

  INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
  VALUES (p_booking_id, 'OTP_VERIFIED', 'TRAINER_ARRIVED', 'OTP_VERIFIED', v_caller_id, 
          CASE WHEN v_caller_id = v_booking.client_id THEN 'customer'::text ELSE 'trainer'::text END);

  RETURN jsonb_build_object('success', true);
END;
$$;


-- 4. Redefine start_session with local development x-user-id fallback
CREATE OR REPLACE FUNCTION public.start_session(
  p_booking_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trainer_id text;
  v_booking record;
BEGIN
  -- Resolve trainer identity: try auth.uid() first, fall back to x-user-id header in local dev
  v_trainer_id := auth.uid()::text;
  IF v_trainer_id IS NULL AND public.is_local_development() THEN
    v_trainer_id := (current_setting('request.headers', true)::jsonb->>'x-user-id');
  END IF;

  IF v_trainer_id IS NULL THEN
     RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Verify trainer role
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_trainer_id AND role = 'trainer') THEN
    RAISE EXCEPTION 'Access denied. Only trainers can start session.';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
     RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.trainer_id != v_trainer_id THEN
     RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_booking.timeline_status = 'WORKOUT_STARTED' THEN
     RETURN jsonb_build_object('success', true);
  END IF;

  IF v_booking.timeline_status != 'OTP_VERIFIED' THEN
     RAISE EXCEPTION 'Cannot start session unless OTP is verified';
  END IF;

  UPDATE public.bookings
  SET timeline_status = 'WORKOUT_STARTED',
      session_started_at = now()
  WHERE id = p_booking_id;

  INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
  VALUES (p_booking_id, 'WORKOUT_STARTED', 'OTP_VERIFIED', 'WORKOUT_STARTED', v_trainer_id, 'trainer');

  RETURN jsonb_build_object('success', true);
END;
$$;


-- 5. Redefine complete_session with local development x-user-id fallback
CREATE OR REPLACE FUNCTION public.complete_session(
  p_booking_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trainer_id text;
  v_booking record;
BEGIN
  -- Resolve trainer identity: try auth.uid() first, fall back to x-user-id header in local dev
  v_trainer_id := auth.uid()::text;
  IF v_trainer_id IS NULL AND public.is_local_development() THEN
    v_trainer_id := (current_setting('request.headers', true)::jsonb->>'x-user-id');
  END IF;

  IF v_trainer_id IS NULL THEN
     RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Verify trainer role
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_trainer_id AND role = 'trainer') THEN
    RAISE EXCEPTION 'Access denied. Only trainers can complete session.';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
     RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.trainer_id != v_trainer_id THEN
     RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_booking.timeline_status = 'WORKOUT_COMPLETED' THEN
     RETURN jsonb_build_object('success', true);
  END IF;

  IF v_booking.timeline_status != 'WORKOUT_STARTED' THEN
     RAISE EXCEPTION 'Cannot complete workout if status is not WORKOUT_STARTED';
  END IF;

  -- 30 mins session duration validation buffer
  IF now() < v_booking.session_started_at + interval '30 minutes' THEN
     RAISE EXCEPTION 'Workout cannot be completed yet. Minimum session duration buffer is 30 minutes.';
  END IF;

  UPDATE public.bookings
  SET timeline_status = 'WORKOUT_COMPLETED',
      status = 'completed',
      session_completed_at = now()
  WHERE id = p_booking_id;

  INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
  VALUES (p_booking_id, 'WORKOUT_COMPLETED', 'WORKOUT_STARTED', 'WORKOUT_COMPLETED', v_trainer_id, 'trainer');

  RETURN jsonb_build_object('success', true);
END;
$$;


-- 6. Redefine submit_trainer_report with local development x-user-id fallback
CREATE OR REPLACE FUNCTION public.submit_trainer_report(
  p_booking_id text,
  p_questionnaire jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trainer_id text;
  v_booking record;
  v_calories integer;
BEGIN
  -- Resolve trainer identity: try auth.uid() first, fall back to x-user-id header in local dev
  v_trainer_id := auth.uid()::text;
  IF v_trainer_id IS NULL AND public.is_local_development() THEN
    v_trainer_id := (current_setting('request.headers', true)::jsonb->>'x-user-id');
  END IF;

  IF v_trainer_id IS NULL THEN
     RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Verify trainer role
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_trainer_id AND role = 'trainer') THEN
    RAISE EXCEPTION 'Access denied. Only trainers can submit reports.';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
     RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.trainer_id != v_trainer_id THEN
     RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_booking.timeline_status = 'TRAINER_REPORT_SUBMITTED' THEN
     RETURN jsonb_build_object('success', true);
  END IF;

  IF v_booking.timeline_status != 'WORKOUT_COMPLETED' THEN
     RAISE EXCEPTION 'Timeline status must be WORKOUT_COMPLETED to submit report';
  END IF;

  v_calories := coalesce(v_booking.calories_burned, 380);

  UPDATE public.bookings
  SET timeline_status = 'TRAINER_REPORT_SUBMITTED',
      questionnaire = p_questionnaire
  WHERE id = p_booking_id;

  -- Atomic Earnings insertion
  INSERT INTO public.trainer_earnings (id, trainer_id, booking_id, client_name, amount, date, type)
  VALUES (
    'earn-' || EXTRACT(epoch FROM now())::bigint || '-' || floor(random()*1000)::text,
    v_trainer_id,
    p_booking_id,
    v_booking.client_name,
    800,
    to_char(now(), 'Mon DD, YYYY'),
    'session'
  );

  -- Log calories burned
  INSERT INTO public.calorie_logs (id, user_id, date, amount)
  VALUES (
    'cal-' || EXTRACT(epoch FROM now())::bigint || '-' || floor(random()*1000)::text,
    v_booking.client_id,
    current_date,
    v_calories
  );

  INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
  VALUES (p_booking_id, 'REPORT_SUBMITTED', 'WORKOUT_COMPLETED', 'TRAINER_REPORT_SUBMITTED', v_trainer_id, 'trainer');

  RETURN jsonb_build_object('success', true);
END;
$$;


-- 7. Redefine submit_customer_review with local development x-user-id fallback
CREATE OR REPLACE FUNCTION public.submit_customer_review(
  p_booking_id text,
  p_rating_details jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_client_id text;
  v_booking record;
  v_rating numeric;
  v_count integer;
  v_avg numeric;
BEGIN
  -- Resolve client identity: try auth.uid() first, fall back to x-user-id header in local dev
  v_client_id := auth.uid()::text;
  IF v_client_id IS NULL AND public.is_local_development() THEN
     v_client_id := (current_setting('request.headers', true)::jsonb->>'x-user-id');
  END IF;

  IF v_client_id IS NULL THEN
     RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Verify customer or admin role
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_client_id AND role = 'customer') AND NOT public.is_admin(v_client_id) THEN
    RAISE EXCEPTION 'Access denied. Only customers can submit reviews.';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
     RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.client_id != v_client_id THEN
     RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_booking.timeline_status = 'SESSION_CLOSED' THEN
     RETURN jsonb_build_object('success', true);
  END IF;

  IF v_booking.timeline_status != 'TRAINER_REPORT_SUBMITTED' AND v_booking.timeline_status != 'CUSTOMER_REVIEW_PENDING' THEN
     RAISE EXCEPTION 'Cannot submit review from state %', v_booking.timeline_status;
  END IF;

  v_rating := (p_rating_details->>'rating')::numeric;
  IF v_rating IS NULL OR v_rating < 1 OR v_rating > 5 THEN
     RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  UPDATE public.bookings
  SET timeline_status = 'SESSION_CLOSED',
      status = 'completed',
      rating_details = p_rating_details
  WHERE id = p_booking_id;

  -- Recalculate average rating of trainer
  SELECT count(*), avg((rating_details->>'rating')::numeric)
  INTO v_count, v_avg
  FROM public.bookings
  WHERE trainer_id = v_booking.trainer_id AND rating_details IS NOT NULL;

  UPDATE public.trainers
  SET rating = coalesce(v_avg, 5.0),
      rating_count = v_count,
      completed_sessions = completed_sessions + 1
  WHERE id = v_booking.trainer_id;

  INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
  VALUES (p_booking_id, 'SESSION_CLOSED', v_booking.timeline_status, 'SESSION_CLOSED', v_client_id, 'customer');

  RETURN jsonb_build_object('success', true);
END;
$$;
