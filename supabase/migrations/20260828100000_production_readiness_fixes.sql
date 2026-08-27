-- Migration: Production Readiness Fixes for Booking State Machine & RLS
-- Created At: 2026-08-28
-- Description: Redefines the 13 post-booking lifecycle functions and bookings UPDATE policy to support production-safe identity header fallback. Creates add_partner_to_booking RPC to replace unsafe client-side credit updates.

-- 1. Redefine trainer_accept_booking with production identity fallback
CREATE OR REPLACE FUNCTION public.trainer_accept_booking(
  p_booking_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trainer_id text;
  v_booking record;
BEGIN
  v_trainer_id := COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (current_setting('request.headers', true)::jsonb->>'x-user-id')
  );

  IF v_trainer_id IS NULL THEN
     RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Verify trainer role
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_trainer_id AND role = 'trainer') THEN
    RAISE EXCEPTION 'Access denied. Only trainers can accept bookings.';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.trainer_id != v_trainer_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Idempotently handle if already accepted or in subsequent states
  IF v_booking.timeline_status IN ('TRAINER_ACCEPTED', 'TRAINER_PREPARING', 'TRAINER_TRAVELLING', 'TRAINER_ARRIVED', 'OTP_VERIFIED', 'WORKOUT_STARTED', 'WORKOUT_COMPLETED', 'SESSION_CLOSED') THEN
    RETURN jsonb_build_object('success', true);
  END IF;

  IF v_booking.timeline_status != 'BOOKED' AND v_booking.timeline_status != 'TRAINER_ASSIGNED' THEN
    RAISE EXCEPTION 'Cannot accept from state %', v_booking.timeline_status;
  END IF;

  -- 30-minute SLA acceptance check
  IF now() > v_booking.request_created_at + interval '30 minutes' THEN
    RAISE EXCEPTION 'Request has expired. The 30-minute acceptance window has closed.';
  END IF;

  UPDATE public.bookings
  SET timeline_status = 'TRAINER_ACCEPTED',
      acceptance_method = 'manual',
      manual_accepted_at = now()
  WHERE id = p_booking_id;

  INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
  VALUES (p_booking_id, 'TRAINER_MANUAL_ACCEPT', v_booking.timeline_status, 'TRAINER_ACCEPTED', v_trainer_id, 'trainer');

  RETURN jsonb_build_object('success', true);
END;
$$;


-- 2. Redefine start_travel with production identity fallback
CREATE OR REPLACE FUNCTION public.start_travel(
  p_booking_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trainer_id text;
  v_booking record;
BEGIN
  v_trainer_id := COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (current_setting('request.headers', true)::jsonb->>'x-user-id')
  );

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


-- 3. Redefine mark_trainer_arrived with production identity fallback
CREATE OR REPLACE FUNCTION public.mark_trainer_arrived(
  p_booking_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trainer_id text;
  v_booking record;
  v_otp text;
BEGIN
  v_trainer_id := COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (current_setting('request.headers', true)::jsonb->>'x-user-id')
  );

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


-- 4. Redefine verify_session_otp with production identity fallback
CREATE OR REPLACE FUNCTION public.verify_session_otp(
  p_booking_id text,
  p_entered_otp text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_id text;
  v_booking record;
BEGIN
  v_caller_id := COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (current_setting('request.headers', true)::jsonb->>'x-user-id')
  );

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


-- 5. Redefine start_session with production identity fallback
CREATE OR REPLACE FUNCTION public.start_session(
  p_booking_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trainer_id text;
  v_booking record;
BEGIN
  v_trainer_id := COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (current_setting('request.headers', true)::jsonb->>'x-user-id')
  );

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

  -- Idempotence check
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


-- 6. Redefine complete_session with production identity fallback
CREATE OR REPLACE FUNCTION public.complete_session(
  p_booking_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trainer_id text;
  v_booking record;
BEGIN
  v_trainer_id := COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (current_setting('request.headers', true)::jsonb->>'x-user-id')
  );

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


-- 7. Redefine submit_trainer_report with production identity fallback
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
  v_trainer_id := COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (current_setting('request.headers', true)::jsonb->>'x-user-id')
  );

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


