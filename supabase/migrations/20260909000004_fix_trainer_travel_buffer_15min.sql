-- Migration: Update Trainer Operational Travel Buffer from 30 minutes to 15 minutes
-- Created At: 2026-09-09

-- 1. Update create_booking RPC to use 15-minute travel buffer for overlap validation
CREATE OR REPLACE FUNCTION public.create_booking(
  p_booking_id text,
  p_workout_id text,
  p_scheduled_start_at timestamptz,
  p_scheduled_end_at timestamptz,
  p_assigned_trainer_id text,
  p_trainer_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_client_id text;
  v_session_type text;
  v_credit_cost integer;
  v_current_credits integer;
  v_workout_title text;
  v_workout_price integer;
  v_trainer_name text;
  v_client_name text;
  v_client_phone text;
BEGIN
  -- Authentication Check: resolve client ID from JWT claim sub, auth.uid(), or x-user-id header
  v_client_id := COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(auth.uid()::text, ''),
    (current_setting('request.headers', true)::jsonb->>'x-user-id')
  );

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Verify caller role is not trainer (enforce trainer self-booking restriction)
  IF EXISTS (SELECT 1 FROM public.users WHERE id = v_client_id AND role = 'trainer') THEN
    RAISE EXCEPTION 'Trainer accounts cannot use credits to book sessions for themselves.';
  END IF;

  -- Verify caller role is customer or admin
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_client_id AND role IN ('customer', 'admin')) THEN
    RAISE EXCEPTION 'Only customers and admins can create bookings.';
  END IF;

  -- Slot Double booking & Buffer check (15 minutes operational travel buffer before/after)
  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE trainer_id = p_assigned_trainer_id
      AND status = 'upcoming'
      AND (
        (scheduled_start_at - interval '15 minutes', scheduled_end_at + interval '15 minutes') OVERLAPS 
        (p_scheduled_start_at, p_scheduled_end_at)
      )
  ) THEN
    RAISE EXCEPTION 'Trainer is unavailable due to an overlapping booking or travel buffer conflict.';
  END IF;

  -- Slot reservation conflicts
  IF EXISTS (
    SELECT 1 FROM public.slot_reservations
    WHERE trainer_id = p_assigned_trainer_id
      AND client_id != v_client_id
      AND expires_at > now()
      AND (
        (scheduled_start_at, scheduled_end_at) OVERLAPS 
        (p_scheduled_start_at, p_scheduled_end_at)
      )
  ) THEN
    RAISE EXCEPTION 'Trainer slot is currently reserved by another client.';
  END IF;

  -- Determine Workout Type & Credit Cost
  SELECT category, title, session_price INTO v_session_type, v_workout_title, v_workout_price 
  FROM public.workouts WHERE id = p_workout_id;
  
  IF v_workout_title IS NULL THEN
    RAISE EXCEPTION 'Workout not found: %', p_workout_id;
  END IF;

  IF v_session_type = 'COUPLE' THEN
    v_credit_cost := 2;
  ELSE
    v_credit_cost := 1;
  END IF;

  -- Lock user profile row for update to prevent negative balance race condition
  SELECT credits_balance INTO v_current_credits
  FROM public.user_profiles
  WHERE user_id = v_client_id
  FOR UPDATE;

  SELECT name, phone INTO v_client_name, v_client_phone
  FROM public.users
  WHERE id = v_client_id;

  IF v_current_credits < v_credit_cost THEN
    RAISE EXCEPTION 'Insufficient credits balance. Required: %, Available: %', v_credit_cost, v_current_credits;
  END IF;

  SELECT name INTO v_trainer_name FROM public.trainers WHERE id = p_assigned_trainer_id;

  -- Perform atomic mutations
  UPDATE public.user_profiles 
  SET credits_balance = credits_balance - v_credit_cost 
  WHERE user_id = v_client_id;

  -- Insert ledger transaction
  INSERT INTO public.credit_transactions (id, user_id, type, amount, date, status, credits)
  VALUES (
    'tx-' || EXTRACT(epoch FROM now())::bigint || '-' || floor(random()*1000)::text,
    v_client_id,
    'spend',
    '₹0',
    to_char(now(), 'Mon DD, YYYY'),
    'paid',
    v_credit_cost
  );

  -- Insert new booking authoritatively
  INSERT INTO public.bookings (
    id, status, timeline_status, otp, client_name, client_phone, trainer_name,
    scheduled_start_at, scheduled_end_at, date, time, workout_title, price, client_id, trainer_id,
    request_created_at, acceptance_notification_count, last_acceptance_notification_at, acceptance_deadline,
    trainer_note
  ) VALUES (
    p_booking_id,
    'upcoming',
    'BOOKED',
    to_char(floor(1000 + random() * 9000), 'FM9999'),
    v_client_name,
    v_client_phone,
    v_trainer_name,
    p_scheduled_start_at,
    p_scheduled_end_at,
    to_char(p_scheduled_start_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD'),
    to_char(p_scheduled_start_at AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM') || ' - ' || to_char(p_scheduled_end_at AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM'),
    v_workout_title,
    v_workout_price,
    v_client_id,
    p_assigned_trainer_id,
    now(),
    0,
    NULL,
    (EXTRACT(epoch FROM (now() + interval '30 minutes')) * 1000)::bigint,
    p_trainer_note
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'workout_title', v_workout_title,
    'trainer_name', v_trainer_name
  );
END;
$$;

-- 2. Update handle_trainer_decline_or_timeout RPC to use 15-minute travel buffer
CREATE OR REPLACE FUNCTION public.handle_trainer_decline_or_timeout(
  p_booking_id text,
  p_action text DEFAULT 'timeout'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_booking record;
  v_coach record;
  v_now_ms bigint;
  v_caller_id text;
BEGIN
  v_caller_id := auth.uid()::text;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- Enforce authorization: Only allow currently assigned trainer, admin, or system/cron (caller is null)
  IF v_caller_id IS NOT NULL THEN
    IF v_booking.trainer_id != v_caller_id AND NOT public.is_admin(v_caller_id) THEN
      RAISE EXCEPTION 'Access denied. You are not authorized to trigger reassignment.';
    END IF;
  END IF;

  -- Reassignment is only allowed for pending (BOOKED or TRAINER_ASSIGNED) bookings
  IF v_booking.timeline_status IS DISTINCT FROM 'BOOKED' AND v_booking.timeline_status IS DISTINCT FROM 'TRAINER_ASSIGNED' THEN
    RETURN jsonb_build_object(
      'success', true, 
      'reassigned', false, 
      'message', 'Booking has already been accepted or progressed beyond reassignment.'
    );
  END IF;

  -- Select next best available trainer who matches parameters and has no slot overlaps (15 min travel buffer)
  SELECT t.id, t.name, t.photo, t.level, t.rating, t.completed_sessions, t.specialty, t.languages, t.price
  INTO v_coach
  FROM public.trainers t
  JOIN public.users u ON u.id = t.id
  WHERE u.role = 'trainer' AND u.status = 'active'
    AND t.id != v_booking.trainer_id
    AND NOT EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.trainer_id = t.id
        AND b.status = 'upcoming'
        AND (
          (b.scheduled_start_at - interval '15 minutes', b.scheduled_end_at + interval '15 minutes') OVERLAPS 
          (v_booking.scheduled_start_at, v_booking.scheduled_end_at)
        )
    )
  ORDER BY t.rating DESC, t.completed_sessions DESC
  LIMIT 1;

  v_now_ms := (EXTRACT(epoch FROM now()) * 1000)::bigint;

  IF v_coach.id IS NOT NULL THEN
    INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role, metadata)
    VALUES (
      p_booking_id, 
      'TRAINER_DECLINED_OR_TIMEOUT', 
      v_booking.timeline_status, 
      v_booking.timeline_status, 
      v_booking.trainer_id, 
      'trainer', 
      jsonb_build_object('action', p_action)
    );

    UPDATE public.bookings
    SET
      trainer_id = v_coach.id,
      trainer_name = v_coach.name,
      trainer_photo = v_coach.photo,
      trainer_level = v_coach.level,
      trainer_rating = v_coach.rating,
      trainer_completed_sessions = v_coach.completed_sessions,
      trainer_speciality = v_coach.specialty,
      trainer_languages = v_coach.languages,
      price = coalesce(v_coach.price, 1200),
      timeline_status = 'TRAINER_ASSIGNED',
      acceptance_notification_count = 1,
      last_acceptance_notification_at = v_now_ms,
      acceptance_deadline = v_now_ms + 10 * 60 * 1000
    WHERE id = p_booking_id;

    INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
    VALUES (p_booking_id, 'TRAINER_REASSIGNED', v_booking.timeline_status, 'TRAINER_ASSIGNED', 'system', 'system');

    RETURN jsonb_build_object('success', true, 'reassigned', true, 'trainer_id', v_coach.id);
  ELSE
    UPDATE public.bookings
    SET
      trainer_id = 'searching',
      trainer_name = 'No Trainer Available',
      timeline_status = 'BOOKED',
      acceptance_notification_count = 1,
      last_acceptance_notification_at = v_now_ms,
      acceptance_deadline = v_now_ms + 10 * 60 * 1000
    WHERE id = p_booking_id;

    INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
    VALUES (p_booking_id, 'TRAINER_POOL_EXHAUSTED', v_booking.timeline_status, 'BOOKED', 'system', 'system');

    RETURN jsonb_build_object('success', true, 'reassigned', false, 'trainer_id', 'searching');
  END IF;
END;
$$;
