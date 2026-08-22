-- Migration: Booking and Trainer Identity Hardening for Local Dev
-- Created At: 2026-08-22

-- A. Redefine create_booking with local x-user-id fallback
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
  -- Authentication Check with local fallback
  v_client_id := auth.uid()::text;
  IF v_client_id IS NULL AND public.is_local_development() THEN
    v_client_id := (current_setting('request.headers', true)::jsonb->>'x-user-id');
  END IF;

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


-- B. Redefine trainer_accept_booking with local x-user-id fallback
CREATE OR REPLACE FUNCTION public.trainer_accept_booking(
  p_booking_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trainer_id text;
  v_booking record;
BEGIN
  -- Authentication Check with local fallback
  v_trainer_id := auth.uid()::text;
  IF v_trainer_id IS NULL AND public.is_local_development() THEN
    v_trainer_id := (current_setting('request.headers', true)::jsonb->>'x-user-id');
  END IF;

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


-- C. Redefine slot_reservations RLS policies with local x-user-id fallback
DROP POLICY IF EXISTS "Enable INSERT for owner or admin" ON public.slot_reservations;
CREATE POLICY "Enable INSERT for owner or admin" ON public.slot_reservations
  FOR INSERT WITH CHECK (
    client_id = auth.uid()::text
    OR (public.is_local_development() AND client_id = (current_setting('request.headers', true)::jsonb->>'x-user-id'))
    OR public.is_admin(auth.uid()::text)
    OR (public.is_local_development() AND public.is_admin(current_setting('request.headers', true)::jsonb->>'x-user-id'))
  );

DROP POLICY IF EXISTS "Enable DELETE for owner, expired, or admin" ON public.slot_reservations;
CREATE POLICY "Enable DELETE for owner, expired, or admin" ON public.slot_reservations
  FOR DELETE USING (
    client_id = auth.uid()::text
    OR (public.is_local_development() AND client_id = (current_setting('request.headers', true)::jsonb->>'x-user-id'))
    OR (expires_at <= now())
    OR public.is_admin(auth.uid()::text)
    OR (public.is_local_development() AND public.is_admin(current_setting('request.headers', true)::jsonb->>'x-user-id'))
  );


-- D. Redefine trainers UPDATE policy with local x-user-id fallback
DROP POLICY IF EXISTS "Enable UPDATE for trainers self only" ON public.trainers;
CREATE POLICY "Enable UPDATE for trainers self only" ON public.trainers
  FOR UPDATE USING (
    id = auth.uid()::text
    OR (public.is_local_development() AND id = (current_setting('request.headers', true)::jsonb->>'x-user-id'))
    OR public.is_admin(auth.uid()::text)
    OR (public.is_local_development() AND public.is_admin(current_setting('request.headers', true)::jsonb->>'x-user-id'))
  )
  WITH CHECK (
    (
      (
        id = auth.uid()::text
        OR (public.is_local_development() AND id = (current_setting('request.headers', true)::jsonb->>'x-user-id'))
      )
      AND price IS NOT DISTINCT FROM (SELECT price FROM public.trainers WHERE id = trainers.id)
      AND rating IS NOT DISTINCT FROM (SELECT rating FROM public.trainers WHERE id = trainers.id)
      AND rating_count IS NOT DISTINCT FROM (SELECT rating_count FROM public.trainers WHERE id = trainers.id)
      AND completed_sessions IS NOT DISTINCT FROM (SELECT completed_sessions FROM public.trainers WHERE id = trainers.id)
      AND verified_badge IS NOT DISTINCT FROM (SELECT verified_badge FROM public.trainers WHERE id = trainers.id)
      AND level IS NOT DISTINCT FROM (SELECT level FROM public.trainers WHERE id = trainers.id)
      AND operating_address IS NOT DISTINCT FROM (SELECT operating_address FROM public.trainers WHERE id = trainers.id)
      AND operating_latitude IS NOT DISTINCT FROM (SELECT operating_latitude FROM public.trainers WHERE id = trainers.id)
      AND operating_longitude IS NOT DISTINCT FROM (SELECT operating_longitude FROM public.trainers WHERE id = trainers.id)
      AND operating_place_id IS NOT DISTINCT FROM (SELECT operating_place_id FROM public.trainers WHERE id = trainers.id)
      AND operating_location_status IS NOT DISTINCT FROM (SELECT operating_location_status FROM public.trainers WHERE id = trainers.id)
    )
    OR public.is_admin(auth.uid()::text)
    OR (public.is_local_development() AND public.is_admin(current_setting('request.headers', true)::jsonb->>'x-user-id'))
  );


-- E. Redefine bookings Restrict updates policy with local x-user-id fallback
DROP POLICY IF EXISTS "Restrict bookings updates to non-timeline fields" ON public.bookings;
CREATE POLICY "Restrict bookings updates to non-timeline fields" ON public.bookings
  FOR UPDATE USING (
    client_id = auth.uid()::text 
    OR trainer_id = auth.uid()::text 
    OR public.is_admin(auth.uid()::text)
    OR (public.is_local_development() AND client_id = (current_setting('request.headers', true)::jsonb->>'x-user-id'))
    OR (public.is_local_development() AND trainer_id = (current_setting('request.headers', true)::jsonb->>'x-user-id'))
    OR (public.is_local_development() AND public.is_admin(current_setting('request.headers', true)::jsonb->>'x-user-id'))
  )
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
    OR public.is_admin(auth.uid()::text)
    OR (public.is_local_development() AND public.is_admin(current_setting('request.headers', true)::jsonb->>'x-user-id'))
  );