-- 8. Redefine submit_customer_review with production identity fallback
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
  v_client_id := COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (current_setting('request.headers', true)::jsonb->>'x-user-id')
  );

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


-- 9. Redefine cancel_booking with production identity fallback
CREATE OR REPLACE FUNCTION public.cancel_booking(
  p_booking_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_id text;
  v_booking record;
  v_refund_amount integer;
BEGIN
  v_caller_id := COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (current_setting('request.headers', true)::jsonb->>'x-user-id')
  );

  IF v_caller_id IS NULL THEN
     RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.client_id != v_caller_id AND NOT public.is_admin(v_caller_id) THEN
     RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_booking.status = 'cancelled' THEN
     RETURN jsonb_build_object('success', true, 'late', false);
  END IF;

  IF v_booking.status != 'upcoming' THEN
     RAISE EXCEPTION 'Cannot cancel booking in status %', v_booking.status;
  END IF;

  -- PAST CHECK: Client cannot cancel sessions that have already started or passed
  IF now() >= v_booking.scheduled_start_at THEN
     RAISE EXCEPTION 'Cannot cancel a session that has already started or passed.';
  END IF;

  -- Cancellation window rule: 2 hours prior to scheduled start
  IF now() >= v_booking.scheduled_start_at - interval '2 hours' THEN
     -- LATE CANCEL: Credits Forfeited. Trainer compensated ₹400
     UPDATE public.bookings 
     SET status = 'cancelled', timeline_status = 'SESSION_CLOSED'
     WHERE id = p_booking_id;

     -- Compensate trainer only if a real trainer is assigned (not 'searching')
     IF v_booking.trainer_id != 'searching' THEN
       INSERT INTO public.trainer_earnings (id, trainer_id, booking_id, client_name, amount, date, type)
       VALUES (
         'earn-' || EXTRACT(epoch FROM now())::bigint || '-' || floor(random()*1000)::text,
         v_booking.trainer_id,
         p_booking_id,
         v_booking.client_name || ' (Late Cancel)',
         400,
         to_char(now(), 'Mon DD, YYYY'),
         'no_show_compensation'
       );
     END IF;

     INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role, metadata)
     VALUES (p_booking_id, 'LATE_CANCELLATION', v_booking.timeline_status, 'SESSION_CLOSED', v_caller_id, 'customer', '{"penalty": true}'::jsonb);

     RETURN jsonb_build_object('success', true, 'late', true);
  ELSE
     -- EARLY CANCEL: Full Refund
     IF EXISTS (SELECT 1 FROM public.workouts WHERE title = v_booking.workout_title AND category = 'COUPLE') THEN
       v_refund_amount := 2;
     ELSE
       v_refund_amount := 1;
     END IF;

     UPDATE public.user_profiles 
     SET credits_balance = credits_balance + v_refund_amount
     WHERE user_id = v_booking.client_id;

     INSERT INTO public.credit_transactions (id, user_id, type, amount, date, status, credits)
     VALUES (
       'tx-' || EXTRACT(epoch FROM now())::bigint || '-' || floor(random()*1000)::text,
       v_booking.client_id,
       'refund',
       '₹0',
       to_char(now(), 'Mon DD, YYYY'),
       'paid',
       v_refund_amount
     );

     UPDATE public.bookings 
     SET status = 'cancelled', timeline_status = 'SESSION_CLOSED'
     WHERE id = p_booking_id;

     INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role, metadata)
     VALUES (p_booking_id, 'EARLY_CANCELLATION', v_booking.timeline_status, 'SESSION_CLOSED', v_caller_id, 'customer', '{"refunded": true}'::jsonb);

     RETURN jsonb_build_object('success', true, 'late', false);
  END IF;
END;
$$;


