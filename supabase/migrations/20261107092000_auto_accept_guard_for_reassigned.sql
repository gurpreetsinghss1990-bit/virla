-- The "10-minute cron auto-accept" path (process-pending-acceptance-bookings-job,
-- scheduled in 20260816120000) also binds a trainer without consent. It must follow
-- the same rule as apply_auto_acceptances: only the ORIGINAL trainer assignment can
-- be auto-accepted. A trainer reached after a decline/timeout needs to accept manually.

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

  -- A trainer who received the request after a decline/timeout never gets the
  -- session without explicitly accepting it.
  IF EXISTS (
    SELECT 1 FROM public.booking_state_events e
    WHERE e.booking_id = p_booking_id
      AND e.event_type IN ('TRAINER_REASSIGNED', 'TRAINER_DECLINED_OR_TIMEOUT')
  ) THEN
    RETURN jsonb_build_object(
      'success', true,
      'auto_accepted', false,
      'reason', 'reassigned_trainer_requires_manual_accept'
    );
  END IF;

  UPDATE public.bookings
  SET timeline_status = 'TRAINER_ACCEPTED',
      acceptance_method = 'auto',
      auto_accepted_at = now(),
      acceptance_notification_count = 3
  WHERE id = p_booking_id;

  INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
  VALUES (p_booking_id, 'AUTO_ACCEPTED', v_booking.timeline_status, 'TRAINER_ACCEPTED', 'system', 'system');

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

CREATE OR REPLACE FUNCTION public.process_pending_acceptance_bookings() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  b RECORD;
  v_notify_id text;
  v_trainer_body text;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()::text) THEN
     RAISE EXCEPTION 'Access denied. System scheduler functions can only be invoked by administrators or the system.';
  END IF;
  FOR b IN
    SELECT id, client_id, client_name, trainer_id, trainer_name, workout_title, request_created_at,
           acceptance_notification_count
    FROM public.bookings bk
    WHERE bk.status = 'upcoming'
      AND bk.timeline_status IN ('BOOKED', 'TRAINER_ASSIGNED')
      AND NOT EXISTS (
        SELECT 1 FROM public.booking_state_events e
        WHERE e.booking_id = bk.id
          AND e.event_type IN ('TRAINER_REASSIGNED', 'TRAINER_DECLINED_OR_TIMEOUT')
      )
  LOOP
    IF now() >= b.request_created_at + interval '10 minutes' THEN
      PERFORM public.auto_accept_booking(b.id);

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
