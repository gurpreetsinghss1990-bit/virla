-- Migration: Notify Admins On Booking Creation Trigger
-- Description: Inserts a notification record for all admin accounts whenever a new booking is created.
-- Leverages existing notifications -> push_notifications_setup mechanism to deliver push notification.

CREATE OR REPLACE FUNCTION public.notify_admin_on_new_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_rec RECORD;
  v_notify_id TEXT;
  v_title TEXT;
  v_body TEXT;
  v_now_ms BIGINT;
  v_time_str TEXT;
BEGIN
  v_now_ms := (EXTRACT(epoch FROM now()) * 1000)::bigint;
  
  -- Format notification content
  v_title := 'New Booking Created ⚡';
  v_time_str := COALESCE(NEW.time, to_char(NEW.scheduled_start_at AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM'));
  v_body := COALESCE(NEW.client_name, 'A client') || ' booked ' || COALESCE(NEW.workout_title, 'a session') || ' at ' || v_time_str || '.';

  -- Loop through all active admin users
  FOR admin_rec IN 
    SELECT id FROM public.users 
    WHERE role = 'admin' AND status = 'active'
  LOOP
    v_notify_id := 'notify-' || v_now_ms::text || '-' || floor(random() * 1000000)::text;

    INSERT INTO public.notifications (
      id,
      user_id,
      title,
      body,
      read,
      timestamp,
      "group",
      icon
    ) VALUES (
      v_notify_id,
      admin_rec.id,
      v_title,
      json_build_object(
        'text', v_body,
        'deepLink', '/admin-panel?tab=live'
      )::text,
      false,
      'Just now',
      'today',
      'calendar'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any and attach to public.bookings
DROP TRIGGER IF EXISTS trg_notify_admin_on_new_booking ON public.bookings;
CREATE TRIGGER trg_notify_admin_on_new_booking
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_new_booking();

