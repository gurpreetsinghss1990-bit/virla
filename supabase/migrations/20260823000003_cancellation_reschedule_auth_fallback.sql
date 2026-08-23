-- Migration: Authentication Fallback & Past Booking Validation for Cancellation/Rescheduling
-- Created At: 2026-08-23

-- Drop legacy 5-parameter create_booking function to avoid default argument overloading ambiguity
DROP FUNCTION IF EXISTS public.create_booking(text, text, timestamp with time zone, timestamp with time zone, text);

-- 1. Redefine cancel_booking with a 2-hour window, past session check, and auth fallback
CREATE OR REPLACE FUNCTION public.cancel_booking(
  p_booking_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_id text;
  v_booking record;
  v_refund_amount integer;
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

-- 2. Redefine reschedule_booking with auth fallback
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

  -- Update booking with new slot details and reset to booked (Wait for trainer to accept rescheduled time)
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

GRANT EXECUTE ON FUNCTION public.cancel_booking(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_booking(text, text, text) TO authenticated;
