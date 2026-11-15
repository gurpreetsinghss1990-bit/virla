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

GRANT EXECUTE ON FUNCTION public.apply_auto_acceptances() TO authenticated;

-- NOTE: reassign_booking_trainer is redefined in 20261107091000, because the
-- reassignment also records no-repeat (a trainer who already declined for this
-- booking is never assigned again) and resets request_created_at.