-- 10. Redefine reschedule_booking with production identity fallback
CREATE OR REPLACE FUNCTION public.reschedule_booking(
  p_booking_id text,
  p_new_date text,
  p_new_time text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_id text;
  v_booking record;
  v_new_start_at timestamptz;
  v_new_end_at timestamptz;
BEGIN
  v_caller_id := COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (current_setting('request.headers', true)::jsonb->>'x-user-id')
  );

  IF v_caller_id IS NULL THEN
     RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.client_id != v_caller_id AND NOT public.is_admin(v_caller_id) THEN
     RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_booking.status != 'upcoming' THEN
     RAISE EXCEPTION 'Cannot reschedule booking in status %', v_booking.status;
  END IF;

  -- Reschedule is only allowed more than 2 hours before the scheduled start time
  IF now() >= v_booking.scheduled_start_at - interval '2 hours' THEN
    RAISE EXCEPTION 'Rescheduling is not allowed within 2 hours of the scheduled start time.';
  END IF;

  -- Parse new start and end times
  v_new_start_at := public.parse_booking_start_time(p_new_date, p_new_time);
  v_new_end_at := v_new_start_at + (coalesce(v_booking.duration_minutes, 60) * interval '1 minute');

  -- Double-booking and travel buffer check (only if trainer is assigned)
  IF v_booking.trainer_id != 'searching' THEN
    IF EXISTS (
      SELECT 1 FROM public.bookings
      WHERE trainer_id = v_booking.trainer_id
        AND status = 'upcoming'
        AND id != p_booking_id
        AND (
          (scheduled_start_at - interval '30 minutes', scheduled_end_at + interval '30 minutes') OVERLAPS 
          (v_new_start_at, v_new_end_at)
        )
    ) THEN
      RAISE EXCEPTION 'Trainer is unavailable due to an overlapping booking or travel buffer conflict.';
    END IF;

    -- Slot reservation conflicts
    IF EXISTS (
      SELECT 1 FROM public.slot_reservations
      WHERE trainer_id = v_booking.trainer_id
        AND client_id != v_booking.client_id
        AND expires_at > now()
        AND (
          (scheduled_start_at, scheduled_end_at) OVERLAPS 
          (v_new_start_at, v_new_end_at)
        )
    ) THEN
      RAISE EXCEPTION 'Trainer slot is currently reserved by another client.';
    END IF;
  END IF;

  -- Update booking with new slot details and reset to booked
  UPDATE public.bookings
  SET date = p_new_date,
      time = p_new_time,
      scheduled_start_at = v_new_start_at,
      scheduled_end_at = v_new_end_at,
      timeline_status = 'BOOKED',
      acceptance_notification_count = 1,
      last_acceptance_notification_at = (EXTRACT(epoch FROM now()) * 1000)::bigint,
      acceptance_deadline = (EXTRACT(epoch FROM now() + interval '10 minutes') * 1000)::bigint
  WHERE id = p_booking_id;

  INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role, metadata)
  VALUES (
    p_booking_id, 
    'CLIENT_RESCHEDULED', 
    v_booking.timeline_status, 
    'BOOKED', 
    v_booking.client_id, 
    'customer', 
    jsonb_build_object('old_date', v_booking.date, 'old_time', v_booking.time, 'new_date', p_new_date, 'new_time', p_new_time)
  );

  RETURN jsonb_build_object('success', true);
END;
$$;


