-- Server-side expiry for unanswered training requests.
--
-- Until now the only thing that moved a request to the next trainer was the
-- trainer app's own countdown. If that app was closed / backgrounded / offline,
-- the booking stayed TRAINER_ASSIGNED forever and the client kept waiting.
--
-- This adds a database-side sweep:
--   * future sessions whose acceptance_deadline has passed -> next trainer
--   * past/too-close sessions are left untouched (expire_stale_bookings owns them)
--
-- It is safe to call from any client refresh and from pg_cron.

-- 1. Internal reassign without auth checks (callable from other SECURITY DEFINER functions)
CREATE OR REPLACE FUNCTION public._reassign_booking_trainer_internal(
  p_booking_id text,
  p_action text DEFAULT 'timeout'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_booking record;
  v_coach record;
  v_now_ms bigint;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.timeline_status IS DISTINCT FROM 'BOOKED' AND v_booking.timeline_status IS DISTINCT FROM 'TRAINER_ASSIGNED' THEN
    RETURN jsonb_build_object(
      'success', true,
      'reassigned', false,
      'message', 'Booking has already been accepted or progressed beyond reassignment.'
    );
  END IF;

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
    AND NOT EXISTS (
      SELECT 1 FROM public.booking_state_events e
      WHERE e.booking_id = p_booking_id
        AND e.event_type = 'TRAINER_DECLINED_OR_TIMEOUT'
        AND e.actor_user_id = t.id
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
      request_created_at = now(),
      acceptance_notification_count = 1,
      last_acceptance_notification_at = v_now_ms,
      acceptance_deadline = v_now_ms + 10 * 60 * 1000
    WHERE id = p_booking_id;

    INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
    VALUES (p_booking_id, 'TRAINER_REASSIGNED', v_booking.timeline_status, 'TRAINER_ASSIGNED', 'system', 'system');

    RETURN jsonb_build_object('success', true, 'reassigned', true, 'trainer_id', v_coach.id);
  END IF;

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
END;
$$;

-- 2. Public RPC keeps the authorization check and delegates
CREATE OR REPLACE FUNCTION public.reassign_booking_trainer(
  p_booking_id text,
  p_action text DEFAULT 'timeout'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_booking record;
  v_caller_id text;
BEGIN
  v_caller_id := auth.uid()::text;

  IF v_caller_id IS NOT NULL THEN
    SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Booking not found';
    END IF;
    IF v_booking.trainer_id != v_caller_id AND NOT public.is_admin(v_caller_id) THEN
      RAISE EXCEPTION 'Access denied. You are not authorized to trigger reassignment.';
    END IF;
  END IF;

  RETURN public._reassign_booking_trainer_internal(p_booking_id, p_action);
END;
$$;

-- 3. The sweep
CREATE OR REPLACE FUNCTION public.expire_stale_acceptances() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r RECORD;
  v_now_ms bigint;
  v_reassigned int := 0;
  v_searching int := 0;
BEGIN
  v_now_ms := (EXTRACT(epoch FROM now()) * 1000)::bigint;

  FOR r IN
    SELECT id
    FROM public.bookings
    WHERE status = 'upcoming'
      AND timeline_status IN ('BOOKED', 'TRAINER_ASSIGNED')
      AND trainer_id IS NOT NULL
      AND trainer_id <> 'searching'
      AND acceptance_deadline IS NOT NULL
      AND acceptance_deadline < v_now_ms
      AND scheduled_start_at > now() + interval '10 minutes'
    ORDER BY acceptance_deadline
    LIMIT 50
  LOOP
    BEGIN
      IF public._reassign_booking_trainer_internal(r.id, 'timeout') ->> 'reassigned' = 'true' THEN
        v_reassigned := v_reassigned + 1;
      ELSE
        v_searching := v_searching + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[ACCEPTANCE-SWEEP] failed for %: %', r.id, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object('reassigned', v_reassigned, 'searching', v_searching);
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_stale_acceptances() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reassign_booking_trainer(text, text) TO authenticated;

-- 4. Optional cron (runs even when no app is open). Safe no-op if pg_cron is unavailable.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.schedule('virla-expire-stale-acceptances', '* * * * *', $cron$SELECT public.expire_stale_acceptances();$cron$);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available, sweep will run on client refresh only: %', SQLERRM;
END;
$$;
