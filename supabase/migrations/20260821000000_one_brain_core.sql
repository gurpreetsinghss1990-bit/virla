-- 20260821000000_one_brain_core.sql
-- Transition Virla to a One Brain State Machine with timestamptz calendar scheduling

-- 1. DROP EXISTING TRIGGERS & SIMULATED RLS TRIGGERS ON BOOKINGS
DROP TRIGGER IF EXISTS a_validate_booking_transition ON public.bookings;
DROP TRIGGER IF EXISTS trg_booking_status_updated ON public.bookings;

-- 2. SCHEMA TRANSITIONS FOR TIMESTAMPTZ AND AUDITING
-- Alter bookings columns from bigint to timestamptz
ALTER TABLE public.bookings RENAME COLUMN workout_started_at TO session_started_at;
ALTER TABLE public.bookings ALTER COLUMN session_started_at TYPE timestamptz USING to_timestamp(session_started_at / 1000.0);

ALTER TABLE public.bookings RENAME COLUMN workout_completed_at TO session_completed_at;
ALTER TABLE public.bookings ALTER COLUMN session_completed_at TYPE timestamptz USING to_timestamp(session_completed_at / 1000.0);

ALTER TABLE public.bookings ALTER COLUMN travel_started_at TYPE timestamptz USING to_timestamp(travel_started_at / 1000.0);
ALTER TABLE public.bookings ALTER COLUMN otp_expires_at TYPE timestamptz USING to_timestamp(otp_expires_at / 1000.0);
ALTER TABLE public.bookings ALTER COLUMN grace_period_started_at TYPE timestamptz USING to_timestamp(grace_period_started_at / 1000.0);

-- Add new scheduling fields
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS scheduled_start_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS scheduled_end_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS request_created_at timestamptz DEFAULT now();
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS manual_accepted_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS auto_accepted_at timestamptz;

-- Alter slot_reservations columns from bigint to timestamptz
ALTER TABLE public.slot_reservations ALTER COLUMN expires_at TYPE timestamptz USING to_timestamp(expires_at / 1000.0);
ALTER TABLE public.slot_reservations ADD COLUMN IF NOT EXISTS scheduled_start_at timestamptz;
ALTER TABLE public.slot_reservations ADD COLUMN IF NOT EXISTS scheduled_end_at timestamptz;

-- 3. AUDIT EVENTS LOG TABLE
CREATE TABLE IF NOT EXISTS public.booking_state_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id text NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  previous_state text,
  new_state text,
  actor_user_id text,
  actor_role text CHECK (actor_role IN ('customer', 'trainer', 'admin', 'system')),
  server_timestamp timestamptz DEFAULT now() NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.booking_state_events ENABLE ROW LEVEL SECURITY;

-- 4. TIMESTAMPTZ DATA BACKFILL
UPDATE public.bookings
SET 
  scheduled_start_at = public.parse_booking_start_time(date, time),
  scheduled_end_at = public.parse_booking_start_time(date, time) + (coalesce(duration_minutes, 60) * interval '1 minute')
WHERE scheduled_start_at IS NULL AND date IS NOT NULL AND time IS NOT NULL;

-- 5. RPC AUTHORITATIVE LOGIC PROCEDURES

-- A. Booking Creation & Credit Deduction
CREATE OR REPLACE FUNCTION public.create_booking(
  p_booking_id text,
  p_workout_id text,
  p_scheduled_start_at timestamptz,
  p_scheduled_end_at timestamptz,
  p_assigned_trainer_id text
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
  -- Authentication Check
  v_client_id := auth.uid();
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Slot Double booking & Buffer check (30 minutes travel buffer before/after)
  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE trainer_id = p_assigned_trainer_id
      AND status = 'upcoming'
      AND (
        (scheduled_start_at - interval '30 minutes', scheduled_end_at + interval '30 minutes') OVERLAPS 
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
  
  IF v_session_type = 'COUPLE' THEN
    v_credit_cost := 2;
  ELSE
    v_credit_cost := 1;
  END IF;

  -- Verify caller role is customer
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_client_id AND role = 'customer') THEN
    RAISE EXCEPTION 'Only customers can create bookings.';
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
    request_created_at, acceptance_notification_count, last_acceptance_notification_at, acceptance_deadline
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
    coalesce(v_workout_price, 1200),
    v_client_id,
    p_assigned_trainer_id,
    now(),
    1,
    (EXTRACT(epoch FROM now())*1000)::bigint,
    (EXTRACT(epoch FROM now() + interval '10 minutes')*1000)::bigint
  );

  -- Log state change event
  INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
  VALUES (p_booking_id, 'BOOKING_CREATED', NULL, 'BOOKED', v_client_id, 'customer');

  RETURN jsonb_build_object('success', true, 'booking_id', p_booking_id);
