-- Auto-accept must only apply to the ORIGINAL trainer assignment (the one the user's
-- slot tap ranked). A trainer who received the request after a decline/timeout never
-- gets the session without explicitly accepting it.
--
-- Also reset request_created_at on reassignment so the new trainer's response window
-- (10 min deadline + the client-side countdown that reads request_created_at) starts
-- from the moment the request reached them, not from the original booking creation.

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
    FROM public.bookings bk
    WHERE bk.status = 'upcoming'
      AND bk.timeline_status IN ('BOOKED', 'TRAINER_ASSIGNED')
      AND bk.trainer_id != 'searching'
      AND bk.trainer_id IS NOT NULL
      AND now() > bk.request_created_at + interval '30 minutes'
      AND NOT EXISTS (
        SELECT 1 FROM public.booking_state_events e
        WHERE e.booking_id = bk.id
          AND e.event_type IN ('TRAINER_REASSIGNED', 'TRAINER_DECLINED_OR_TIMEOUT')
      )
  LOOP
    UPDATE public.bookings
    SET timeline_status = 'TRAINER_ACCEPTED',
        acceptance_method = 'auto',
        auto_accepted_at = now(),
        trainer_acknowledgement = 'pending'
    WHERE id = b.id;

    INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
    VALUES (b.id, 'SYSTEM_AUTO_ACCEPT', b.timeline_status, 'TRAINER_ACCEPTED', 'system', 'system');

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

  IF v_caller_id IS NOT NULL THEN
    IF v_booking.trainer_id != v_caller_id AND NOT public.is_admin(v_caller_id) THEN
      RAISE EXCEPTION 'Access denied. You are not authorized to trigger reassignment.';
    END IF;
  END IF;

  IF v_booking.timeline_status IS DISTINCT FROM 'BOOKED' AND v_booking.timeline_status IS DISTINCT FROM 'TRAINER_ASSIGNED' THEN
    RETURN jsonb_build_object(
      'success', true,
      'reassigned', false,
      'message', 'Booking has already been accepted or progressed beyond reassignment.'
    );
  END IF;

  RAISE NOTICE '[BOOKING-LIFECYCLE] assignment attempt bookingId: %, trainerId: %, action: %', p_booking_id, v_booking.trainer_id, p_action;

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

    RAISE NOTICE '[BOOKING-LIFECYCLE] assignment result: reassigned to trainerId: %', v_coach.id;
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

    RAISE NOTICE '[BOOKING-LIFECYCLE] assignment result: pool exhausted, set to searching';
    RETURN jsonb_build_object('success', true, 'reassigned', false, 'trainer_id', 'searching');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_auto_acceptances() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reassign_booking_trainer(text, text) TO authenticated;
