-- Migration: No-Show Hardening & Idempotency Guards
-- Created At: 2026-08-23

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

GRANT EXECUTE ON FUNCTION public.handle_no_show(text, text) TO authenticated;