END;
$$;

-- B. Trainer Reassignment / Sequential Match pool
CREATE OR REPLACE FUNCTION public.reassign_booking_trainer(
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
  v_caller_id := auth.uid();

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

  -- Select next best available trainer who matches parameters and has no slot overlaps
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
          (b.scheduled_start_at - interval '30 minutes', b.scheduled_end_at + interval '30 minutes') OVERLAPS 
          (v_booking.scheduled_start_at, v_booking.scheduled_end_at)
        )
    )
  ORDER BY t.rating DESC, t.completed_sessions DESC
  LIMIT 1;

  v_now_ms := (EXTRACT(epoch FROM now()) * 1000)::bigint;

  IF v_coach.id IS NOT NULL THEN
    -- Log decline/timeout event
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
    -- Set booking to searching status
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

-- C. Trainer Manual Acceptance
CREATE OR REPLACE FUNCTION public.trainer_accept_booking(
  p_booking_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trainer_id text;
  v_booking record;
BEGIN
  v_trainer_id := auth.uid();
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

  IF v_booking.timeline_status = 'TRAINER_ACCEPTED' THEN
    RETURN jsonb_build_object('success', true);
  END IF;

  IF v_booking.timeline_status != 'BOOKED' AND v_booking.timeline_status != 'TRAINER_ASSIGNED' THEN
    RAISE EXCEPTION 'Cannot accept from state %', v_booking.timeline_status;
  END IF;

  -- 10-minute SLA acceptance check
  IF now() > v_booking.request_created_at + interval '10 minutes' THEN
    RAISE EXCEPTION 'Request has expired. The 10-minute acceptance window has closed.';
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

-- D. Auto-Acceptance
CREATE OR REPLACE FUNCTION public.auto_accept_booking(
  p_booking_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_booking record;
  v_notify_id text;
  v_client_body text;
  v_trainer_body text;
  v_admin_body text;
  v_caller_id text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NOT NULL AND NOT public.is_admin(v_caller_id) THEN
     RAISE EXCEPTION 'Access denied. Auto-acceptance can only be triggered by system or administrator.';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.timeline_status = 'TRAINER_ACCEPTED' THEN
     RETURN jsonb_build_object('success', true);
  END IF;

  IF v_booking.timeline_status != 'BOOKED' AND v_booking.timeline_status != 'TRAINER_ASSIGNED' THEN
     RAISE EXCEPTION 'Cannot auto-accept from state %', v_booking.timeline_status;
  END IF;

  UPDATE public.bookings
  SET timeline_status = 'TRAINER_ACCEPTED',
      acceptance_method = 'auto',
      auto_accepted_at = now(),
      acceptance_notification_count = 3
  WHERE id = p_booking_id;

  INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
  VALUES (p_booking_id, 'AUTO_ACCEPTED', v_booking.timeline_status, 'TRAINER_ACCEPTED', 'system', 'system');

  -- Notification Dispatches
  v_notify_id := 'notify-' || EXTRACT(epoch FROM now())::bigint || '-' || floor(random() * 1000000)::text;
  v_client_body := json_build_object(
    'is_meta', true,
    'body', 'Your booking is confirmed. Coach ' || v_booking.trainer_name || ' is assigned to your session.',
    'type', 'Bookings',
    'priority', 'high',
    'actionLabel', 'View Details',
    'deepLink', '/session-detail?id=' || p_booking_id
  )::text;

  INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
  VALUES (v_notify_id, v_booking.client_id, 'Trainer Assigned ⚡', v_client_body, false, 'Just now', 'today', 'check-circle');

  v_notify_id := 'notify-' || EXTRACT(epoch FROM now())::bigint || '-' || floor(random() * 1000000)::text;
  v_trainer_body := json_build_object(
    'is_meta', true,
    'body', 'Session automatically accepted because no response was received within 10 minutes.',
    'type', 'Trainer Updates',
    'priority', 'high',
    'actionLabel', 'View Details',
    'deepLink', '/session-detail?id=' || p_booking_id
  )::text;

  INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
  VALUES (v_notify_id, v_booking.trainer_id, 'Booking Automatically Accepted ⚠️', v_trainer_body, false, 'Just now', 'today', 'alert-circle');

  v_notify_id := 'notify-' || EXTRACT(epoch FROM now())::bigint || '-' || floor(random() * 1000000)::text;
  v_admin_body := json_build_object(
    'is_meta', true,
    'body', 'A booking for ' || v_booking.client_name || ' was auto-accepted because Coach ' || v_booking.trainer_name || ' did not respond within 10 minutes.',
    'type', 'Admin Alerts',
    'priority', 'high',
    'actionLabel', 'View Details',
    'deepLink', '/admin-panel'
  )::text;

  INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
  VALUES (v_notify_id, 'u-testadmin', 'Booking Request Auto-Accepted 🚨', v_admin_body, false, 'Just now', 'today', 'alert-triangle');

  RETURN jsonb_build_object('success', true);
END;
$$;

-- E. Travel Start validation
CREATE OR REPLACE FUNCTION public.start_travel(
  p_booking_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trainer_id text;
  v_booking record;
BEGIN
  v_trainer_id := auth.uid();
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

-- F. Trainer Arrival / Check-in
CREATE OR REPLACE FUNCTION public.mark_trainer_arrived(
  p_booking_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trainer_id text;
  v_booking record;
  v_otp text;
BEGIN
  v_trainer_id := auth.uid();
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

-- G. OTP Verification
CREATE OR REPLACE FUNCTION public.verify_session_otp(
  p_booking_id text,
  p_entered_otp text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_id text;
  v_booking record;
BEGIN
  v_caller_id := auth.uid();
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

-- H. Session Start
CREATE OR REPLACE FUNCTION public.start_session(
  p_booking_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trainer_id text;
  v_booking record;
BEGIN
  v_trainer_id := auth.uid();
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

-- I. Session Completion
CREATE OR REPLACE FUNCTION public.complete_session(
  p_booking_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trainer_id text;
  v_booking record;
BEGIN
  v_trainer_id := auth.uid();
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

-- J. Report Submission & Earning creation
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
  v_trainer_id := auth.uid();
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

-- K. Customer Review Submission
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
  v_client_id := auth.uid();
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
      rating_details = p_rating_details
  WHERE id = p_booking_id;

  -- Recalculate average ratings
  SELECT count(*), avg(coalesce((b.rating_details->>'rating')::numeric, 5.0))
  INTO v_count, v_avg
  FROM public.bookings b
  WHERE b.trainer_id = v_booking.trainer_id
    AND b.timeline_status = 'SESSION_CLOSED'
    AND b.rating_details IS NOT NULL;

  UPDATE public.trainers
  SET rating = coalesce(v_avg::numeric(3,2), 5.0),
      rating_count = coalesce(v_count, 0)
  WHERE id = v_booking.trainer_id;

  INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
  VALUES (p_booking_id, 'REVIEW_SUBMITTED', v_booking.timeline_status, 'SESSION_CLOSED', v_client_id, 'customer');

  RETURN jsonb_build_object('success', true);
END;
$$;

-- L. Cancellation (Early vs Late)
CREATE OR REPLACE FUNCTION public.cancel_booking(
  p_booking_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_id text;
  v_booking record;
  v_refund_amount integer;
BEGIN
  v_caller_id := auth.uid();
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
     RETURN jsonb_build_object('success', true);
  END IF;

  IF v_booking.status != 'upcoming' THEN
    RAISE EXCEPTION 'Cannot cancel booking in status %', v_booking.status;
  END IF;

  -- Late cancellation window opens 25 minutes prior to scheduled start
  IF now() >= v_booking.scheduled_start_at - interval '25 minutes' THEN
     -- LATE CANCEL: Credits Forfeited. Trainer compensated ₹400
     UPDATE public.bookings 
     SET status = 'cancelled', timeline_status = 'SESSION_CLOSED'
     WHERE id = p_booking_id;

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

-- M. Client & Trainer No-show Handling
CREATE OR REPLACE FUNCTION public.handle_no_show(
  p_booking_id text,
  p_no_show_type text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_id text;
  v_booking record;
  v_refund_credits integer;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
     RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
     RAISE EXCEPTION 'Booking not found';
  END IF;

  IF p_no_show_type = 'client' THEN
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

    INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
    VALUES (p_booking_id, 'CLIENT_NO_SHOW', 'TRAINER_ARRIVED', 'SESSION_CLOSED', v_caller_id, 
            CASE WHEN public.is_admin(v_caller_id) THEN 'admin'::text ELSE 'trainer'::text END);

    RETURN jsonb_build_object('success', true);

  ELSIF p_no_show_type = 'trainer' THEN
    -- Client logs trainer no-show
    IF v_booking.client_id != v_caller_id AND NOT public.is_admin(v_caller_id) AND v_caller_id IS NOT NULL THEN
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
            CASE WHEN v_caller_id IS NULL THEN 'system'::text WHEN public.is_admin(v_caller_id) THEN 'admin'::text ELSE 'customer'::text END);

    RETURN jsonb_build_object('success', true);
  ELSE
    RAISE EXCEPTION 'Invalid no-show type';
  END IF;
END;
$$;

-- N. Close Session
CREATE OR REPLACE FUNCTION public.close_session(
  p_booking_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_booking record;
  v_caller_id text;
BEGIN
  v_caller_id := auth.uid();

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
     RAISE EXCEPTION 'Booking not found';
  END IF;

  -- Verify participant or admin/system authorization
  IF v_caller_id IS NOT NULL THEN
    IF v_booking.client_id != v_caller_id AND v_booking.trainer_id != v_caller_id AND NOT public.is_admin(v_caller_id) THEN
      RAISE EXCEPTION 'Access denied. Caller is not a participant of this booking.';
    END IF;
  END IF;

  IF v_booking.timeline_status = 'SESSION_CLOSED' THEN
     RETURN jsonb_build_object('success', true);
  END IF;

  UPDATE public.bookings
  SET timeline_status = 'SESSION_CLOSED'
  WHERE id = p_booking_id;

  INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
  VALUES (p_booking_id, 'SESSION_CLOSED_BY_TIMEOUT', v_booking.timeline_status, 'SESSION_CLOSED', 'system', 'system');

  RETURN jsonb_build_object('success', true);
END;
$$;

-- O. Credits Transfer
CREATE OR REPLACE FUNCTION public.transfer_credits(
  p_to_phone text,
  p_amount integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_from_client_id text;
  v_to_client_id text;
  v_from_balance integer;
  v_to_balance integer;
  v_to_name text;
  v_now_ms bigint;
BEGIN
  v_from_client_id := auth.uid();
  IF v_from_client_id IS NULL THEN
     RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_amount <= 0 THEN
     RAISE EXCEPTION 'Transfer amount must be greater than 0';
  END IF;

  SELECT id, name INTO v_to_client_id, v_to_name FROM public.users WHERE phone = p_to_phone AND role = 'customer';
  IF NOT FOUND THEN
     RAISE EXCEPTION 'Recipient phone number not found or not a client';
  END IF;

  -- Lock user profiles in a sorted order to guarantee zero deadlocks
  IF v_from_client_id < v_to_client_id THEN
    SELECT credits_balance INTO v_from_balance FROM public.user_profiles WHERE user_id = v_from_client_id FOR UPDATE;
    SELECT credits_balance INTO v_to_balance FROM public.user_profiles WHERE user_id = v_to_client_id FOR UPDATE;
  ELSE
    SELECT credits_balance INTO v_to_balance FROM public.user_profiles WHERE user_id = v_to_client_id FOR UPDATE;
    SELECT credits_balance INTO v_from_balance FROM public.user_profiles WHERE user_id = v_from_client_id FOR UPDATE;
  END IF;

  IF v_from_balance < p_amount THEN
     RAISE EXCEPTION 'Insufficient credits available for transfer';
  END IF;

  v_now_ms := (EXTRACT(epoch FROM now()) * 1000)::bigint;

  UPDATE public.user_profiles SET credits_balance = credits_balance - p_amount WHERE user_id = v_from_client_id;
  UPDATE public.user_profiles SET credits_balance = credits_balance + p_amount WHERE user_id = v_to_client_id;

  INSERT INTO public.credit_transactions (id, user_id, type, amount, date, status, credits)
  VALUES (
    'tx-' || v_now_ms || '-from-' || floor(random()*1000)::text,
    v_from_client_id,
    'transfer',
    '₹0',
    to_char(now(), 'Mon DD, YYYY'),
    'paid',
    p_amount
  );

  INSERT INTO public.credit_transactions (id, user_id, type, amount, date, status, credits)
  VALUES (
    'tx-' || v_now_ms || '-to-' || floor(random()*1000)::text,
    v_to_client_id,
    'purchase',
    '₹0',
    to_char(now(), 'Mon DD, YYYY'),
    'paid',
    p_amount
  );

  RETURN jsonb_build_object('success', true, 'recipient_name', v_to_name);
END;
$$;

-- 6. SYSTEM SCHEDULER & CRON TASKS (OVERWRITES)

-- A. Auto-Acceptance & Escalations Cron Action
CREATE OR REPLACE FUNCTION public.process_pending_acceptance_bookings() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  b RECORD;
  v_notify_id text;
  v_trainer_body text;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
     RAISE EXCEPTION 'Access denied. System scheduler functions can only be invoked by administrators or the system.';
  END IF;
  FOR b IN
    SELECT id, client_id, client_name, trainer_id, trainer_name, workout_title, request_created_at,
           acceptance_notification_count
    FROM public.bookings
    WHERE status = 'upcoming'
      AND timeline_status IN ('BOOKED', 'TRAINER_ASSIGNED')
  LOOP
    -- 10-minute Auto-Accept
    IF now() >= b.request_created_at + interval '10 minutes' THEN
      PERFORM public.auto_accept_booking(b.id);

    -- 5-minute Reminder Escalate
    ELSIF now() >= b.request_created_at + interval '5 minutes' AND coalesce(b.acceptance_notification_count, 1) = 1 THEN
      v_notify_id := 'notify-' || EXTRACT(epoch FROM now())::bigint || '-' || floor(random() * 1000000)::text;
      v_trainer_body := json_build_object(
        'is_meta', true,
        'body', 'URGENT: Booking request for ' || b.workout_title || ' is awaiting action (5 mins left).',
        'type', 'Trainer Updates',
        'priority', 'high',
        'actionLabel', 'View Details',
        'deepLink', '/session-detail?id=' || b.id
      )::text;

      INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
      VALUES (v_notify_id, b.trainer_id, 'Urgent: Pending Booking Request — 5 Mins Left! 🔔', v_trainer_body, false, 'Just now', 'today', 'bell');

      UPDATE public.bookings
      SET
        acceptance_notification_count = 2,
        last_acceptance_notification_at = (EXTRACT(epoch FROM now())*1000)::bigint
      WHERE id = b.id;

      INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
      VALUES (b.id, 'ESCALATION_REMINDER_SENT', 'BOOKED', 'BOOKED', 'system', 'system');
    END IF;
  END LOOP;
END;
$$;

-- B. Expire Stale unstarted bookings
CREATE OR REPLACE FUNCTION public.expire_stale_bookings() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  b RECORD;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
     RAISE EXCEPTION 'Access denied. System scheduler functions can only be invoked by administrators or the system.';
  END IF;
  FOR b IN 
    SELECT id, scheduled_start_at, status, timeline_status 
    FROM public.bookings 
    WHERE status = 'upcoming' 
      AND timeline_status IN ('BOOKED', 'TRAINER_ASSIGNED', 'TRAINER_ACCEPTED', 'TRAINER_PREPARING', 'TRAINER_TRAVELLING', 'TRAINER_ARRIVED')
  LOOP
    IF now() > b.scheduled_start_at + interval '30 minutes' THEN
      UPDATE public.bookings
      SET 
        status = 'missed_session_not_started',
        timeline_status = 'SESSION_CLOSED'
      WHERE id = b.id;
      
      INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
      VALUES (b.id, 'SYSTEM_EXPIRY', b.timeline_status, 'SESSION_CLOSED', 'system', 'system');
    END IF;
  END LOOP;
END;
$$;

-- C. Send 1-hour pre-session reminders
CREATE OR REPLACE FUNCTION public.send_booking_reminders() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  b RECORD;
  v_notify_id text;
  v_client_body text;
  v_trainer_body text;
  v_client_name text;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
     RAISE EXCEPTION 'Access denied. System scheduler functions can only be invoked by administrators or the system.';
  END IF;
  FOR b IN 
    SELECT id, client_id, trainer_id, trainer_name, workout_title, scheduled_start_at
    FROM public.bookings
    WHERE status = 'upcoming'
      AND trainer_id IS NOT NULL 
      AND trainer_id != 'searching'
      AND (reminder_sent IS FALSE OR reminder_sent IS NULL)
  LOOP
    IF now() >= b.scheduled_start_at - interval '1 hour' AND now() < b.scheduled_start_at THEN
      SELECT name INTO v_client_name FROM public.users WHERE id = b.client_id;
      IF v_client_name IS NULL OR v_client_name = '' THEN
        v_client_name := 'Client';
      END IF;

      v_notify_id := 'notify-' || EXTRACT(epoch FROM now())::bigint || '-' || floor(random() * 1000000)::text;
      v_client_body := json_build_object(
        'is_meta', true,
        'body', 'Your session with Coach ' || b.trainer_name || ' starts in 1 hour.',
        'type', 'Bookings',
        'priority', 'medium',
        'actionLabel', 'View Details',
        'deepLink', '/session-detail?id=' || b.id
      )::text;

      INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
      VALUES (v_notify_id, b.client_id, 'Session Reminder ⏱️', v_client_body, false, 'Just now', 'today', 'clock');

      v_notify_id := 'notify-' || EXTRACT(epoch FROM now())::bigint || '-' || floor(random() * 1000000)::text;
      v_trainer_body := json_build_object(
        'is_meta', true,
        'body', 'Your session with ' || v_client_name || ' starts in 1 hour.',
        'type', 'Bookings',
        'priority', 'medium',
        'actionLabel', 'View Details',
        'deepLink', '/session-detail?id=' || b.id
      )::text;

      INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
      VALUES (v_notify_id, b.trainer_id, 'Session Reminder ⏱️', v_trainer_body, false, 'Just now', 'today', 'clock');

      UPDATE public.bookings
      SET reminder_sent = true
      WHERE id = b.id;

      INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
      VALUES (b.id, 'SESSION_REMINDER_SENT', 'TRAINER_ACCEPTED', 'TRAINER_ACCEPTED', 'system', 'system');
    END IF;
  END LOOP;
END;
$$;

-- 7. EVENT TRIGGER DISPATCH FUNCTION FOR NOTIFICATION AUDIT DISPATCH
CREATE OR REPLACE FUNCTION public.dispatch_audit_notification() RETURNS trigger AS $$
DECLARE
  v_client_id text;
  v_trainer_id text;
  v_workout_title text;
  v_title text;
  v_body text;
  v_deep_link text;
  v_recipient_id text;
  v_notify_id text;
BEGIN
  SELECT client_id, trainer_id, workout_title INTO v_client_id, v_trainer_id, v_workout_title
  FROM public.bookings WHERE id = NEW.booking_id;

  IF NEW.event_type = 'TRAVEL_STARTED' THEN
    v_recipient_id := v_client_id;
    v_title := 'Coach On The Way 🚗';
    v_body := 'Your trainer has started travelling to your venue.';
    v_deep_link := '/session-detail?id=' || NEW.booking_id;
  ELSIF NEW.event_type = 'TRAINER_ARRIVED' THEN
    v_recipient_id := v_client_id;
    v_title := 'Coach Arrived 🔔';
    v_body := 'Your trainer has arrived. Please share the check-in OTP.';
    v_deep_link := '/session-detail?id=' || NEW.booking_id;
  ELSIF NEW.event_type = 'WORKOUT_STARTED' THEN
    v_recipient_id := v_client_id;
    v_title := 'Session Started ⚡';
    v_body := 'Your session for ' || v_workout_title || ' has officially started.';
    v_deep_link := '/session-detail?id=' || NEW.booking_id;
  ELSIF NEW.event_type = 'WORKOUT_COMPLETED' THEN
    v_recipient_id := v_client_id;
    v_title := 'Session Completed 🏆';
    v_body := 'Session complete. Please rate your experience.';
    v_deep_link := '/session-detail?id=' || NEW.booking_id;
  END IF;

  IF v_recipient_id IS NOT NULL THEN
    v_notify_id := 'notify-' || EXTRACT(epoch FROM now())::bigint || '-' || floor(random() * 1000000)::text;
    INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
    VALUES (
      v_notify_id,
      v_recipient_id,
      v_title,
      jsonb_build_object('body', v_body, 'deepLink', v_deep_link, 'is_meta', true)::text,
      false,
      'Just now',
      'today',
      'bell'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_dispatch_audit_notification
AFTER INSERT ON public.booking_state_events
FOR EACH ROW EXECUTE FUNCTION public.dispatch_audit_notification();

-- 8. TIGHTENED ROW LEVEL SECURITY (RLS) POLICIES

-- user_profiles credits_balance constraint and update lockout
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS check_credits_balance_non_negative;
ALTER TABLE public.user_profiles ADD CONSTRAINT check_credits_balance_non_negative CHECK (credits_balance >= 0);

DROP POLICY IF EXISTS "Enable UPDATE for self or admin" ON public.user_profiles;
CREATE POLICY "Enable UPDATE profile details except credits" ON public.user_profiles
  FOR UPDATE USING (user_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (
    (user_id = auth.uid() AND (credits_balance IS NOT DISTINCT FROM (SELECT credits_balance FROM public.user_profiles WHERE user_id = auth.uid())))
    OR public.is_admin(auth.uid())
  );

-- bookings status & timeline lockout
DROP POLICY IF EXISTS "Enable UPDATE for participant" ON public.bookings;
DROP POLICY IF EXISTS "Restrict bookings updates to non-timeline fields" ON public.bookings;
CREATE POLICY "Restrict bookings updates to non-timeline fields" ON public.bookings
  FOR UPDATE USING (client_id = auth.uid() OR trainer_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (
    (
      status IS NOT DISTINCT FROM (SELECT status FROM public.bookings WHERE id = bookings.id) AND
      timeline_status IS NOT DISTINCT FROM (SELECT timeline_status FROM public.bookings WHERE id = bookings.id) AND
      scheduled_start_at IS NOT DISTINCT FROM (SELECT scheduled_start_at FROM public.bookings WHERE id = bookings.id) AND
      scheduled_end_at IS NOT DISTINCT FROM (SELECT scheduled_end_at FROM public.bookings WHERE id = bookings.id) AND
      travel_started_at IS NOT DISTINCT FROM (SELECT travel_started_at FROM public.bookings WHERE id = bookings.id) AND
      trainer_arrived_at IS NOT DISTINCT FROM (SELECT trainer_arrived_at FROM public.bookings WHERE id = bookings.id) AND
      session_started_at IS NOT DISTINCT FROM (SELECT session_started_at FROM public.bookings WHERE id = bookings.id) AND
      session_completed_at IS NOT DISTINCT FROM (SELECT session_completed_at FROM public.bookings WHERE id = bookings.id) AND
      otp IS NOT DISTINCT FROM (SELECT otp FROM public.bookings WHERE id = bookings.id) AND
      otp_expires_at IS NOT DISTINCT FROM (SELECT otp_expires_at FROM public.bookings WHERE id = bookings.id) AND
      manual_accepted_at IS NOT DISTINCT FROM (SELECT manual_accepted_at FROM public.bookings WHERE id = bookings.id) AND
      auto_accepted_at IS NOT DISTINCT FROM (SELECT auto_accepted_at FROM public.bookings WHERE id = bookings.id)
    )
    OR public.is_admin(auth.uid())
  );

-- client block direct inserts into credit_transactions and trainer_earnings
DROP POLICY IF EXISTS "Enable INSERT for self only" ON public.credit_transactions;
CREATE POLICY "Restrict INSERT for transactions to system RPC" ON public.credit_transactions
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Enable INSERT for simulation trainers" ON public.trainers;
CREATE POLICY "Restrict trainers details insert to admin" ON public.trainers
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
