-- Migration: Drop and Recreate unique_active_trainer_slot to exclude 'searching', and harden assignment/acceptance RPCs
-- Created At: 2026-08-23

-- 1. Exclude 'searching' placeholder from unique_active_trainer_slot
DROP INDEX IF EXISTS public.unique_active_trainer_slot;
CREATE UNIQUE INDEX unique_active_trainer_slot 
ON public.bookings (trainer_id, date, time) 
WHERE (status != 'cancelled' AND trainer_id != 'searching');

-- 2. Redefine reassign_booking_trainer to enforce status check, idempotency, and tracing logs
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

  -- Diagnostic log
  RAISE NOTICE '[BOOKING-LIFECYCLE] assignment attempt bookingId: %, trainerId: %, action: %', p_booking_id, v_booking.trainer_id, p_action;

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

    RAISE NOTICE '[BOOKING-LIFECYCLE] assignment result: reassigned to trainerId: %', v_coach.id;
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

    RAISE NOTICE '[BOOKING-LIFECYCLE] assignment result: pool exhausted, set to searching';
    RETURN jsonb_build_object('success', true, 'reassigned', false, 'trainer_id', 'searching');
  END IF;
END;
$$;

-- 3. Redefine trainer_accept_booking to ensure idempotency for already-accepted or progressed states
CREATE OR REPLACE FUNCTION public.trainer_accept_booking(
  p_booking_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trainer_id text;
  v_booking record;
BEGIN
  v_trainer_id := auth.uid()::text;
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
