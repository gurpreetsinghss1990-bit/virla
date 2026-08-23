-- Migration: Booking Lifecycle Phase 2
-- Created At: 2026-08-23

-- 1. Add trainer_acknowledgement column if it does not exist
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS trainer_acknowledgement text DEFAULT 'acknowledged';

-- 2. Redefine trainer_accept_booking with local x-user-id fallback and 30-minute window
CREATE OR REPLACE FUNCTION public.trainer_accept_booking(
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

-- 3. Redefine expire_stale_bookings (remove is_admin restriction)
CREATE OR REPLACE FUNCTION public.expire_stale_bookings() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  b RECORD;
BEGIN
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

-- 4. Create apply_auto_acceptances RPC function
CREATE OR REPLACE FUNCTION public.apply_auto_acceptances() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  b RECORD;
  v_notify_id text;
  v_client_body text;
  v_trainer_body text;
BEGIN
  FOR b IN 
    SELECT id, client_id, trainer_id, workout_title, client_name, trainer_name, timeline_status
    FROM public.bookings
    WHERE status = 'upcoming'
      AND timeline_status IN ('BOOKED', 'TRAINER_ASSIGNED')
      AND trainer_id != 'searching'
      AND trainer_id IS NOT NULL
      AND now() > request_created_at + interval '30 minutes'
  LOOP
    -- Update the booking status to TRAINER_ACCEPTED
    UPDATE public.bookings
    SET timeline_status = 'TRAINER_ACCEPTED',
        acceptance_method = 'auto',
        auto_accepted_at = now(),
        trainer_acknowledgement = 'pending'
    WHERE id = b.id;

    -- Log state event
    INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
    VALUES (b.id, 'SYSTEM_AUTO_ACCEPT', b.timeline_status, 'TRAINER_ACCEPTED', 'system', 'system');

    -- Notify client
    v_notify_id := 'notify-' || EXTRACT(epoch FROM now())::bigint || '-' || floor(random() * 1000000)::text;
    v_client_body := json_build_object(
      'is_meta', true,
      'body', 'Your booking for ' || b.workout_title || ' has been confirmed with Coach ' || b.trainer_name || '.',
      'type', 'Booking Updates',
      'priority', 'high',
      'actionLabel', 'View Details',
      'deepLink', '/session-detail?id=' || b.id
    )::text;

    INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
    VALUES (v_notify_id, b.client_id, 'Booking Confirmed 🎉', v_client_body, false, 'Just now', 'today', 'check-circle');

    -- Notify trainer
    v_notify_id := 'notify-' || EXTRACT(epoch FROM now())::bigint || '-' || floor(random() * 1000000)::text;
    v_trainer_body := json_build_object(
      'is_meta', true,
      'body', 'Session auto-accepted due to no manual response within 30 minutes. Acknowledgement required.',
      'type', 'Trainer Updates',
      'priority', 'high',
      'actionLabel', 'Acknowledge',
      'deepLink', '/session-detail?id=' || b.id
    )::text;

    INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
    VALUES (v_notify_id, b.trainer_id, 'Auto-Accepted Request ⚠️', v_trainer_body, false, 'Just now', 'today', 'alert-circle');
  END LOOP;
END;
$$;

-- 5. Create acknowledge_auto_accept RPC function
CREATE OR REPLACE FUNCTION public.acknowledge_auto_accept(
  p_booking_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trainer_id text;
  v_booking record;
BEGIN
  -- Resolve trainer identity
  v_trainer_id := auth.uid()::text;
  IF v_trainer_id IS NULL AND public.is_local_development() THEN
    v_trainer_id := (current_setting('request.headers', true)::jsonb->>'x-user-id');
  END IF;

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

-- 6. Redefine handle_no_show to support custom client no-show notification text
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

  IF p_no_show_type = 'client' THEN
    -- Idempotence guard: if already marked client no-show, return success immediately
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
      'body', 'Your trainer has marked this session as Client No-Show because you were not available at the scheduled session. The session has been cancelled and 1 credit has been charged.',
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
    -- Idempotence guard: if already marked trainer no-show, return success immediately
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

-- 7. Grant executes
GRANT EXECUTE ON FUNCTION public.trainer_accept_booking(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_bookings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_auto_acceptances() TO authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_auto_accept(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_no_show(text, text) TO authenticated;