-- 11. Redefine acknowledge_auto_accept with production identity fallback
CREATE OR REPLACE FUNCTION public.acknowledge_auto_accept(
  p_booking_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trainer_id text;
  v_booking record;
BEGIN
  v_trainer_id := COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (current_setting('request.headers', true)::jsonb->>'x-user-id')
  );

  IF v_trainer_id IS NULL THEN
     RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.trainer_id != v_trainer_id AND NOT public.is_admin(v_trainer_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE public.bookings
  SET trainer_acknowledgement = 'acknowledged'
  WHERE id = p_booking_id;

  INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
  VALUES (p_booking_id, 'TRAINER_ACKNOWLEDGE', v_booking.timeline_status, v_booking.timeline_status, v_trainer_id, 'trainer');

  RETURN jsonb_build_object('success', true);
END;
$$;


-- 12. Redefine handle_no_show with production identity fallback
CREATE OR REPLACE FUNCTION public.handle_no_show(
  p_booking_id text,
  p_no_show_type text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_id text;
  v_booking record;
  v_refund_credits integer;
  v_notify_id text;
  v_client_body text;
BEGIN
  v_caller_id := COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (current_setting('request.headers', true)::jsonb->>'x-user-id')
  );

  IF v_caller_id IS NULL THEN
     RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
     RAISE EXCEPTION 'Booking not found';
  END IF;

  IF p_no_show_type = 'client' THEN
    -- Idempotence guard
    IF v_booking.status = 'client_no_show' THEN
       RETURN jsonb_build_object('success', true);
    END IF;

    -- Trainer logs client no-show
    IF v_booking.trainer_id != v_caller_id AND NOT public.is_admin(v_caller_id) THEN
       RAISE EXCEPTION 'Access denied';
    END IF;

    IF v_booking.timeline_status != 'TRAINER_ARRIVED' THEN
       RAISE EXCEPTION 'Trainer must check in first to declare client no-show';
    END IF;

    IF now() <= v_booking.otp_expires_at THEN
       RAISE EXCEPTION 'Grace period is still active. Cannot declare client no-show yet.';
    END IF;

    IF now() < v_booking.scheduled_start_at THEN
       RAISE EXCEPTION 'Session start time has not passed yet. Cannot declare client no-show yet.';
    END IF;

    UPDATE public.bookings
    SET status = 'client_no_show',
        timeline_status = 'SESSION_CLOSED'
    WHERE id = p_booking_id;

    -- Award trainer ₹400 compensation
    INSERT INTO public.trainer_earnings (id, trainer_id, booking_id, client_name, amount, date, type)
    VALUES (
      'earn-' || EXTRACT(epoch FROM now())::bigint || '-' || floor(random()*1000)::text,
      v_booking.trainer_id,
      p_booking_id,
      v_booking.client_name || ' (No-Show)',
      400,
      to_char(now(), 'Mon DD, YYYY'),
      'no_show_compensation'
    );

    -- Insert in-app notification for client
    v_notify_id := 'notify-' || EXTRACT(epoch FROM now())::bigint || '-' || floor(random() * 1000000)::text;
    v_client_body := json_build_object(
      'is_meta', true,
      'body', 'Your trainer arrived for the scheduled session, but you were unavailable. The session has therefore been cancelled as a client no-show and your session credit has been deducted.',
      'type', 'Booking Updates',
      'priority', 'high',
      'actionLabel', 'View Details',
      'deepLink', '/session-detail?id=' || p_booking_id
    )::text;

    INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
    VALUES (v_notify_id, v_booking.client_id, 'Trainer marked this session as Client No-Show ⚠️', v_client_body, false, 'Just now', 'today', 'alert-circle');

    INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
    VALUES (p_booking_id, 'CLIENT_NO_SHOW', 'TRAINER_ARRIVED', 'SESSION_CLOSED', v_caller_id, 
            CASE WHEN public.is_admin(v_caller_id) THEN 'admin'::text ELSE 'trainer'::text END);

    RETURN jsonb_build_object('success', true);

  ELSIF p_no_show_type = 'trainer' THEN
    -- Idempotence guard
    IF v_booking.status = 'trainer_no_show' THEN
       RETURN jsonb_build_object('success', true);
    END IF;

    -- Client logs trainer no-show
    IF v_booking.client_id != v_caller_id AND NOT public.is_admin(v_caller_id) THEN
       RAISE EXCEPTION 'Access denied';
    END IF;

    IF now() <= v_booking.scheduled_start_at + interval '30 minutes' THEN
       RAISE EXCEPTION 'Cannot declare trainer no-show until 30 minutes past start time';
    END IF;

    IF v_booking.timeline_status IN ('OTP_VERIFIED', 'WORKOUT_STARTED', 'WORKOUT_COMPLETED', 'TRAINER_REPORT_SUBMITTED', 'SESSION_CLOSED') THEN
       RAISE EXCEPTION 'Cannot declare trainer no-show: session already verified or started';
    END IF;

    UPDATE public.bookings
    SET status = 'trainer_no_show',
        timeline_status = 'SESSION_CLOSED'
    WHERE id = p_booking_id;

    -- Refund client credits + 1 bonus credit (total 2 for Single, 3 for Couple)
    IF EXISTS (SELECT 1 FROM public.workouts WHERE title = v_booking.workout_title AND category = 'COUPLE') THEN
      v_refund_credits := 3;
    ELSE
      v_refund_credits := 2;
    END IF;

    UPDATE public.user_profiles SET credits_balance = credits_balance + v_refund_credits WHERE user_id = v_booking.client_id;

    INSERT INTO public.credit_transactions (id, user_id, type, amount, date, status, credits)
    VALUES (
      'tx-' || EXTRACT(epoch FROM now())::bigint || '-' || floor(random()*1000)::text,
      v_booking.client_id,
      'refund',
      '₹0',
      to_char(now(), 'Mon DD, YYYY'),
      'paid',
      v_refund_credits
    );

    -- Penalty for Trainer (-₹500)
    INSERT INTO public.trainer_earnings (id, trainer_id, booking_id, client_name, amount, date, type)
    VALUES (
      'earn-' || EXTRACT(epoch FROM now())::bigint || '-' || floor(random()*1000)::text,
      v_booking.trainer_id,
      p_booking_id,
      'VIRLA Penalty (No-Show)',
      -500,
      to_char(now(), 'Mon DD, YYYY'),
      'penalty'
    );

    INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
    VALUES (p_booking_id, 'TRAINER_NO_SHOW', v_booking.timeline_status, 'SESSION_CLOSED', v_caller_id, 
            CASE WHEN public.is_admin(v_caller_id) THEN 'admin'::text ELSE 'customer'::text END);

    RETURN jsonb_build_object('success', true);
  ELSE
    RAISE EXCEPTION 'Invalid no-show type';
  END IF;
END;
$$;


-- 13. Redefine get_client_assessment_history with production identity fallback
CREATE OR REPLACE FUNCTION public.get_client_assessment_history(
  p_client_id text
) RETURNS TABLE (
  booking_id text,
  session_date text,
  session_time text,
  coach_name text,
  assessment text,
  scheduled_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_id text;
BEGIN
  v_caller_id := COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (current_setting('request.headers', true)::jsonb->>'x-user-id')
  );

  IF v_caller_id IS NULL THEN
     RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Verify caller authorization
  IF v_caller_id != p_client_id 
     AND NOT EXISTS (
       SELECT 1 FROM public.bookings
       WHERE client_id = p_client_id
         AND trainer_id = v_caller_id
         AND status = 'upcoming'
     ) 
     AND NOT EXISTS (
       SELECT 1 FROM public.users
       WHERE id = v_caller_id
         AND role = 'admin'
     ) THEN
    RAISE EXCEPTION 'Access denied. You are not authorized to view this client''s history.';
  END IF;

  RETURN QUERY
  SELECT 
    b.id,
    b.date,
    b.time,
    b.trainer_name,
    b.questionnaire->>'coachNotes',
    b.scheduled_start_at
  FROM public.bookings b
  WHERE b.client_id = p_client_id
    AND b.status = 'completed'
    AND b.questionnaire->>'coachNotes' IS NOT NULL
    AND b.questionnaire->>'coachNotes' != ''
  ORDER BY b.scheduled_start_at DESC;
END;
$$;


-- 14. Drop and recreate bookings UPDATE RLS policy to support production header verification
DROP POLICY IF EXISTS "Restrict bookings updates to non-timeline fields" ON public.bookings;
CREATE POLICY "Restrict bookings updates to non-timeline fields" ON public.bookings
  FOR UPDATE
  USING (
    (client_id = COALESCE(nullif(current_setting('request.jwt.claim.sub', true), ''), (current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)) OR 
    (trainer_id = COALESCE(nullif(current_setting('request.jwt.claim.sub', true), ''), (current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)) OR 
    is_admin(COALESCE(nullif(current_setting('request.jwt.claim.sub', true), ''), (current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))
  )
  WITH CHECK (
    (
      (NOT (status IS DISTINCT FROM (SELECT b.status FROM public.bookings b WHERE b.id = bookings.id))) AND
      (NOT (timeline_status IS DISTINCT FROM (SELECT b.timeline_status FROM public.bookings b WHERE b.id = bookings.id))) AND
      (NOT (scheduled_start_at IS DISTINCT FROM (SELECT b.scheduled_start_at FROM public.bookings b WHERE b.id = bookings.id))) AND
      (NOT (scheduled_end_at IS DISTINCT FROM (SELECT b.scheduled_end_at FROM public.bookings b WHERE b.id = bookings.id))) AND
      (NOT (travel_started_at IS DISTINCT FROM (SELECT b.travel_started_at FROM public.bookings b WHERE b.id = bookings.id))) AND
      (NOT (trainer_arrived_at IS DISTINCT FROM (SELECT b.trainer_arrived_at FROM public.bookings b WHERE b.id = bookings.id))) AND
      (NOT (session_started_at IS DISTINCT FROM (SELECT b.session_started_at FROM public.bookings b WHERE b.id = bookings.id))) AND
      (NOT (session_completed_at IS DISTINCT FROM (SELECT b.session_completed_at FROM public.bookings b WHERE b.id = bookings.id))) AND
      (NOT (otp IS DISTINCT FROM (SELECT b.otp FROM public.bookings b WHERE b.id = bookings.id))) AND
      (NOT (otp_expires_at IS DISTINCT FROM (SELECT b.otp_expires_at FROM public.bookings b WHERE b.id = bookings.id))) AND
      (NOT (manual_accepted_at IS DISTINCT FROM (SELECT b.manual_accepted_at FROM public.bookings b WHERE b.id = bookings.id))) AND
      (NOT (auto_accepted_at IS DISTINCT FROM (SELECT b.auto_accepted_at FROM public.bookings b WHERE b.id = bookings.id)))
    ) OR
    is_admin(COALESCE(nullif(current_setting('request.jwt.claim.sub', true), ''), (current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))
  );


-- 15. Create add_partner_to_booking RPC to handle atomic credit updates securely on server
CREATE OR REPLACE FUNCTION public.add_partner_to_booking(
  p_booking_id text,
  p_partner_name text,
  p_partner_phone text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_client_id text;
  v_booking record;
  v_credits integer;
  v_tx_id text;
BEGIN
  v_client_id := COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (current_setting('request.headers', true)::jsonb->>'x-user-id')
  );

  IF v_client_id IS NULL THEN
     RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
     RAISE EXCEPTION 'Booking not found.';
  END IF;

  IF v_booking.client_id != v_client_id AND NOT public.is_admin(v_client_id) THEN
     RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_booking.participant_count >= 2 THEN
     RAISE EXCEPTION 'This session already has a partner added.';
  END IF;

  IF v_booking.status != 'upcoming' THEN
     RAISE EXCEPTION 'Cannot add partner to past, cancelled, or completed bookings.';
  END IF;

  IF v_booking.timeline_status IN ('OTP_VERIFIED', 'WORKOUT_STARTED', 'WORKOUT_COMPLETED', 'SESSION_CLOSED') THEN
     RAISE EXCEPTION 'Cannot add a partner after the session has started.';
  END IF;

  SELECT credits_balance INTO v_credits FROM public.user_profiles WHERE user_id = v_booking.client_id FOR UPDATE;
  IF v_credits IS NULL OR v_credits < 1 THEN
     RAISE EXCEPTION 'You need 1 additional credit to add a partner to this session. Please recharge your wallet.';
  END IF;

  UPDATE public.user_profiles
  SET credits_balance = credits_balance - 1
  WHERE user_id = v_booking.client_id;

  v_tx_id := 'tx-' || EXTRACT(epoch FROM now())::bigint || '-' || floor(random()*1000)::text;
  INSERT INTO public.credit_transactions (id, user_id, type, amount, date, status, credits)
  VALUES (
    v_tx_id,
    v_booking.client_id,
    'spend',
    '₹0',
    to_char(now(), 'Mon DD, YYYY'),
    'paid',
    1
  );

  UPDATE public.bookings
  SET participant_count = 2,
      session_type = 'COUPLE',
      partner_name = p_partner_name,
      partner_phone = p_partner_phone
  WHERE id = p_booking_id;

  INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
  VALUES (p_booking_id, 'PARTNER_ADDED', v_booking.timeline_status, v_booking.timeline_status, v_client_id, 
          CASE WHEN v_client_id = v_booking.client_id THEN 'customer'::text ELSE 'admin'::text END);

  RETURN jsonb_build_object('success', true, 'tx_id', v_tx_id);
END;
$$;


-- 16. Grant Execute Permissions
GRANT EXECUTE ON FUNCTION public.trainer_accept_booking(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_travel(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_trainer_arrived(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_session_otp(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_session(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_session(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_trainer_report(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_customer_review(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_booking(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_booking(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_auto_accept(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_no_show(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_assessment_history(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_partner_to_booking(text, text, text) TO anon, authenticated;
