-- Tiered cancellation policy for client self-cancel.
--  >= 60 min before start : client refunded 50% of session credits (floor), trainer gets 100
--  30..60 min before start: no refund (full credits forfeited), trainer gets 150
--  < 30 min before start  : cancellation not allowed
CREATE OR REPLACE FUNCTION public.cancel_booking(
  p_booking_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_id text;
  v_booking record;
  v_credit_cost integer;
  v_refund_amount integer := 0;
  v_trainer_amount integer;
  v_mins numeric;
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

  v_mins := EXTRACT(epoch FROM (v_booking.scheduled_start_at - now())) / 60.0;

  IF v_mins < 30 THEN
     RAISE EXCEPTION 'Bookings cannot be cancelled within 30 minutes of the session.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.workouts WHERE title = v_booking.workout_title AND category = 'COUPLE') THEN
    v_credit_cost := 2;
  ELSE
    v_credit_cost := 1;
  END IF;

  IF v_mins >= 60 THEN
    v_refund_amount := floor(v_credit_cost / 2.0)::integer;
    v_trainer_amount := 100;
  ELSE
    v_refund_amount := 0;
    v_trainer_amount := 150;
  END IF;

  IF v_refund_amount > 0 THEN
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
  END IF;

  UPDATE public.bookings
  SET status = 'cancelled', timeline_status = 'SESSION_CLOSED'
  WHERE id = p_booking_id;

  IF v_booking.trainer_id != 'searching' THEN
    INSERT INTO public.trainer_earnings (id, trainer_id, booking_id, client_name, amount, date, type)
    VALUES (
      'earn-' || EXTRACT(epoch FROM now())::bigint || '-' || floor(random()*1000)::text,
      v_booking.trainer_id,
      p_booking_id,
      v_booking.client_name || ' (Client Cancel)',
      v_trainer_amount,
      to_char(now(), 'Mon DD, YYYY'),
      'no_show_compensation'
    );
  END IF;

  INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role, metadata)
  VALUES (
    p_booking_id,
    CASE WHEN v_mins >= 60 THEN 'EARLY_CANCELLATION' ELSE 'LATE_CANCELLATION' END,
    v_booking.timeline_status,
    'SESSION_CLOSED',
    v_caller_id,
    'customer',
    jsonb_build_object('refund_credits', v_refund_amount, 'trainer_compensation', v_trainer_amount)
  );

  RETURN jsonb_build_object('success', true, 'late', v_mins < 60, 'refund_credits', v_refund_amount);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_booking(text) TO authenticated;
