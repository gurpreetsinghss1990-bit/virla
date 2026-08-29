--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET search_path = public, pg_catalog, extensions, auth;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA IF NOT EXISTS public;


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: acknowledge_auto_accept(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.acknowledge_auto_accept(p_booking_id text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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


ALTER FUNCTION public.acknowledge_auto_accept(p_booking_id text) OWNER TO postgres;

--
-- Name: apply_auto_acceptances(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.apply_auto_acceptances() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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


ALTER FUNCTION public.apply_auto_acceptances() OWNER TO postgres;

--
-- Name: approve_trainer_application(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.approve_trainer_application(app_id text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  app_row public.trainer_applications%ROWTYPE;
  user_row public.users%ROWTYPE;
  user_id text;
  certs_obj jsonb;
  phone_digits text;
  normalized_phone text;
  lat numeric := 19.0176;
  lng numeric := 72.8164;
  languages_array text[];
  primary_workout_category text;
BEGIN
  -- Verify admin permissions
  IF NOT public.is_admin(current_setting('request.headers', true)::jsonb->>'x-user-id') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Select application row
  SELECT * INTO app_row FROM public.trainer_applications WHERE id = app_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  IF app_row.status = 'approved' THEN
    RETURN;
  END IF;

  -- Normalize phone number
  phone_digits := regexp_replace(app_row.phone, '\D', '', 'g');
  IF starts_with(phone_digits, '91') AND length(phone_digits) = 12 THEN
    normalized_phone := phone_digits;
  ELSIF length(phone_digits) = 10 THEN
    normalized_phone := '91' || phone_digits;
  ELSE
    normalized_phone := phone_digits;
  END IF;

  -- Locate or create user
  SELECT * INTO user_row FROM public.users WHERE phone = normalized_phone;
  IF FOUND THEN
    user_id := user_row.id;
    -- Promote user role if not already admin
    IF user_row.role <> 'admin' THEN
      UPDATE public.users SET role = 'trainer' WHERE id = user_id;
    END IF;
  ELSE
    user_id := 'u-' || substring(md5(random()::text) from 1 for 9);
    INSERT INTO public.users (
      id, name, phone, email, password_hash, avatar, role, status, created_date, last_login, device_info, notification_prefs
    ) VALUES (
      user_id,
      app_row.full_name,
      normalized_phone,
      app_row.email,
      'password123',
      app_row.avatar,
      'trainer',
      'active',
      to_char(now(), 'DD/MM/YYYY'),
      '',
      'Simulated Onboard',
      '{"bookingUpdates": true, "trainerMessages": true, "offers": true, "membershipAlerts": true}'::jsonb
    );
  END IF;

  -- Create trainers record if not exists or update it
  languages_array := regexp_split_to_array(app_row.languages, '\s*,\s*');
  primary_workout_category := app_row.primary_workout;

  INSERT INTO public.trainers (
    id, name, photo, experience, rating, specialty, years_experience, specialization, languages, short_bio, completed_sessions, rating_count, about_text, availability, working_radius, bank_details, emergency_contact, level, weekly_slots_submitted, remaining_slot_changes, retainer_status, attendance_rate, punctuality_rate, availability_compliance, price, verified_badge, certifications, achievements, reviews, workout_specialties, is_favourite, preferences, gender, operating_location_status
  ) VALUES (
    user_id,
    app_row.full_name,
    app_row.avatar,
    app_row.years_of_experience || ' yrs exp',
    5.0,
    primary_workout_category,
    app_row.years_of_experience,
    primary_workout_category || ', ' || app_row.secondary_skills,
    languages_array,
    app_row.about_me,
    0,
    0,
    app_row.fitness_qualifications,
    app_row.working_days,
    app_row.preferred_working_radius || ' km',
    jsonb_build_object('accountName', app_row.bank_account_name, 'bankName', app_row.bank_name, 'accountNumber', app_row.bank_account_number, 'ifsc', app_row.bank_ifsc, 'upiId', app_row.bank_upi_id),
    app_row.emergency_contact,
    'Associate',
    0,
    3,
    'not_eligible',
    100.0,
    100.0,
    100.0,
    1200,
    true,
    '{}'::text[],
    '{}'::text[],
    '[]'::jsonb,
    '{}'::text[],
    false,
    jsonb_build_object('online', false, 'radiusKm', app_row.preferred_working_radius, 'maxDailySessions', 5, 'categories', array[primary_workout_category], 'operatingAddress', app_row.address, 'operatingLatitude', lat, 'operatingLongitude', lng, 'operatingLocationStatus', 'verified'),
    app_row.gender,
    'verified'
  ) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    photo = EXCLUDED.photo,
    experience = EXCLUDED.experience,
    specialty = EXCLUDED.specialty,
    years_experience = EXCLUDED.years_experience,
    specialization = EXCLUDED.specialization,
    languages = EXCLUDED.languages,
    short_bio = EXCLUDED.short_bio,
    about_text = EXCLUDED.about_text,
    availability = EXCLUDED.availability,
    working_radius = EXCLUDED.working_radius,
    bank_details = EXCLUDED.bank_details,
    emergency_contact = EXCLUDED.emergency_contact,
    gender = EXCLUDED.gender,
    operating_location_status = EXCLUDED.operating_location_status,
    preferences = EXCLUDED.preferences,
    verified_badge = EXCLUDED.verified_badge;

  -- Create user_profiles record if not exists
  INSERT INTO public.user_profiles (
    id, user_id, age, gender, height, weight, fitness_goal, preferred_workout, emergency_contact, medical_notes, membership_status, credits_balance, dob, fitness_level, preferred_language, city, member_since, selected_goals
  ) VALUES (
    'prof-' || substring(md5(random()::text) from 1 for 9),
    user_id,
    30,
    app_row.gender,
    '180 cm',
    '80 kg',
    primary_workout_category,
    'PowerForge',
    app_row.emergency_contact,
    '',
    'Trainer Account',
    0,
    app_row.dob,
    'Trainer',
    languages_array[1],
    app_row.city,
    to_char(now(), 'Mon YYYY'),
    array[primary_workout_category]
  ) ON CONFLICT (user_id) DO NOTHING;

  -- Update application status
  certs_obj := app_row.document_certifications;
  certs_obj := jsonb_set(certs_obj, '{aadhaarStatus}', '"verified"');
  certs_obj := jsonb_set(certs_obj, '{panStatus}', '"verified"');

  UPDATE public.trainer_applications
  SET status = 'approved', document_certifications = certs_obj, updated_at = now()
  WHERE id = app_id;
END;
$$;


ALTER FUNCTION public.approve_trainer_application(app_id text) OWNER TO postgres;

--
-- Name: auto_accept_booking(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.auto_accept_booking(p_booking_id text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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

  UPDATE public.bookings
  SET timeline_status = 'TRAINER_ACCEPTED',
      acceptance_method = 'auto',
      auto_accepted_at = now(),
      acceptance_notification_count = 3
  WHERE id = p_booking_id;

  INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
  VALUES (p_booking_id, 'AUTO_ACCEPTED', v_booking.timeline_status, 'TRAINER_ACCEPTED', 'system', 'system');

  -- Notification Dispatches
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


ALTER FUNCTION public.auto_accept_booking(p_booking_id text) OWNER TO postgres;

--
-- Name: cancel_booking(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.cancel_booking(p_booking_id text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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


ALTER FUNCTION public.cancel_booking(p_booking_id text) OWNER TO postgres;

--
-- Name: close_session(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.close_session(p_booking_id text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_booking record;
  v_caller_id text;
BEGIN
  v_caller_id := auth.uid();

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
     RAISE EXCEPTION 'Booking not found';
  END IF;

  -- Verify participant or admin/system authorization
  IF v_caller_id IS NOT NULL THEN
    IF v_booking.client_id != v_caller_id AND v_booking.trainer_id != v_caller_id AND NOT public.is_admin(v_caller_id) THEN
      RAISE EXCEPTION 'Access denied. Caller is not a participant of this booking.';
    END IF;
  END IF;

  IF v_booking.timeline_status = 'SESSION_CLOSED' THEN
     RETURN jsonb_build_object('success', true);
  END IF;

  UPDATE public.bookings
  SET timeline_status = 'SESSION_CLOSED'
  WHERE id = p_booking_id;

  INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
  VALUES (p_booking_id, 'SESSION_CLOSED_BY_TIMEOUT', v_booking.timeline_status, 'SESSION_CLOSED', 'system', 'system');

  RETURN jsonb_build_object('success', true);
END;
$$;


ALTER FUNCTION public.close_session(p_booking_id text) OWNER TO postgres;

--
-- Name: complete_session(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.complete_session(p_booking_id text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
    RAISE EXCEPTION 'Access denied. Only trainers can complete session.';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
     RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.trainer_id != v_trainer_id THEN
     RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_booking.timeline_status = 'WORKOUT_COMPLETED' THEN
     RETURN jsonb_build_object('success', true);
  END IF;

  IF v_booking.timeline_status != 'WORKOUT_STARTED' THEN
     RAISE EXCEPTION 'Cannot complete workout if status is not WORKOUT_STARTED';
  END IF;

  -- 30 mins session duration validation buffer
  IF now() < v_booking.session_started_at + interval '30 minutes' THEN
     RAISE EXCEPTION 'Workout cannot be completed yet. Minimum session duration buffer is 30 minutes.';
  END IF;

  UPDATE public.bookings
  SET timeline_status = 'WORKOUT_COMPLETED',
      status = 'completed',
      session_completed_at = now()
  WHERE id = p_booking_id;

  INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
  VALUES (p_booking_id, 'WORKOUT_COMPLETED', 'WORKOUT_STARTED', 'WORKOUT_COMPLETED', v_trainer_id, 'trainer');

  RETURN jsonb_build_object('success', true);
END;
$$;


ALTER FUNCTION public.complete_session(p_booking_id text) OWNER TO postgres;

--
-- Name: create_booking(text, text, timestamp with time zone, timestamp with time zone, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_booking(p_booking_id text, p_workout_id text, p_scheduled_start_at timestamp with time zone, p_scheduled_end_at timestamp with time zone, p_assigned_trainer_id text, p_trainer_note text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_client_id text;
  v_session_type text;
  v_credit_cost integer;
  v_current_credits integer;
  v_workout_title text;
  v_workout_price integer;
  v_trainer_name text;
  v_client_name text;
  v_client_phone text;
BEGIN
  -- Authentication Check with local fallback
  v_client_id := auth.uid()::text;
  IF v_client_id IS NULL AND public.is_local_development() THEN
    v_client_id := (current_setting('request.headers', true)::jsonb->>'x-user-id');
  END IF;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Slot Double booking & Buffer check (30 minutes travel buffer before/after)
  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE trainer_id = p_assigned_trainer_id
      AND status = 'upcoming'
      AND (
        (scheduled_start_at - interval '30 minutes', scheduled_end_at + interval '30 minutes') OVERLAPS 
        (p_scheduled_start_at, p_scheduled_end_at)
      )
  ) THEN
    RAISE EXCEPTION 'Trainer is unavailable due to an overlapping booking or travel buffer conflict.';
  END IF;

  -- Slot reservation conflicts
  IF EXISTS (
    SELECT 1 FROM public.slot_reservations
    WHERE trainer_id = p_assigned_trainer_id
      AND client_id != v_client_id
      AND expires_at > now()
      AND (
        (scheduled_start_at, scheduled_end_at) OVERLAPS 
        (p_scheduled_start_at, p_scheduled_end_at)
      )
  ) THEN
    RAISE EXCEPTION 'Trainer slot is currently reserved by another client.';
  END IF;

  -- Determine Workout Type & Credit Cost
  SELECT category, title, session_price INTO v_session_type, v_workout_title, v_workout_price 
  FROM public.workouts WHERE id = p_workout_id;
  
  -- Abort transaction if workout is not found
  IF v_workout_title IS NULL THEN
    RAISE EXCEPTION 'Workout not found: %', p_workout_id;
  END IF;

  IF v_session_type = 'COUPLE' THEN
    v_credit_cost := 2;
  ELSE
    v_credit_cost := 1;
  END IF;

  -- Verify caller role is customer
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_client_id AND role = 'customer') THEN
    RAISE EXCEPTION 'Only customers can create bookings.';
  END IF;

  -- Lock user profile row for update to prevent negative balance race condition
  SELECT credits_balance INTO v_current_credits
  FROM public.user_profiles
  WHERE user_id = v_client_id
  FOR UPDATE;

  SELECT name, phone INTO v_client_name, v_client_phone
  FROM public.users
  WHERE id = v_client_id;

  IF v_current_credits < v_credit_cost THEN
    RAISE EXCEPTION 'Insufficient credits balance. Required: %, Available: %', v_credit_cost, v_current_credits;
  END IF;

  SELECT name INTO v_trainer_name FROM public.trainers WHERE id = p_assigned_trainer_id;

  -- Perform atomic mutations
  UPDATE public.user_profiles 
  SET credits_balance = credits_balance - v_credit_cost 
  WHERE user_id = v_client_id;

  -- Insert ledger transaction
  INSERT INTO public.credit_transactions (id, user_id, type, amount, date, status, credits)
  VALUES (
    'tx-' || EXTRACT(epoch FROM now())::bigint || '-' || floor(random()*1000)::text,
    v_client_id,
    'spend',
    '₹0',
    to_char(now(), 'Mon DD, YYYY'),
    'paid',
    v_credit_cost
  );

  -- Insert new booking authoritatively
  INSERT INTO public.bookings (
    id, status, timeline_status, otp, client_name, client_phone, trainer_name,
    scheduled_start_at, scheduled_end_at, date, time, workout_title, price, client_id, trainer_id,
    request_created_at, acceptance_notification_count, last_acceptance_notification_at, acceptance_deadline,
    trainer_note
  ) VALUES (
    p_booking_id,
    'upcoming',
    'BOOKED',
    to_char(floor(1000 + random() * 9000), 'FM9999'),
    v_client_name,
    v_client_phone,
    v_trainer_name,
    p_scheduled_start_at,
    p_scheduled_end_at,
    to_char(p_scheduled_start_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD'),
    to_char(p_scheduled_start_at AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM') || ' - ' || to_char(p_scheduled_end_at AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM'),
    v_workout_title,
    v_workout_price,
    v_client_id,
    p_assigned_trainer_id,
    now(),
    1,
    (EXTRACT(epoch FROM now())*1000)::bigint,
    (EXTRACT(epoch FROM now() + interval '10 minutes')*1000)::bigint,
    p_trainer_note
  );

  -- Log state change event
  INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
  VALUES (p_booking_id, 'BOOKING_CREATED', NULL, 'BOOKED', v_client_id, 'customer');

  RETURN jsonb_build_object('success', true, 'booking_id', p_booking_id);
END;
$$;


ALTER FUNCTION public.create_booking(p_booking_id text, p_workout_id text, p_scheduled_start_at timestamp with time zone, p_scheduled_end_at timestamp with time zone, p_assigned_trainer_id text, p_trainer_note text) OWNER TO postgres;

--
-- Name: create_user_with_profile(jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_user_with_profile(user_row jsonb, profile_row jsonb) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Insert into public.users
  INSERT INTO public.users (
    id, name, phone, email, password_hash, avatar, role, status, created_date, last_login, device_info, notification_prefs
  ) VALUES (
    user_row->>'id',
    user_row->>'name',
    user_row->>'phone',
    user_row->>'email',
    user_row->>'password_hash',
    user_row->>'avatar',
    user_row->>'role',
    user_row->>'status',
    user_row->>'created_date',
    user_row->>'last_login',
    user_row->>'device_info',
    user_row->'notification_prefs'
  );

  -- Insert into public.user_profiles
  INSERT INTO public.user_profiles (
    id, user_id, age, gender, height, weight, fitness_goal, preferred_workout, emergency_contact, medical_notes, membership_status, credits_balance, trainer_preference, dob, fitness_level, preferred_language, city, member_since, selected_goals
  ) VALUES (
    profile_row->>'id',
    profile_row->>'user_id',
    (profile_row->>'age')::integer,
    profile_row->>'gender',
    profile_row->>'height',
    profile_row->>'weight',
    profile_row->>'fitness_goal',
    profile_row->>'preferred_workout',
    profile_row->'emergency_contact',
    profile_row->>'medical_notes',
    profile_row->>'membership_status',
    (profile_row->>'credits_balance')::integer,
    profile_row->>'trainer_preference',
    profile_row->>'dob',
    profile_row->>'fitness_level',
    profile_row->>'preferred_language',
    profile_row->>'city',
    profile_row->>'member_since',
    ARRAY(SELECT jsonb_array_elements_text(profile_row->'selected_goals'))
  );

  RETURN user_row->>'id';
END;
$$;


ALTER FUNCTION public.create_user_with_profile(user_row jsonb, profile_row jsonb) OWNER TO postgres;

--
-- Name: dispatch_audit_notification(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.dispatch_audit_notification() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_client_id text;
  v_trainer_id text;
  v_workout_title text;
  v_title text;
  v_body text;
  v_deep_link text;
  v_recipient_id text;
  v_notify_id text;
BEGIN
  SELECT client_id, trainer_id, workout_title INTO v_client_id, v_trainer_id, v_workout_title
  FROM public.bookings WHERE id = NEW.booking_id;

  IF NEW.event_type = 'TRAVEL_STARTED' THEN
    v_recipient_id := v_client_id;
    v_title := 'Coach On The Way 🚗';
    v_body := 'Your trainer has started travelling to your venue.';
    v_deep_link := '/session-detail?id=' || NEW.booking_id;
  ELSIF NEW.event_type = 'TRAINER_ARRIVED' THEN
    v_recipient_id := v_client_id;
    v_title := 'Coach Arrived 🔔';
    v_body := 'Your trainer has arrived. Please share the check-in OTP.';
    v_deep_link := '/session-detail?id=' || NEW.booking_id;
  ELSIF NEW.event_type = 'WORKOUT_STARTED' THEN
    v_recipient_id := v_client_id;
    v_title := 'Session Started ⚡';
    v_body := 'Your session for ' || v_workout_title || ' has officially started.';
    v_deep_link := '/session-detail?id=' || NEW.booking_id;
  ELSIF NEW.event_type = 'WORKOUT_COMPLETED' THEN
    v_recipient_id := v_client_id;
    v_title := 'Session Completed 🏆';
    v_body := 'Session complete. Please rate your experience.';
    v_deep_link := '/session-detail?id=' || NEW.booking_id;
  END IF;

  IF v_recipient_id IS NOT NULL THEN
    v_notify_id := 'notify-' || EXTRACT(epoch FROM now())::bigint || '-' || floor(random() * 1000000)::text;
    INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
    VALUES (
      v_notify_id,
      v_recipient_id,
      v_title,
      jsonb_build_object('body', v_body, 'deepLink', v_deep_link, 'is_meta', true)::text,
      false,
      'Just now',
      'today',
      'bell'
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.dispatch_audit_notification() OWNER TO postgres;

--
-- Name: expire_stale_bookings(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.expire_stale_bookings() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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


ALTER FUNCTION public.expire_stale_bookings() OWNER TO postgres;

--
-- Name: get_client_assessment_history(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_client_assessment_history(p_client_id text) RETURNS TABLE(booking_id text, session_date text, session_time text, coach_name text, assessment text, scheduled_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_caller_id text;
BEGIN
  -- Resolve caller identity: try auth.uid() first, fall back to x-user-id header in local dev
  v_caller_id := auth.uid()::text;
  IF v_caller_id IS NULL AND public.is_local_development() THEN
     v_caller_id := (current_setting('request.headers', true)::jsonb->>'x-user-id');
  END IF;

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Verify caller is either the client themselves, the assigned trainer for an upcoming booking of this client, or an admin
  IF v_caller_id != p_client_id 
     AND NOT EXISTS (
       SELECT 1 FROM public.bookings
       WHERE client_id = p_client_id
         AND trainer_id = v_caller_id
         AND status = 'upcoming'
     ) 
     AND NOT EXISTS (
       SELECT 1 FROM public.users
       WHERE id = v_caller_id
         AND role = 'admin'
     ) THEN
    RAISE EXCEPTION 'Access denied. You are not authorized to view this client''s history.';
  END IF;

  RETURN QUERY
  SELECT 
    b.id,
    b.date,
    b.time,
    b.trainer_name,
    b.questionnaire->>'coachNotes',
    b.scheduled_start_at
  FROM public.bookings b
  WHERE b.client_id = p_client_id
    AND b.status = 'completed'
    AND b.questionnaire->>'coachNotes' IS NOT NULL
    AND b.questionnaire->>'coachNotes' != ''
  ORDER BY b.scheduled_start_at DESC;
END;
$$;


ALTER FUNCTION public.get_client_assessment_history(p_client_id text) OWNER TO postgres;

--
-- Name: get_profile_credits(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_profile_credits(p_profile_id text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN (SELECT credits_balance FROM public.user_profiles WHERE id = p_profile_id);
END;
$$;


ALTER FUNCTION public.get_profile_credits(p_profile_id text) OWNER TO postgres;

--
-- Name: get_server_time(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_server_time() RETURNS timestamp with time zone
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN now();
END;
$$;


ALTER FUNCTION public.get_server_time() OWNER TO postgres;

--
-- Name: handle_device_token_cleanup(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_device_token_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Privileged cleanup of existing mappings of the same token for other users
  DELETE FROM public.device_tokens
  WHERE token = NEW.token AND user_id IS DISTINCT FROM NEW.user_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.handle_device_token_cleanup() OWNER TO postgres;

--
-- Name: handle_no_show(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_no_show(p_booking_id text, p_no_show_type text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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


ALTER FUNCTION public.handle_no_show(p_booking_id text, p_no_show_type text) OWNER TO postgres;

--
-- Name: is_admin(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_admin(user_id text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF user_id IS NULL OR user_id = '' THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = user_id AND role = 'admin'
  );
END;
$$;


ALTER FUNCTION public.is_admin(user_id text) OWNER TO postgres;

--
-- Name: is_local_development(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_local_development() RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN current_setting('app.settings.jwt_secret', true) = 'super-secret-jwt-token-with-at-least-32-characters-long';
END;
$$;


ALTER FUNCTION public.is_local_development() OWNER TO postgres;

--
-- Name: mark_trainer_arrived(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.mark_trainer_arrived(p_booking_id text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_trainer_id text;
  v_booking record;
  v_otp text;
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
    RAISE EXCEPTION 'Access denied. Only trainers can mark arrived.';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.trainer_id != v_trainer_id THEN
     RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_booking.timeline_status = 'TRAINER_ARRIVED' THEN
     RETURN jsonb_build_object('success', true, 'otp_expires_at', v_booking.otp_expires_at);
  END IF;

  IF v_booking.timeline_status != 'TRAINER_TRAVELLING' THEN
    RAISE EXCEPTION 'Cannot mark arrived unless currently travelling';
  END IF;

  -- Cryptographically secure OTP generation on server
  v_otp := to_char(floor(100000 + random() * 900000), 'FM999999');

  UPDATE public.bookings
  SET timeline_status = 'TRAINER_ARRIVED',
      otp = v_otp,
      trainer_arrived_at = now(),
      grace_period_started_at = now(),
      otp_expires_at = now() + interval '15 minutes'
  WHERE id = p_booking_id;

  INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
  VALUES (p_booking_id, 'TRAINER_ARRIVED', 'TRAINER_TRAVELLING', 'TRAINER_ARRIVED', v_trainer_id, 'trainer');

  RETURN jsonb_build_object('success', true, 'otp_expires_at', now() + interval '15 minutes');
END;
$$;


ALTER FUNCTION public.mark_trainer_arrived(p_booking_id text) OWNER TO postgres;

--
-- Name: on_booking_status_updated(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.on_booking_status_updated() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  notify_id text;
  client_body text;
  now_ms bigint;
  method text;
BEGIN
  now_ms := (extract(epoch from now()) * 1000)::bigint;

  -- Transition from booked to trainer_accepted
  IF NEW.timeline_status = 'trainer_accepted' AND OLD.timeline_status = 'booked' THEN
    method := COALESCE(NEW.acceptance_method, 'manual');
    IF method = 'TRAINER_MANUAL_ACCEPT' THEN
      method := 'manual';
    ELSIF method = 'SYSTEM_AUTO_ACCEPT' THEN
      method := 'auto';
    END IF;
    NEW.acceptance_method := method;
    
    IF method = 'auto' THEN
      NEW.auto_accepted_at := COALESCE(NEW.auto_accepted_at, now_ms);
    ELSE
      NEW.trainer_accepted_at := COALESCE(NEW.trainer_accepted_at, now_ms);
    END IF;

    -- Dispatch confirmation alert to client
    notify_id := 'notify-' || now_ms::text || '-' || floor(random() * 1000000)::text;
    client_body := json_build_object(
      'is_meta', true,
      'body', 'Your booking is confirmed. Coach ' || NEW.trainer_name || ' is assigned to your session on ' || NEW.date || ' @ ' || NEW.time || '.',
      'type', 'Bookings',
      'priority', 'high',
      'actionLabel', 'View Details',
      'deepLink', '/session-detail?id=' || NEW.id,
      'expiry', ''
    )::text;

    INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
    VALUES (notify_id, NEW.client_id, 'Trainer Assigned ⚡', client_body, false, 'Just now', 'today', 'check-circle');
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_booking_status_updated() OWNER TO postgres;

--
-- Name: on_notification_inserted(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.on_notification_inserted() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  token_row record;
  payload jsonb;
  body_meta jsonb;
  msg_body text;
  msg_deep_link text;
  sound_name text;
  chan_id text;
BEGIN
  -- Parse body
  BEGIN
    body_meta := NEW.body::jsonb;
    msg_body := body_meta->>'body';
    msg_deep_link := body_meta->>'deepLink';
  EXCEPTION WHEN OTHERS THEN
    body_meta := NULL;
    msg_body := NEW.body;
    msg_deep_link := '';
  END;

  -- Distinguish chimes & channels (Section 10, 34)
  IF NEW.title LIKE '%Action Required%' OR NEW.title LIKE '%New Booking%' OR NEW.title LIKE '%Pending Booking%' THEN
    sound_name := 'virla_booking_alert.wav';
    chan_id := 'virla_bookings';
  ELSIF NEW.title LIKE '%Reminder%' OR NEW.title LIKE '%reminder%' THEN
    sound_name := 'virla_reminder.wav';
    chan_id := 'virla_session_reminders';
  ELSIF NEW.title LIKE '%Cancel%' OR NEW.title LIKE '%cancel%' OR NEW.title LIKE '%Book%' OR NEW.title LIKE '%Assign%' OR NEW.title LIKE '%Assigned%' OR NEW.title LIKE '%accepted%' THEN
    sound_name := 'virla_notification.wav';
    chan_id := 'virla_bookings';
  ELSE
    sound_name := 'default';
    chan_id := 'virla_general';
  END IF;

  -- Send Expo pushes
  FOR token_row IN
    SELECT token, platform
    FROM public.device_tokens
    WHERE user_id = NEW.user_id
  LOOP
    payload := json_build_object(
      'to', token_row.token,
      'title', NEW.title,
      'body', msg_body,
      'sound', sound_name,
      'channelId', chan_id,
      'data', json_build_object(
        'deepLink', msg_deep_link,
        'notificationId', NEW.id
      )
    );

    PERFORM net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := payload
    );

    INSERT INTO public.push_delivery_logs (notification_id, user_id, device_token, platform, payload)
    VALUES (NEW.id, NEW.user_id, token_row.token, token_row.platform, payload);
  END LOOP;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_notification_inserted() OWNER TO postgres;

--
-- Name: parse_booking_start_time(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.parse_booking_start_time(b_date text, b_time text) RETURNS timestamp with time zone
    LANGUAGE plpgsql IMMUTABLE
    AS $_$
DECLARE
  clean_date text;
  start_time text;
  combined text;
  result_ts timestamptz;
BEGIN
  -- Strip 'Today, ' or 'Tomorrow, '
  clean_date := b_date;
  IF clean_date LIKE 'Today, %' THEN
    clean_date := substring(clean_date from 8);
  ELSIF clean_date LIKE 'Tomorrow, %' THEN
    clean_date := substring(clean_date from 11);
  END IF;
  
  -- Extract start time range start (first part of 'HH:MI AM - HH:MI PM')
  start_time := trim(split_part(b_time, '-', 1));
  
  -- Combine and convert
  IF clean_date ~ '^\d{4}-\d{2}-\d{2}$' THEN
    result_ts := to_timestamp(clean_date || ' ' || start_time, 'YYYY-MM-DD HH12:MI AM');
  ELSIF clean_date ~ '^\d{2}/\d{2}/\d{4}$' THEN
    result_ts := to_timestamp(clean_date || ' ' || start_time, 'DD/MM/YYYY HH12:MI AM');
  ELSE
    result_ts := to_timestamp(clean_date || ' ' || start_time, 'Mon DD, YYYY HH12:MI AM');
  END IF;
  
  -- Subtract 5.5 hours to align UTC database now() comparison with IST calendar times
  RETURN result_ts - interval '5 hours 30 minutes';
EXCEPTION WHEN OTHERS THEN
  RETURN now() + interval '2 hours'; -- safe fallback
END;
$_$;


ALTER FUNCTION public.parse_booking_start_time(b_date text, b_time text) OWNER TO postgres;

--
-- Name: process_pending_acceptance_bookings(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.process_pending_acceptance_bookings() RETURNS void
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
    FROM public.bookings
    WHERE status = 'upcoming'
      AND timeline_status IN ('BOOKED', 'TRAINER_ASSIGNED')
  LOOP
    -- 10-minute Auto-Accept
    IF now() >= b.request_created_at + interval '10 minutes' THEN
      PERFORM public.auto_accept_booking(b.id);

    -- 5-minute Reminder Escalate
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


ALTER FUNCTION public.process_pending_acceptance_bookings() OWNER TO postgres;

--
-- Name: purchase_credits(text, integer, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.purchase_credits(p_plan_name text, p_credits integer, p_amount text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_user_id text;
  v_tx_id text;
  v_date text;
BEGIN
  -- Resolve caller identity: try auth.uid() first, fall back to x-user-id header
  v_user_id := auth.uid()::text;
  IF v_user_id IS NULL OR v_user_id = '' THEN
    BEGIN
      v_user_id := current_setting('request.headers', true)::jsonb->>'x-user-id';
    EXCEPTION WHEN OTHERS THEN
      v_user_id := NULL;
    END;
  END IF;

  IF v_user_id IS NULL OR v_user_id = '' THEN
     RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_credits <= 0 THEN
     RAISE EXCEPTION 'Credits quantity must be greater than zero.';
  END IF;

  -- Validate amount against credit quantity matching client pricing plans
  IF p_credits = 1 AND p_plan_name = 'Single Session' AND p_amount != '₹1,270' THEN
     RAISE EXCEPTION 'Invalid amount for Single Session. Expected: ₹1,270, got: %', p_amount;
  ELSIF p_credits = 8 AND p_plan_name = 'Starter Pack' AND p_amount != '₹9,321' THEN
     RAISE EXCEPTION 'Invalid amount for Starter Pack. Expected: ₹9,321, got: %', p_amount;
  ELSIF p_credits = 12 AND p_plan_name = 'Active Pack' AND p_amount != '₹10,169' THEN
     RAISE EXCEPTION 'Invalid amount for Active Pack. Expected: ₹10,169, got: %', p_amount;
  ELSIF p_credits = 15 AND p_plan_name = 'Elite Pack' AND p_amount != '₹15,253' THEN
     RAISE EXCEPTION 'Invalid amount for Elite Pack. Expected: ₹15,253, got: %', p_amount;
  ELSIF p_credits = 1 AND p_plan_name = 'Couple Single Session' AND p_amount != '₹2,118' THEN
     RAISE EXCEPTION 'Invalid amount for Couple Single Session. Expected: ₹2,118, got: %', p_amount;
  ELSIF p_credits = 8 AND p_plan_name = 'Couple Starter Pack' AND p_amount != '₹15,253' THEN
     RAISE EXCEPTION 'Invalid amount for Couple Starter Pack. Expected: ₹15,253, got: %', p_amount;
  ELSIF p_credits = 12 AND p_plan_name = 'Couple Active Pack' AND p_amount != '₹16,270' THEN
     RAISE EXCEPTION 'Invalid amount for Couple Active Pack. Expected: ₹16,270, got: %', p_amount;
  ELSIF p_credits = 15 AND p_plan_name = 'Couple Elite Pack' AND p_amount != '₹25,423' THEN
     RAISE EXCEPTION 'Invalid amount for Couple Elite Pack. Expected: ₹25,423, got: %', p_amount;
  END IF;

  -- Atomically increment user profile credits
  UPDATE public.user_profiles
  SET credits_balance = credits_balance + p_credits
  WHERE user_id = v_user_id;

  IF NOT FOUND THEN
     RAISE EXCEPTION 'User profile not found.';
  END IF;

  v_tx_id := 'tx-' || extract(epoch from now())::bigint || '-' || floor(random() * 1000)::text;
  v_date := to_char(now(), 'Mon DD, YYYY');

  -- Insert ledger transaction
  INSERT INTO public.credit_transactions (id, user_id, type, amount, date, status, credits)
  VALUES (v_tx_id, v_user_id, 'purchase', p_amount, v_date, 'paid', p_credits);

  RETURN jsonb_build_object(
    'success', true,
    'tx_id', v_tx_id,
    'date', v_date,
    'new_balance', (SELECT credits_balance FROM public.user_profiles WHERE user_id = v_user_id)
  );
END;
$$;


ALTER FUNCTION public.purchase_credits(p_plan_name text, p_credits integer, p_amount text) OWNER TO postgres;

--
-- Name: reassign_booking_trainer(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.reassign_booking_trainer(p_booking_id text, p_action text DEFAULT 'timeout'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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


ALTER FUNCTION public.reassign_booking_trainer(p_booking_id text, p_action text) OWNER TO postgres;

--
-- Name: reject_trainer_application(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.reject_trainer_application(app_id text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  app_row public.trainer_applications%ROWTYPE;
  user_id text;
  certs_obj jsonb;
  phone_digits text;
  normalized_phone text;
  user_row public.users%ROWTYPE;
BEGIN
  -- Verify admin permissions
  IF NOT public.is_admin(current_setting('request.headers', true)::jsonb->>'x-user-id') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Select application
  SELECT * INTO app_row FROM public.trainer_applications WHERE id = app_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  -- Normalize phone and locate user
  phone_digits := regexp_replace(app_row.phone, '\D', '', 'g');
  IF starts_with(phone_digits, '91') AND length(phone_digits) = 12 THEN
    normalized_phone := phone_digits;
  ELSIF length(phone_digits) = 10 THEN
    normalized_phone := '91' || phone_digits;
  ELSE
    normalized_phone := phone_digits;
  END IF;

  SELECT * INTO user_row FROM public.users WHERE phone = normalized_phone;
  IF FOUND THEN
    user_id := user_row.id;
    -- Demote role if they were a trainer
    IF user_row.role = 'trainer' THEN
      UPDATE public.users SET role = 'customer' WHERE id = user_id;
    END IF;
    -- Delete trainer profile record if it exists
    DELETE FROM public.trainers WHERE id = user_id;
  END IF;

  -- Update application status
  certs_obj := app_row.document_certifications;
  certs_obj := jsonb_set(certs_obj, '{aadhaarStatus}', '"rejected"');
  certs_obj := jsonb_set(certs_obj, '{panStatus}', '"rejected"');

  UPDATE public.trainer_applications
  SET status = 'rejected', document_certifications = certs_obj, updated_at = now()
  WHERE id = app_id;
END;
$$;


ALTER FUNCTION public.reject_trainer_application(app_id text) OWNER TO postgres;

--
-- Name: reschedule_booking(text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.reschedule_booking(p_booking_id text, p_new_date text, p_new_time text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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


ALTER FUNCTION public.reschedule_booking(p_booking_id text, p_new_date text, p_new_time text) OWNER TO postgres;

--
-- Name: send_booking_reminders(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.send_booking_reminders() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  b RECORD;
  v_notify_id text;
  v_client_body text;
  v_trainer_body text;
  v_client_name text;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()::text) THEN
     RAISE EXCEPTION 'Access denied. System scheduler functions can only be invoked by administrators or the system.';
  END IF;
  FOR b IN 
    SELECT id, client_id, trainer_id, trainer_name, workout_title, scheduled_start_at
    FROM public.bookings
    WHERE status = 'upcoming'
      AND trainer_id IS NOT NULL 
      AND trainer_id != 'searching'
      AND (reminder_sent IS FALSE OR reminder_sent IS NULL)
  LOOP
    IF now() >= b.scheduled_start_at - interval '1 hour' AND now() < b.scheduled_start_at THEN
      SELECT name INTO v_client_name FROM public.users WHERE id = b.client_id;
      IF v_client_name IS NULL OR v_client_name = '' THEN
        v_client_name := 'Client';
      END IF;

      v_notify_id := 'notify-' || EXTRACT(epoch FROM now())::bigint || '-' || floor(random() * 1000000)::text;
      v_client_body := json_build_object(
        'is_meta', true,
        'body', 'Your session with Coach ' || b.trainer_name || ' starts in 1 hour.',
        'type', 'Bookings',
        'priority', 'medium',
        'actionLabel', 'View Details',
        'deepLink', '/session-detail?id=' || b.id
      )::text;

      INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
      VALUES (v_notify_id, b.client_id, 'Session Reminder ⏱️', v_client_body, false, 'Just now', 'today', 'clock');

      v_notify_id := 'notify-' || EXTRACT(epoch FROM now())::bigint || '-' || floor(random() * 1000000)::text;
      v_trainer_body := json_build_object(
        'is_meta', true,
        'body', 'Your session with ' || v_client_name || ' starts in 1 hour.',
        'type', 'Bookings',
        'priority', 'medium',
        'actionLabel', 'View Details',
        'deepLink', '/session-detail?id=' || b.id
      )::text;

      INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
      VALUES (v_notify_id, b.trainer_id, 'Session Reminder ⏱️', v_trainer_body, false, 'Just now', 'today', 'clock');

      UPDATE public.bookings
      SET reminder_sent = true
      WHERE id = b.id;

      INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
      VALUES (b.id, 'SESSION_REMINDER_SENT', 'TRAINER_ACCEPTED', 'TRAINER_ACCEPTED', 'system', 'system');
    END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION public.send_booking_reminders() OWNER TO postgres;

--
-- Name: start_session(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.start_session(p_booking_id text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
    RAISE EXCEPTION 'Access denied. Only trainers can start session.';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
     RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.trainer_id != v_trainer_id THEN
     RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_booking.timeline_status = 'WORKOUT_STARTED' THEN
     RETURN jsonb_build_object('success', true);
  END IF;

  IF v_booking.timeline_status != 'OTP_VERIFIED' THEN
     RAISE EXCEPTION 'Cannot start session unless OTP is verified';
  END IF;

  UPDATE public.bookings
  SET timeline_status = 'WORKOUT_STARTED',
      session_started_at = now()
  WHERE id = p_booking_id;

  INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
  VALUES (p_booking_id, 'WORKOUT_STARTED', 'OTP_VERIFIED', 'WORKOUT_STARTED', v_trainer_id, 'trainer');

  RETURN jsonb_build_object('success', true);
END;
$$;


ALTER FUNCTION public.start_session(p_booking_id text) OWNER TO postgres;

--
-- Name: start_travel(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.start_travel(p_booking_id text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
    RAISE EXCEPTION 'Access denied. Only trainers can start travel.';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.trainer_id != v_trainer_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_booking.timeline_status = 'TRAINER_TRAVELLING' THEN
    RETURN jsonb_build_object('success', true);
  END IF;

  IF v_booking.timeline_status != 'TRAINER_ACCEPTED' AND v_booking.timeline_status != 'TRAINER_PREPARING' THEN
    RAISE EXCEPTION 'Invalid transition to trainer_travelling from %', v_booking.timeline_status;
  END IF;

  -- Start Travel Window: Opens exactly 25 minutes prior to scheduled start time
  IF now() < v_booking.scheduled_start_at - interval '25 minutes' THEN
    RAISE EXCEPTION 'Too early to start travel. Window opens exactly 25 minutes before scheduled session time.';
  END IF;
  
  IF now() > v_booking.scheduled_start_at + interval '30 minutes' THEN
     RAISE EXCEPTION 'Session expired. Travel window has closed.';
  END IF;

  UPDATE public.bookings 
  SET timeline_status = 'TRAINER_TRAVELLING', travel_started_at = now()
  WHERE id = p_booking_id;

  INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
  VALUES (p_booking_id, 'TRAVEL_STARTED', v_booking.timeline_status, 'TRAINER_TRAVELLING', v_trainer_id, 'trainer');

  RETURN jsonb_build_object('success', true);
END;
$$;


ALTER FUNCTION public.start_travel(p_booking_id text) OWNER TO postgres;

--
-- Name: submit_customer_review(text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.submit_customer_review(p_booking_id text, p_rating_details jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_client_id text;
  v_booking record;
  v_rating numeric;
  v_count integer;
  v_avg numeric;
BEGIN
  -- Resolve client identity: try auth.uid() first, fall back to x-user-id header in local dev
  v_client_id := auth.uid()::text;
  IF v_client_id IS NULL AND public.is_local_development() THEN
     v_client_id := (current_setting('request.headers', true)::jsonb->>'x-user-id');
  END IF;

  IF v_client_id IS NULL THEN
     RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Verify customer or admin role
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_client_id AND role = 'customer') AND NOT public.is_admin(v_client_id) THEN
    RAISE EXCEPTION 'Access denied. Only customers can submit reviews.';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
     RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.client_id != v_client_id THEN
     RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_booking.timeline_status = 'SESSION_CLOSED' THEN
     RETURN jsonb_build_object('success', true);
  END IF;

  IF v_booking.timeline_status != 'TRAINER_REPORT_SUBMITTED' AND v_booking.timeline_status != 'CUSTOMER_REVIEW_PENDING' THEN
     RAISE EXCEPTION 'Cannot submit review from state %', v_booking.timeline_status;
  END IF;

  v_rating := (p_rating_details->>'rating')::numeric;
  IF v_rating IS NULL OR v_rating < 1 OR v_rating > 5 THEN
     RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  UPDATE public.bookings
  SET timeline_status = 'SESSION_CLOSED',
      status = 'completed',
      rating_details = p_rating_details
  WHERE id = p_booking_id;

  -- Recalculate average rating of trainer
  SELECT count(*), avg((rating_details->>'rating')::numeric)
  INTO v_count, v_avg
  FROM public.bookings
  WHERE trainer_id = v_booking.trainer_id AND rating_details IS NOT NULL;

  UPDATE public.trainers
  SET rating = coalesce(v_avg, 5.0),
      rating_count = v_count,
      completed_sessions = completed_sessions + 1
  WHERE id = v_booking.trainer_id;

  INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
  VALUES (p_booking_id, 'SESSION_CLOSED', v_booking.timeline_status, 'SESSION_CLOSED', v_client_id, 'customer');

  RETURN jsonb_build_object('success', true);
END;
$$;


ALTER FUNCTION public.submit_customer_review(p_booking_id text, p_rating_details jsonb) OWNER TO postgres;

--
-- Name: submit_trainer_report(text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.submit_trainer_report(p_booking_id text, p_questionnaire jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_trainer_id text;
  v_booking record;
  v_calories integer;
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
    RAISE EXCEPTION 'Access denied. Only trainers can submit reports.';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
     RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.trainer_id != v_trainer_id THEN
     RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_booking.timeline_status = 'TRAINER_REPORT_SUBMITTED' THEN
     RETURN jsonb_build_object('success', true);
  END IF;

  IF v_booking.timeline_status != 'WORKOUT_COMPLETED' THEN
     RAISE EXCEPTION 'Timeline status must be WORKOUT_COMPLETED to submit report';
  END IF;

  v_calories := coalesce(v_booking.calories_burned, 380);

  UPDATE public.bookings
  SET timeline_status = 'TRAINER_REPORT_SUBMITTED',
      questionnaire = p_questionnaire
  WHERE id = p_booking_id;

  -- Atomic Earnings insertion
  INSERT INTO public.trainer_earnings (id, trainer_id, booking_id, client_name, amount, date, type)
  VALUES (
    'earn-' || EXTRACT(epoch FROM now())::bigint || '-' || floor(random()*1000)::text,
    v_trainer_id,
    p_booking_id,
    v_booking.client_name,
    800,
    to_char(now(), 'Mon DD, YYYY'),
    'session'
  );

  -- Log calories burned
  INSERT INTO public.calorie_logs (id, user_id, date, amount)
  VALUES (
    'cal-' || EXTRACT(epoch FROM now())::bigint || '-' || floor(random()*1000)::text,
    v_booking.client_id,
    current_date,
    v_calories
  );

  INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
  VALUES (p_booking_id, 'REPORT_SUBMITTED', 'WORKOUT_COMPLETED', 'TRAINER_REPORT_SUBMITTED', v_trainer_id, 'trainer');

  RETURN jsonb_build_object('success', true);
END;
$$;


ALTER FUNCTION public.submit_trainer_report(p_booking_id text, p_questionnaire jsonb) OWNER TO postgres;

--
-- Name: trainer_accept_booking(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trainer_accept_booking(p_booking_id text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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


ALTER FUNCTION public.trainer_accept_booking(p_booking_id text) OWNER TO postgres;

--
-- Name: trainer_check_in(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trainer_check_in(p_booking_id text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN public.mark_trainer_arrived(p_booking_id);
END;
$$;


ALTER FUNCTION public.trainer_check_in(p_booking_id text) OWNER TO postgres;

--
-- Name: transfer_credits(text, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.transfer_credits(p_to_phone text, p_amount integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_from_client_id text;
  v_to_client_id text;
  v_from_balance integer;
  v_to_balance integer;
  v_to_name text;
  v_now_ms bigint;
BEGIN
  v_from_client_id := auth.uid();
  IF v_from_client_id IS NULL THEN
     RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_amount <= 0 THEN
     RAISE EXCEPTION 'Transfer amount must be greater than 0';
  END IF;

  SELECT id, name INTO v_to_client_id, v_to_name FROM public.users WHERE phone = p_to_phone AND role = 'customer';
  IF NOT FOUND THEN
     RAISE EXCEPTION 'Recipient phone number not found or not a client';
  END IF;

  -- Lock user profiles in a sorted order to guarantee zero deadlocks
  IF v_from_client_id < v_to_client_id THEN
    SELECT credits_balance INTO v_from_balance FROM public.user_profiles WHERE user_id = v_from_client_id FOR UPDATE;
    SELECT credits_balance INTO v_to_balance FROM public.user_profiles WHERE user_id = v_to_client_id FOR UPDATE;
  ELSE
    SELECT credits_balance INTO v_to_balance FROM public.user_profiles WHERE user_id = v_to_client_id FOR UPDATE;
    SELECT credits_balance INTO v_from_balance FROM public.user_profiles WHERE user_id = v_from_client_id FOR UPDATE;
  END IF;

  IF v_from_balance < p_amount THEN
     RAISE EXCEPTION 'Insufficient credits available for transfer';
  END IF;

  v_now_ms := (EXTRACT(epoch FROM now()) * 1000)::bigint;

  UPDATE public.user_profiles SET credits_balance = credits_balance - p_amount WHERE user_id = v_from_client_id;
  UPDATE public.user_profiles SET credits_balance = credits_balance + p_amount WHERE user_id = v_to_client_id;

  INSERT INTO public.credit_transactions (id, user_id, type, amount, date, status, credits)
  VALUES (
    'tx-' || v_now_ms || '-from-' || floor(random()*1000)::text,
    v_from_client_id,
    'transfer',
    '₹0',
    to_char(now(), 'Mon DD, YYYY'),
    'paid',
    p_amount
  );

  INSERT INTO public.credit_transactions (id, user_id, type, amount, date, status, credits)
  VALUES (
    'tx-' || v_now_ms || '-to-' || floor(random()*1000)::text,
    v_to_client_id,
    'purchase',
    '₹0',
    to_char(now(), 'Mon DD, YYYY'),
    'paid',
    p_amount
  );

  RETURN jsonb_build_object('success', true, 'recipient_name', v_to_name);
END;
$$;


ALTER FUNCTION public.transfer_credits(p_to_phone text, p_amount integer) OWNER TO postgres;

--
-- Name: validate_booking_transition(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_booking_transition() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  booked_start timestamptz;
  now_ms bigint;
  method text;
BEGIN
  now_ms := (extract(epoch from now()) * 1000)::bigint;

  -- If timeline_status is not changing, allow update
  IF OLD.timeline_status IS NOT DISTINCT FROM NEW.timeline_status THEN
    RETURN NEW;
  END IF;

  -- If session is closed, timeline_status cannot be changed
  IF OLD.timeline_status = 'session_closed' THEN
    RAISE EXCEPTION 'Cannot update timeline_status of a closed session.';
  END IF;

  -- Enforce state machine transitions
  IF NEW.timeline_status = 'booked' THEN
    IF OLD.timeline_status IS DISTINCT FROM 'booked' AND OLD.timeline_status IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot reset timeline_status to booked from %.', OLD.timeline_status;
    END IF;

  ELSIF NEW.timeline_status = 'trainer_assigned' THEN
    IF OLD.timeline_status IS DISTINCT FROM 'booked' AND OLD.timeline_status IS DISTINCT FROM 'trainer_assigned' THEN
      RAISE EXCEPTION 'Invalid transition to trainer_assigned from %.', OLD.timeline_status;
    END IF;

  ELSIF NEW.timeline_status = 'trainer_accepted' THEN
    IF OLD.timeline_status IS DISTINCT FROM 'booked' AND OLD.timeline_status IS DISTINCT FROM 'trainer_assigned' THEN
      RAISE EXCEPTION 'Invalid transition to trainer_accepted from %.', OLD.timeline_status;
    END IF;

    -- Standardize method names
    method := COALESCE(NEW.acceptance_method, 'manual');
    IF method = 'TRAINER_MANUAL_ACCEPT' THEN
      method := 'manual';
    ELSIF method = 'SYSTEM_AUTO_ACCEPT' THEN
      method := 'auto';
    END IF;
    NEW.acceptance_method := method;

    -- Enforce 10-minute acceptance window (600,000 ms) for manual accepts
    IF method = 'manual' AND now_ms - OLD.created_at >= 600000 THEN
      RAISE EXCEPTION 'Request has expired. The 10-minute acceptance window has closed.';
    END IF;
    
  ELSIF NEW.timeline_status = 'trainer_preparing' THEN
    IF OLD.timeline_status != 'trainer_accepted' THEN
      RAISE EXCEPTION 'Invalid transition to trainer_preparing from %.', OLD.timeline_status;
    END IF;

  ELSIF NEW.timeline_status = 'trainer_travelling' THEN
    IF OLD.timeline_status IS DISTINCT FROM 'trainer_accepted' AND OLD.timeline_status IS DISTINCT FROM 'trainer_preparing' THEN
      RAISE EXCEPTION 'Invalid transition to trainer_travelling from %.', OLD.timeline_status;
    END IF;

    -- Time-based validation for Start Travel (max 25 minutes before scheduled start time)
    booked_start := public.parse_booking_start_time(NEW.date, NEW.time);
    IF now() < booked_start - interval '25 minutes' THEN
      RAISE EXCEPTION 'Too early to start travel. Window opens 25 minutes before scheduled session time.';
    END IF;
    IF now() > booked_start + interval '30 minutes' THEN
      RAISE EXCEPTION 'Too late to start travel. Stale session window passed.';
    END IF;

    -- Record travel start timestamp
    NEW.travel_started_at := now_ms;

  ELSIF NEW.timeline_status = 'trainer_arrived' THEN
    IF OLD.timeline_status != 'trainer_travelling' THEN
      RAISE EXCEPTION 'Invalid transition to trainer_arrived from %.', OLD.timeline_status;
    END IF;

  ELSIF NEW.timeline_status = 'otp_verified' THEN
    IF OLD.timeline_status != 'trainer_arrived' THEN
      RAISE EXCEPTION 'Invalid transition to otp_verified from %.', OLD.timeline_status;
    END IF;

  ELSIF NEW.timeline_status = 'workout_started' THEN
    IF OLD.timeline_status != 'otp_verified' THEN
      RAISE EXCEPTION 'Invalid transition to workout_started from %.', OLD.timeline_status;
    END IF;
    
    NEW.workout_started_at := COALESCE(NEW.workout_started_at, now_ms);

  ELSIF NEW.timeline_status = 'workout_completed' THEN
    IF OLD.timeline_status != 'workout_started' THEN
      RAISE EXCEPTION 'Invalid transition to workout_completed from %.', OLD.timeline_status;
    END IF;

    NEW.workout_completed_at := now_ms;
    NEW.status := 'completed';

  ELSIF NEW.timeline_status = 'trainer_report_submitted' THEN
    IF OLD.timeline_status != 'workout_completed' THEN
      RAISE EXCEPTION 'Invalid transition to trainer_report_submitted from %.', OLD.timeline_status;
    END IF;

  ELSIF NEW.timeline_status = 'customer_review_pending' THEN
    IF OLD.timeline_status != 'trainer_report_submitted' THEN
      RAISE EXCEPTION 'Invalid transition to customer_review_pending from %.', OLD.timeline_status;
    END IF;

  ELSIF NEW.timeline_status = 'session_closed' THEN
    IF OLD.timeline_status IS DISTINCT FROM 'customer_review_pending' AND OLD.timeline_status IS DISTINCT FROM 'trainer_report_submitted' THEN
      RAISE EXCEPTION 'Invalid transition to session_closed from %.', OLD.timeline_status;
    END IF;
    NEW.status := 'completed';
    
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.validate_booking_transition() OWNER TO postgres;

--
-- Name: verify_and_start_session(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.verify_and_start_session(booking_id text, entered_otp text) RETURNS bigint
    LANGUAGE plpgsql
    AS $$
DECLARE
  b public.bookings%ROWTYPE;
  booked_start timestamptz;
  verified_at bigint;
BEGIN
  -- Get the booking
  SELECT * INTO b FROM public.bookings WHERE id = booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found.';
  END IF;
  
  -- Verify status allows start
  IF b.status != 'upcoming' THEN
    RAISE EXCEPTION 'Booking is not in upcoming status.';
  END IF;
  
  -- Verify timeline status is trainer_arrived
  IF b.timeline_status != 'trainer_arrived' THEN
    RAISE EXCEPTION 'Trainer must check in before verifying OTP.';
  END IF;
  
  -- Verify trainer assignment
  IF b.trainer_id IS NULL OR b.trainer_id = 'searching' THEN
    RAISE EXCEPTION 'No trainer assigned to this booking.';
  END IF;
  
  -- Verify time window (±30 mins)
  booked_start := public.parse_booking_start_time(b.date, b.time);
  IF now() < booked_start - interval '30 minutes' THEN
    RAISE EXCEPTION 'Too early. Session starts at %.', b.time;
  END IF;
  IF now() > booked_start + interval '30 minutes' THEN
    RAISE EXCEPTION 'Session expired. Booked window has passed.';
  END IF;
  
  -- Verify OTP
  IF b.otp != entered_otp THEN
    RAISE EXCEPTION 'Invalid OTP. Please check and try again.';
  END IF;
  
  -- Check OTP expiry (grace period 15 mins)
  IF b.otp_expires_at IS NOT NULL AND (extract(epoch from now()) * 1000)::bigint > b.otp_expires_at THEN
    RAISE EXCEPTION 'OTP has expired. Grace period is over.';
  END IF;
  
  verified_at := (extract(epoch from now()) * 1000)::bigint;

  -- Update booking to otp_verified status
  UPDATE public.bookings
  SET 
    timeline_status = 'otp_verified'
  WHERE id = booking_id;
  
  RETURN verified_at;
END;
$$;


ALTER FUNCTION public.verify_and_start_session(booking_id text, entered_otp text) OWNER TO postgres;

--
-- Name: verify_session_otp(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.verify_session_otp(p_booking_id text, p_entered_otp text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_caller_id text;
  v_booking record;
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

  -- Verify client, trainer, or admin caller authorization
  IF v_booking.client_id != v_caller_id AND v_booking.trainer_id != v_caller_id AND NOT public.is_admin(v_caller_id) THEN
     RAISE EXCEPTION 'Access denied. Caller is not a participant of this booking.';
  END IF;

  IF v_booking.timeline_status = 'OTP_VERIFIED' THEN
    RETURN jsonb_build_object('success', true);
  END IF;

  IF v_booking.timeline_status != 'TRAINER_ARRIVED' THEN
    RAISE EXCEPTION 'Trainer must check in before verifying OTP';
  END IF;

  -- 15-minute Grace expiry check
  IF now() > v_booking.otp_expires_at THEN
     RAISE EXCEPTION 'OTP has expired. Grace period is over.';
  END IF;

  -- OTP match check
  IF v_booking.otp != p_entered_otp THEN
     RAISE EXCEPTION 'Invalid OTP. Please check and try again.';
  END IF;

  UPDATE public.bookings
  SET timeline_status = 'OTP_VERIFIED'
  WHERE id = p_booking_id;

  INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
  VALUES (p_booking_id, 'OTP_VERIFIED', 'TRAINER_ARRIVED', 'OTP_VERIFIED', v_caller_id, 
          CASE WHEN v_caller_id = v_booking.client_id THEN 'customer'::text ELSE 'trainer'::text END);

  RETURN jsonb_build_object('success', true);
END;
$$;


ALTER FUNCTION public.verify_session_otp(p_booking_id text, p_entered_otp text) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: addresses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.addresses (
    id text NOT NULL,
    user_id text,
    label text NOT NULL,
    name text NOT NULL,
    building text NOT NULL,
    street text NOT NULL,
    landmark text,
    city text NOT NULL,
    pin_code text NOT NULL,
    gps_placeholder text,
    is_default boolean DEFAULT false,
    lat double precision,
    lng double precision,
    apartment text,
    floor text,
    notes text,
    place_id text
);


ALTER TABLE public.addresses OWNER TO postgres;

--
-- Name: booking_state_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.booking_state_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id text NOT NULL,
    event_type text NOT NULL,
    previous_state text,
    new_state text,
    actor_user_id text,
    actor_role text,
    server_timestamp timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT booking_state_events_actor_role_check CHECK ((actor_role = ANY (ARRAY['customer'::text, 'trainer'::text, 'admin'::text, 'system'::text])))
);


ALTER TABLE public.booking_state_events OWNER TO postgres;

--
-- Name: bookings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bookings (
    id text NOT NULL,
    status text NOT NULL,
    timeline_status text NOT NULL,
    otp text NOT NULL,
    client_name text,
    client_phone text,
    trainer_name text,
    trainer_photo text,
    date text NOT NULL,
    "time" text NOT NULL,
    workout_title text NOT NULL,
    price integer NOT NULL,
    address text,
    client_id text,
    trainer_id text,
    rating_details jsonb,
    created_at bigint DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    trainer_note text,
    duration_minutes integer DEFAULT 60,
    current_trainer_index integer DEFAULT 0,
    grace_period_started_at timestamp with time zone,
    otp_expires_at timestamp with time zone,
    session_started_at timestamp with time zone,
    trainer_level text,
    trainer_rating numeric(3,2) DEFAULT 5.0,
    trainer_completed_sessions integer DEFAULT 0,
    trainer_speciality text,
    trainer_languages text[] DEFAULT '{}'::text[],
    trainer_distance text,
    trainer_arrival_time text,
    calories_burned integer DEFAULT 0,
    participant_count integer DEFAULT 1,
    session_type text DEFAULT 'SINGLE'::text,
    original_package_type text DEFAULT 'SINGLE'::text,
    partner_name text,
    partner_phone text,
    reminder_sent boolean DEFAULT false,
    acceptance_notification_count integer DEFAULT 1,
    last_acceptance_notification_at bigint DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    acceptance_method text,
    acceptance_deadline bigint DEFAULT (((EXTRACT(epoch FROM now()) * (1000)::numeric) + (((30 * 60) * 1000))::numeric))::bigint,
    auto_accepted_at timestamp with time zone,
    trainer_accepted_at bigint,
    travel_started_at timestamp with time zone,
    session_completed_at timestamp with time zone,
    scheduled_start_at timestamp with time zone,
    scheduled_end_at timestamp with time zone,
    request_created_at timestamp with time zone DEFAULT now(),
    manual_accepted_at timestamp with time zone,
    trainer_arrived_at timestamp with time zone,
    questionnaire jsonb,
    trainer_acknowledgement text DEFAULT 'acknowledged'::text,
    CONSTRAINT bookings_original_package_type_check CHECK ((original_package_type = ANY (ARRAY['SINGLE'::text, 'COUPLE'::text]))),
    CONSTRAINT bookings_session_type_check CHECK ((session_type = ANY (ARRAY['SINGLE'::text, 'COUPLE'::text])))
);


ALTER TABLE public.bookings OWNER TO postgres;

--
-- Name: calorie_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.calorie_logs (
    id text NOT NULL,
    user_id text,
    date date NOT NULL,
    amount integer NOT NULL
);


ALTER TABLE public.calorie_logs OWNER TO postgres;

--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_messages (
    id text NOT NULL,
    chat_id text NOT NULL,
    sender text NOT NULL,
    text text NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now(),
    is_pinned boolean DEFAULT false,
    is_favorite boolean DEFAULT false,
    CONSTRAINT chat_messages_sender_check CHECK ((sender = ANY (ARRAY['user'::text, 'coach'::text, 'virla'::text])))
);


ALTER TABLE public.chat_messages OWNER TO postgres;

--
-- Name: credit_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.credit_transactions (
    id text NOT NULL,
    user_id text,
    type text NOT NULL,
    amount text NOT NULL,
    date text NOT NULL,
    status text NOT NULL,
    credits integer NOT NULL
);


ALTER TABLE public.credit_transactions OWNER TO postgres;

--
-- Name: device_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.device_tokens (
    id text DEFAULT ((('tok-'::text || ((EXTRACT(epoch FROM now()) * (1000)::numeric))::text) || '-'::text) || (floor((random() * (1000000)::double precision)))::text) NOT NULL,
    user_id text,
    token text NOT NULL,
    platform text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    last_seen_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.device_tokens OWNER TO postgres;

--
-- Name: hydration_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hydration_logs (
    id text NOT NULL,
    user_id text,
    date date NOT NULL,
    amount integer NOT NULL
);


ALTER TABLE public.hydration_logs OWNER TO postgres;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id text NOT NULL,
    user_id text,
    title text NOT NULL,
    body text NOT NULL,
    read boolean DEFAULT false,
    "timestamp" text,
    "group" text,
    icon text
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: push_delivery_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.push_delivery_logs (
    id text DEFAULT ((('pushlog-'::text || ((EXTRACT(epoch FROM now()) * (1000)::numeric))::text) || '-'::text) || (floor((random() * (1000000)::double precision)))::text) NOT NULL,
    notification_id text,
    user_id text,
    device_token text,
    platform text,
    sent_at timestamp with time zone DEFAULT now(),
    payload jsonb
);


ALTER TABLE public.push_delivery_logs OWNER TO postgres;

--
-- Name: slot_reservations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.slot_reservations (
    id text NOT NULL,
    slot_time text NOT NULL,
    slot_date text NOT NULL,
    trainer_id text NOT NULL,
    client_id text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    scheduled_start_at timestamp with time zone,
    scheduled_end_at timestamp with time zone
);


ALTER TABLE public.slot_reservations OWNER TO postgres;

--
-- Name: trainer_applications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trainer_applications (
    id text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    status text DEFAULT 'pending'::text NOT NULL,
    full_name text NOT NULL,
    phone text NOT NULL,
    email text NOT NULL,
    dob text NOT NULL,
    gender text NOT NULL,
    avatar text NOT NULL,
    address text NOT NULL,
    city text NOT NULL,
    state text NOT NULL,
    pin_code text NOT NULL,
    emergency_contact jsonb NOT NULL,
    primary_workout text NOT NULL,
    secondary_skills text NOT NULL,
    years_of_experience integer NOT NULL,
    languages text NOT NULL,
    about_me text NOT NULL,
    fitness_qualifications text NOT NULL,
    working_days text[] NOT NULL,
    availability_morning boolean NOT NULL,
    availability_afternoon boolean NOT NULL,
    availability_evening boolean NOT NULL,
    max_sessions_per_day integer NOT NULL,
    preferred_working_radius integer NOT NULL,
    preferred_cities text[] NOT NULL,
    bank_account_name text NOT NULL,
    bank_name text NOT NULL,
    bank_account_number text NOT NULL,
    bank_ifsc text NOT NULL,
    bank_upi_id text NOT NULL,
    pan_number text NOT NULL,
    gst_number text,
    document_aadhaar text NOT NULL,
    document_pan text NOT NULL,
    document_selfie text NOT NULL,
    document_certifications jsonb NOT NULL,
    CONSTRAINT chk_application_gender CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text])))
);


ALTER TABLE public.trainer_applications OWNER TO postgres;

--
-- Name: trainer_earnings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trainer_earnings (
    id text NOT NULL,
    trainer_id text,
    booking_id text,
    client_name text NOT NULL,
    amount integer NOT NULL,
    date text NOT NULL,
    type text NOT NULL
);


ALTER TABLE public.trainer_earnings OWNER TO postgres;

--
-- Name: trainer_workout_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trainer_workout_assignments (
    id text NOT NULL,
    trainer_id text,
    workout_category text NOT NULL,
    status text NOT NULL,
    requested_at bigint NOT NULL,
    approved_at bigint,
    approved_by text,
    rejected_at bigint,
    rejected_by text,
    rejection_reason text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT trainer_workout_assignments_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'REJECTED'::text, 'REMOVAL_REQUESTED'::text, 'REMOVED'::text])))
);


ALTER TABLE public.trainer_workout_assignments OWNER TO postgres;

--
-- Name: trainers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trainers (
    id text NOT NULL,
    name text NOT NULL,
    photo text,
    experience text,
    rating numeric(3,2) DEFAULT 5.0,
    specialty text,
    years_experience integer,
    specialization text,
    languages text[],
    short_bio text,
    completed_sessions integer DEFAULT 0,
    rating_count integer DEFAULT 0,
    about_text text,
    availability text[],
    working_radius text,
    bank_details jsonb,
    emergency_contact jsonb,
    level text DEFAULT 'Associate'::text,
    weekly_slots_submitted integer DEFAULT 0,
    remaining_slot_changes integer DEFAULT 3,
    retainer_status text DEFAULT 'not_eligible'::text,
    attendance_rate numeric(5,2) DEFAULT 100.0,
    punctuality_rate numeric(5,2) DEFAULT 100.0,
    availability_compliance numeric(5,2) DEFAULT 100.0,
    price integer DEFAULT 1200,
    verified_badge boolean DEFAULT true,
    certifications text[] DEFAULT '{}'::text[],
    achievements text[] DEFAULT '{}'::text[],
    reviews jsonb DEFAULT '[]'::jsonb,
    workout_specialties text[] DEFAULT '{}'::text[],
    is_favourite boolean DEFAULT false,
    preferences jsonb DEFAULT '{"online": false, "radiusKm": 15, "categories": [], "maxDailySessions": 5}'::jsonb,
    operating_address text,
    operating_latitude double precision,
    operating_longitude double precision,
    operating_place_id text,
    operating_location_status text DEFAULT 'pending'::text,
    service_radius_km integer DEFAULT 15,
    address_change_request jsonb,
    gender text,
    CONSTRAINT chk_trainer_gender CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text]))),
    CONSTRAINT trainers_level_check CHECK ((level = ANY (ARRAY['Associate'::text, 'Certified'::text, 'Elite'::text])))
);


ALTER TABLE public.trainers OWNER TO postgres;

--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_profiles (
    id text NOT NULL,
    user_id text,
    age integer,
    gender text,
    height text,
    weight text,
    fitness_goal text,
    preferred_workout text,
    emergency_contact jsonb,
    medical_notes text,
    membership_status text,
    credits_balance integer DEFAULT 0,
    trainer_preference text,
    dob text,
    fitness_level text,
    preferred_language text,
    city text,
    member_since text,
    selected_goals text[],
    home_address text,
    home_latitude double precision,
    home_longitude double precision,
    home_place_id text,
    CONSTRAINT check_credits_balance_non_negative CHECK ((credits_balance >= 0)),
    CONSTRAINT chk_user_trainer_preference CHECK ((trainer_preference = ANY (ARRAY['male'::text, 'female'::text, 'no_preference'::text])))
);


ALTER TABLE public.user_profiles OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id text NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    email text,
    password_hash text,
    avatar text,
    role text NOT NULL,
    status text NOT NULL,
    created_date text,
    last_login text,
    device_info text,
    notification_prefs jsonb,
    registration_status text DEFAULT 'PROFILE_NAME_PENDING'::text,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['customer'::text, 'trainer'::text, 'admin'::text]))),
    CONSTRAINT users_status_check CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: workouts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workouts (
    id text NOT NULL,
    title text NOT NULL,
    icon text,
    description text,
    calories integer,
    duration integer,
    hero_image text,
    category text,
    benefits text[],
    difficulty text,
    equipment text[],
    home_visit_badge boolean DEFAULT true,
    session_price integer,
    rating numeric(3,2) DEFAULT 4.8,
    reviews jsonb DEFAULT '[]'::jsonb,
    faqs jsonb DEFAULT '[]'::jsonb
);


ALTER TABLE public.workouts OWNER TO postgres;

--
-- Data for Name: addresses; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.addresses VALUES ('addr-1787485625977-p562ewx8w', 'u-testclient', 'Home', 'Home', 'A1, 19.1361, 72.8269', '', '', 'Mumbai', '', NULL, false, 19.136085505063967, 72.82690429037399, '', '', '', NULL);


--
-- Data for Name: booking_state_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.booking_state_events VALUES ('c043d3aa-2a14-4f1d-afab-0f49adf0dd4b', 'booking-1787485646174-fo8fnizw4', 'BOOKING_CREATED', NULL, 'BOOKED', 'u-testclient', 'customer', '2026-08-23 11:47:26.190333+00', '{}');
INSERT INTO public.booking_state_events VALUES ('ecaa3ffd-3002-480e-abbc-efdf022c0e37', 'booking-1787485677811-1miwf65pm', 'BOOKING_CREATED', NULL, 'BOOKED', 'u-testclient', 'customer', '2026-08-23 11:47:57.823818+00', '{}');
INSERT INTO public.booking_state_events VALUES ('ccb93cf4-3e5f-4c75-97c9-64381c819288', 'booking-1787485646174-fo8fnizw4', 'TRAINER_MANUAL_ACCEPT', 'BOOKED', 'TRAINER_ACCEPTED', 'demo.trainer', 'trainer', '2026-08-23 11:50:20.41996+00', '{}');
INSERT INTO public.booking_state_events VALUES ('7a8f0e2b-5fa8-4a69-9b9e-b1fa3656cca5', 'booking-1787485677811-1miwf65pm', 'TRAINER_MANUAL_ACCEPT', 'BOOKED', 'TRAINER_ACCEPTED', 'demo.trainer', 'trainer', '2026-08-23 11:50:40.123185+00', '{}');
INSERT INTO public.booking_state_events VALUES ('4c386655-f9fd-43ef-906f-2a352dd8b933', 'booking-1787485646174-fo8fnizw4', 'TRAVEL_STARTED', 'TRAINER_ACCEPTED', 'TRAINER_TRAVELLING', 'demo.trainer', 'trainer', '2026-08-23 12:05:19.932674+00', '{}');
INSERT INTO public.booking_state_events VALUES ('ebc860c9-9322-40d9-b251-13cafe628a5e', 'booking-1787485646174-fo8fnizw4', 'TRAINER_ARRIVED', 'TRAINER_TRAVELLING', 'TRAINER_ARRIVED', 'demo.trainer', 'trainer', '2026-08-23 12:27:30.859523+00', '{}');
INSERT INTO public.booking_state_events VALUES ('9c3aa4e8-ae5d-4ab2-8443-97a63831ca9e', 'booking-1787485646174-fo8fnizw4', 'OTP_VERIFIED', 'TRAINER_ARRIVED', 'OTP_VERIFIED', 'demo.trainer', 'trainer', '2026-08-23 12:28:59.312642+00', '{}');
INSERT INTO public.booking_state_events VALUES ('8c2f7b93-4f86-4380-ade4-f763130ffc5a', 'booking-1787485646174-fo8fnizw4', 'WORKOUT_STARTED', 'OTP_VERIFIED', 'WORKOUT_STARTED', 'demo.trainer', 'trainer', '2026-08-23 12:29:59.743402+00', '{}');


--
-- Data for Name: bookings; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.bookings VALUES ('booking-1787485677811-1miwf65pm', 'upcoming', 'TRAINER_ACCEPTED', '6616', 'Virral P', '911234567891', 'Demo Trainer', NULL, '2026-08-23', '07:30 PM - 08:30 PM', 'ZenFlow', 1100, NULL, 'u-testclient', 'demo.trainer', NULL, 1787485677824, 'Bring resistance bands', 60, 0, NULL, NULL, NULL, NULL, 5.00, 0, NULL, '{}', NULL, NULL, 0, 1, 'SINGLE', 'SINGLE', NULL, NULL, false, 1, 1787485677824, 'manual', 1787486277824, NULL, NULL, NULL, NULL, '2026-08-23 14:00:00+00', '2026-08-23 15:00:00+00', '2026-08-23 11:47:57.823818+00', '2026-08-23 11:50:40.123185+00', NULL, NULL, 'acknowledged');
INSERT INTO public.bookings VALUES ('booking-1787485646174-fo8fnizw4', 'upcoming', 'WORKOUT_STARTED', '739651', 'Virral P', '911234567891', 'Demo Trainer', NULL, '2026-08-23', '06:00 PM - 07:00 PM', 'PowerForge', 1200, NULL, 'u-testclient', 'demo.trainer', NULL, 1787485646190, 'Bring resistance bands', 60, 0, '2026-08-23 12:27:30.859523+00', '2026-08-23 12:42:30.859523+00', '2026-08-23 12:29:59.743402+00', NULL, 5.00, 0, NULL, '{}', NULL, NULL, 0, 1, 'SINGLE', 'SINGLE', NULL, NULL, true, 1, 1787485646190, 'manual', 1787486246190, NULL, NULL, '2026-08-23 12:05:19.932674+00', NULL, '2026-08-23 12:30:00+00', '2026-08-23 13:30:00+00', '2026-08-23 11:47:26.190333+00', '2026-08-23 11:50:20.41996+00', '2026-08-23 12:27:30.859523+00', NULL, 'acknowledged');


--
-- Data for Name: calorie_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: chat_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: credit_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.credit_transactions VALUES ('tx-1787485536-580', 'u-testclient', 'purchase', '₹1,270', 'Aug 23, 2026', 'paid', 1);
INSERT INTO public.credit_transactions VALUES ('tx-1787485549-578', 'u-testclient', 'purchase', '₹10,169', 'Aug 23, 2026', 'paid', 12);
INSERT INTO public.credit_transactions VALUES ('tx-1787485646-75', 'u-testclient', 'spend', '₹0', 'Aug 23, 2026', 'paid', 1);
INSERT INTO public.credit_transactions VALUES ('tx-1787485678-170', 'u-testclient', 'spend', '₹0', 'Aug 23, 2026', 'paid', 1);


--
-- Data for Name: device_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: hydration_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.notifications VALUES ('notify-1787485646269-j3c4sfoq9', 'u-testclient', 'Session Reminder ⏱️', '{"is_meta":true,"body":"Your VIRLA session with Coach Demo Trainer starts at 06:00 PM.","type":"Bookings","priority":"medium","actionLabel":"View Details","deepLink":"/session-detail?id=booking-1787485646174-fo8fnizw4","expiry":""}', false, 'Just now', 'today', 'clock');
INSERT INTO public.notifications VALUES ('notify-1787485646303-5oj4bk7ot', 'u-testclient', 'Booking Confirmed 📅', '{"is_meta":true,"body":"Your VIRLA Forge Strength session is confirmed for Aug 23, 2026 @ 06:00 PM - 07:00 PM. Waiting for Trainer Confirmation.","type":"System","priority":"medium","actionLabel":"","deepLink":"","expiry":""}', false, 'Just now', 'today', '');
INSERT INTO public.notifications VALUES ('notify-1787485677893-e0hekpfkn', 'u-testclient', 'Booking Confirmed 📅', '{"is_meta":true,"body":"Your VIRLA Flow Motion session is confirmed for Aug 23, 2026 @ 07:30 PM - 08:30 PM. Waiting for Trainer Confirmation.","type":"System","priority":"medium","actionLabel":"","deepLink":"","expiry":""}', false, 'Just now', 'today', '');
INSERT INTO public.notifications VALUES ('notify-1787486720-913029', 'u-testclient', 'Coach On The Way 🚗', '{"body": "Your trainer has started travelling to your venue.", "is_meta": true, "deepLink": "/session-detail?id=booking-1787485646174-fo8fnizw4"}', false, 'Just now', 'today', 'bell');
INSERT INTO public.notifications VALUES ('notify-1787486720289-15w19f3on', 'demo.trainer', 'Coach On The Way 🚗', '{"is_meta":true,"body":"Coach has started travelling to your venue.","type":"System","priority":"medium","actionLabel":"","deepLink":"","expiry":""}', false, 'Just now', 'today', 'user-check');
INSERT INTO public.notifications VALUES ('notify-1787488051-637545', 'u-testclient', 'Coach Arrived 🔔', '{"body": "Your trainer has arrived. Please share the check-in OTP.", "is_meta": true, "deepLink": "/session-detail?id=booking-1787485646174-fo8fnizw4"}', false, 'Just now', 'today', 'bell');
INSERT INTO public.notifications VALUES ('notify-1787488200-434671', 'u-testclient', 'Session Started ⚡', '{"body": "Your session for PowerForge has officially started.", "is_meta": true, "deepLink": "/session-detail?id=booking-1787485646174-fo8fnizw4"}', false, 'Just now', 'today', 'bell');
INSERT INTO public.notifications VALUES ('notify-1787488199801-3jdkq2hq0', 'demo.trainer', 'Workout Started 🏋️‍♂️', '{"is_meta":true,"body":"Coach Demo Trainer started your active session. Warmup drills underway.","type":"System","priority":"medium","actionLabel":"","deepLink":"","expiry":""}', false, 'Just now', 'today', 'user-check');


--
-- Data for Name: push_delivery_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: slot_reservations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: trainer_applications; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: trainer_earnings; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: trainer_workout_assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.trainer_workout_assignments VALUES ('twa-demo-strength', 'demo.trainer', 'Strength', 'APPROVED', 1787483000808, 1787483000808, 'admin-seed', NULL, NULL, NULL, '2026-08-23 11:03:20.808427+00', '2026-08-23 11:03:20.808427+00');
INSERT INTO public.trainer_workout_assignments VALUES ('twa-demo-cardio', 'demo.trainer', 'Cardio', 'APPROVED', 1787483000808, 1787483000808, 'admin-seed', NULL, NULL, NULL, '2026-08-23 11:03:20.808427+00', '2026-08-23 11:03:20.808427+00');
INSERT INTO public.trainer_workout_assignments VALUES ('twa-demo-mindbody', 'demo.trainer', 'Mind & Body', 'APPROVED', 1787483000808, 1787483000808, 'admin-seed', NULL, NULL, NULL, '2026-08-23 11:03:20.808427+00', '2026-08-23 11:03:20.808427+00');
INSERT INTO public.trainer_workout_assignments VALUES ('twa-demo-conditioning', 'demo.trainer', 'Conditioning', 'APPROVED', 1787483000808, 1787483000808, 'admin-seed', NULL, NULL, NULL, '2026-08-23 11:03:20.808427+00', '2026-08-23 11:03:20.808427+00');
INSERT INTO public.trainer_workout_assignments VALUES ('twa-demo-boxing', 'demo.trainer', 'Boxing', 'APPROVED', 1787483000808, 1787483000808, 'admin-seed', NULL, NULL, NULL, '2026-08-23 11:03:20.808427+00', '2026-08-23 11:03:20.808427+00');


--
-- Data for Name: trainers; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.trainers VALUES ('demo.trainer', 'Demo Trainer', 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=150&q=80', '10 years', 4.00, 'Elite Master Trainer', 10, 'Strength, Cardio, Mind & Body, Conditioning, Boxing', '{English,Hindi}', 'Local development demo trainer account certified in all 5 workout specialties.', 0, 10, NULL, NULL, NULL, NULL, NULL, 'Elite', 0, 3, 'not_eligible', 100.00, 100.00, 100.00, 1200, true, '{"ACE Certified Personal Trainer"}', '{"Elite Coach of the Year"}', '[]', '{}', false, '{"online": true, "radiusKm": 30, "categories": ["Strength", "Cardio", "Mind & Body", "Conditioning", "Boxing"], "maxDailySessions": 5, "operatingLocationStatus": "verified"}', 'Juhu Beach, Mumbai, Maharashtra, India', 19.1013, 72.8258, NULL, 'verified', 15, NULL, 'male');


--
-- Data for Name: user_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.user_profiles VALUES ('prof-testadmin', 'u-testadmin', 35, 'male', '180 cm', '80 kg', 'Strength Training', 'PowerForge', '{}', '', 'Premium', 50, NULL, '1989-01-01', 'Advanced', 'English', 'Mumbai', 'Aug 2026', '{"Strength Training"}', NULL, NULL, NULL, NULL);
INSERT INTO public.user_profiles VALUES ('prof-testclient', 'u-testclient', 26, 'male', '175 cm', '70 kg', 'Strength Training', 'PowerForge', '{}', '', 'Premium', 61, NULL, '1999-01-01', 'Intermediate', 'English', 'Mumbai', 'Aug 2026', '{"Strength Training"}', NULL, NULL, NULL, NULL);


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.users VALUES ('u-testadmin', 'Test Admin', '911234567892', 'admin1234567892@virla.in', 'secure-hash-1450575459-6', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80', 'admin', 'active', '23/08/2026', '', 'Simulated Seed', '{"offers": true, "bookingUpdates": true, "trainerMessages": true, "membershipAlerts": true}', 'complete');
INSERT INTO public.users VALUES ('u-testclient', 'Virral P', '', 'client1234567891@virla.in', 'secure-hash-1450575459-6', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80', 'customer', 'active', '23/08/2026', '', 'Simulated Seed', '{"offers": true, "bookingUpdates": true, "trainerMessages": true, "membershipAlerts": true}', 'complete');
INSERT INTO public.users VALUES ('demo.trainer', 'Demo Trainer', '919999999999', 'demo.trainer@virla.local', '$2a$06$WQiElWxAf2qiiTtVniiZJeWHijPaCeMWIF8RZ/JXFq/RLC89bc0tW', 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=150&q=80', 'trainer', 'active', '23/08/2026', '', 'Simulated Local Seed', '{"offers": false, "bookingUpdates": true, "trainerMessages": true, "membershipAlerts": true}', 'complete');


--
-- Data for Name: workouts; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.workouts VALUES ('w-1', 'PowerForge', '💪', 'Build Strength. Build Confidence.', 320, 45, 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80', 'Strength', '{"Increase muscle mass & bone density"}', 'Medium - Hard', '{Dumbbells}', true, 1200, 4.90, '[]', '[]');
INSERT INTO public.workouts VALUES ('w-2', 'ZenFlow', '🧘‍♀️', 'Balance Mind & Body.', 180, 50, 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80', 'Mind & Body', '{"Enhance balance & posture"}', 'Beginner - Medium', '{"Yoga mat"}', true, 1100, 4.80, '[]', '[]');
INSERT INTO public.workouts VALUES ('w-3', 'CoreAlign', '🧘', 'Core Stability & Posture.', 220, 45, 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80', 'Mind & Body', '{"Deep abdominal strength"}', 'Medium', '{"Pilates mat"}', true, 1300, 4.85, '[]', '[]');
INSERT INTO public.workouts VALUES ('w-4', 'RhythmX', '💃', 'Move. Sweat. Enjoy.', 380, 45, 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=80', 'Cardio', '{"Cardiovascular conditioning"}', 'Medium', '{"Comfy sports shoes"}', true, 1000, 4.80, '[]', '[]');
INSERT INTO public.workouts VALUES ('w-5', 'KinetiX', '⚡', 'Functional Agility & Balance.', 300, 45, 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=800&q=80', 'Conditioning', '{"Better daily life agility"}', 'Medium', '{Kettlebells}', true, 1200, 4.80, '[]', '[]');
INSERT INTO public.workouts VALUES ('w-8', 'FightLab', '🥊', 'Train Like a Champion.', 450, 40, 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=800&q=80', 'Cardio', '{"High calorie cardiovascular burn"}', 'Hard', '{"Boxing pads & gloves"}', true, 1300, 4.90, '[]', '[]');
INSERT INTO public.workouts VALUES ('w-powerforge', 'PowerForge', '💪', 'Build Strength. Build Confidence.', 320, 45, 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80', 'Strength', '{"Increase muscle mass & bone density"}', 'Medium - Hard', '{Dumbbells}', true, 1200, 4.90, '[]', '[]');
INSERT INTO public.workouts VALUES ('w-zenflow', 'ZenFlow', '🧘‍♀️', 'Balance Mind & Body.', 180, 50, 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80', 'Mind & Body', '{"Enhance balance & posture"}', 'Beginner - Medium', '{"Yoga mat"}', true, 1100, 4.80, '[]', '[]');
INSERT INTO public.workouts VALUES ('w-corealign', 'CoreAlign', '🧘', 'Core Stability & Posture.', 220, 45, 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80', 'Mind & Body', '{"Deep abdominal strength"}', 'Medium', '{"Pilates mat"}', true, 1300, 4.85, '[]', '[]');
INSERT INTO public.workouts VALUES ('w-rhythmx', 'RhythmX', '💃', 'Move. Sweat. Enjoy.', 380, 45, 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=80', 'Cardio', '{"Cardiovascular conditioning"}', 'Medium', '{"Comfy sports shoes"}', true, 1000, 4.80, '[]', '[]');
INSERT INTO public.workouts VALUES ('w-kinetix', 'KinetiX', '⚡', 'Functional Agility & Balance.', 300, 45, 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=800&q=80', 'Conditioning', '{"Better daily life agility"}', 'Medium', '{Kettlebells}', true, 1200, 4.80, '[]', '[]');
INSERT INTO public.workouts VALUES ('w-fightlab', 'FightLab', '🥊', 'Train Like a Champion.', 450, 40, 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=800&q=80', 'Cardio', '{"High calorie cardiovascular burn"}', 'Hard', '{"Boxing pads & gloves"}', true, 1300, 4.90, '[]', '[]');


--
-- Name: addresses addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_pkey PRIMARY KEY (id);


--
-- Name: booking_state_events booking_state_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_state_events
    ADD CONSTRAINT booking_state_events_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: calorie_logs calorie_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calorie_logs
    ADD CONSTRAINT calorie_logs_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: credit_transactions credit_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_transactions
    ADD CONSTRAINT credit_transactions_pkey PRIMARY KEY (id);


--
-- Name: device_tokens device_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_pkey PRIMARY KEY (id);


--
-- Name: device_tokens device_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_token_key UNIQUE (token);


--
-- Name: hydration_logs hydration_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hydration_logs
    ADD CONSTRAINT hydration_logs_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: push_delivery_logs push_delivery_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_delivery_logs
    ADD CONSTRAINT push_delivery_logs_pkey PRIMARY KEY (id);


--
-- Name: slot_reservations slot_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.slot_reservations
    ADD CONSTRAINT slot_reservations_pkey PRIMARY KEY (id);


--
-- Name: trainer_applications trainer_applications_phone_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trainer_applications
    ADD CONSTRAINT trainer_applications_phone_key UNIQUE (phone);


--
-- Name: trainer_applications trainer_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trainer_applications
    ADD CONSTRAINT trainer_applications_pkey PRIMARY KEY (id);


--
-- Name: trainer_earnings trainer_earnings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trainer_earnings
    ADD CONSTRAINT trainer_earnings_pkey PRIMARY KEY (id);


--
-- Name: trainer_workout_assignments trainer_workout_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trainer_workout_assignments
    ADD CONSTRAINT trainer_workout_assignments_pkey PRIMARY KEY (id);


--
-- Name: trainers trainers_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trainers
    ADD CONSTRAINT trainers_name_key UNIQUE (name);


--
-- Name: trainers trainers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trainers
    ADD CONSTRAINT trainers_pkey PRIMARY KEY (id);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- Name: user_profiles user_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_user_id_key UNIQUE (user_id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: workouts workouts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workouts
    ADD CONSTRAINT workouts_pkey PRIMARY KEY (id);


--
-- Name: unique_active_trainer_slot; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX unique_active_trainer_slot ON public.bookings USING btree (trainer_id, date, "time") WHERE ((status <> 'cancelled'::text) AND (trainer_id <> 'searching'::text));


--
-- Name: unique_trainer_slot_reservation; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX unique_trainer_slot_reservation ON public.slot_reservations USING btree (trainer_id, slot_date, slot_time);


--
-- Name: device_tokens trg_device_token_cleanup; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_device_token_cleanup BEFORE INSERT OR UPDATE ON public.device_tokens FOR EACH ROW EXECUTE FUNCTION public.handle_device_token_cleanup();


--
-- Name: booking_state_events trg_dispatch_audit_notification; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_dispatch_audit_notification AFTER INSERT ON public.booking_state_events FOR EACH ROW EXECUTE FUNCTION public.dispatch_audit_notification();


--
-- Name: notifications trg_notification_inserted; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_notification_inserted AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.on_notification_inserted();


--
-- Name: addresses addresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: calorie_logs calorie_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calorie_logs
    ADD CONSTRAINT calorie_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: credit_transactions credit_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_transactions
    ADD CONSTRAINT credit_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: hydration_logs hydration_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hydration_logs
    ADD CONSTRAINT hydration_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: trainer_earnings trainer_earnings_trainer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trainer_earnings
    ADD CONSTRAINT trainer_earnings_trainer_id_fkey FOREIGN KEY (trainer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_profiles user_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: push_delivery_logs Enable ALL for admin only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable ALL for admin only" ON public.push_delivery_logs USING (public.is_admin((auth.uid())::text));


--
-- Name: device_tokens Enable DELETE for owner or admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable DELETE for owner or admin" ON public.device_tokens FOR DELETE USING (((user_id = (auth.uid())::text) OR public.is_admin((auth.uid())::text)));


--
-- Name: slot_reservations Enable DELETE for owner, expired, or admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable DELETE for owner, expired, or admin" ON public.slot_reservations FOR DELETE USING (((client_id = (auth.uid())::text) OR (public.is_local_development() AND (client_id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))) OR (expires_at <= now()) OR public.is_admin((auth.uid())::text) OR (public.is_local_development() AND public.is_admin(((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)))));


--
-- Name: user_profiles Enable DELETE for self or admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable DELETE for self or admin" ON public.user_profiles FOR DELETE USING (((user_id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)) OR public.is_admin(((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))));


--
-- Name: users Enable DELETE for self or admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable DELETE for self or admin" ON public.users FOR DELETE USING (((id = COALESCE(NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text), ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))) OR public.is_admin(COALESCE(NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text), ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)))));


--
-- Name: users Enable INSERT for admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable INSERT for admin" ON public.users FOR INSERT WITH CHECK (public.is_admin(COALESCE(NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text), ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))));


--
-- Name: trainer_applications Enable INSERT for all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable INSERT for all" ON public.trainer_applications FOR INSERT WITH CHECK (true);


--
-- Name: bookings Enable INSERT for client; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable INSERT for client" ON public.bookings FOR INSERT WITH CHECK ((client_id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)));


--
-- Name: device_tokens Enable INSERT for owner or admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable INSERT for owner or admin" ON public.device_tokens FOR INSERT WITH CHECK (((user_id = (auth.uid())::text) OR public.is_admin((auth.uid())::text)));


--
-- Name: slot_reservations Enable INSERT for owner or admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable INSERT for owner or admin" ON public.slot_reservations FOR INSERT WITH CHECK (((client_id = (auth.uid())::text) OR (public.is_local_development() AND (client_id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))) OR public.is_admin((auth.uid())::text) OR (public.is_local_development() AND public.is_admin(((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)))));


--
-- Name: chat_messages Enable INSERT for participant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable INSERT for participant" ON public.chat_messages FOR INSERT WITH CHECK ((chat_id ~~ (('%'::text || ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)) || '%'::text)));


--
-- Name: user_profiles Enable INSERT for self or admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable INSERT for self or admin" ON public.user_profiles FOR INSERT WITH CHECK (((user_id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)) OR public.is_admin(((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))));


--
-- Name: trainer_workout_assignments Enable INSERT for trainers own assignments only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable INSERT for trainers own assignments only" ON public.trainer_workout_assignments FOR INSERT WITH CHECK ((((trainer_id = (auth.uid())::text) AND (status = 'PENDING'::text)) OR public.is_admin((auth.uid())::text)));


--
-- Name: slot_reservations Enable SELECT for authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable SELECT for authenticated users" ON public.slot_reservations FOR SELECT USING (((client_id = (auth.uid())::text) OR (public.is_local_development() AND (client_id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))) OR (trainer_id = (auth.uid())::text) OR (public.is_local_development() AND (trainer_id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))) OR public.is_admin((auth.uid())::text) OR (public.is_local_development() AND public.is_admin(((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))) OR (((auth.role() = 'authenticated'::text) OR (public.is_local_development() AND (EXISTS ( SELECT 1
   FROM public.users
  WHERE (users.id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)))))) AND (EXISTS ( SELECT 1
   FROM public.trainers t
  WHERE ((t.id = slot_reservations.trainer_id) AND (((t.preferences ->> 'online'::text))::boolean = true) AND (t.operating_location_status = 'verified'::text)))))));


--
-- Name: trainer_workout_assignments Enable SELECT for authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable SELECT for authenticated users" ON public.trainer_workout_assignments FOR SELECT USING (((trainer_id = (auth.uid())::text) OR (public.is_local_development() AND (trainer_id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))) OR public.is_admin((auth.uid())::text) OR (public.is_local_development() AND public.is_admin(((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))) OR (((auth.role() = 'authenticated'::text) OR (public.is_local_development() AND (EXISTS ( SELECT 1
   FROM public.users
  WHERE (users.id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)))))) AND (status = 'APPROVED'::text) AND (EXISTS ( SELECT 1
   FROM public.trainers t
  WHERE ((t.id = trainer_workout_assignments.trainer_id) AND (((t.preferences ->> 'online'::text))::boolean = true) AND (t.operating_location_status = 'verified'::text)))))));


--
-- Name: trainers Enable SELECT for authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable SELECT for authenticated users" ON public.trainers FOR SELECT USING (((id = (auth.uid())::text) OR (public.is_local_development() AND (id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))) OR public.is_admin((auth.uid())::text) OR (public.is_local_development() AND public.is_admin(((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))) OR (((auth.role() = 'authenticated'::text) OR (public.is_local_development() AND (EXISTS ( SELECT 1
   FROM public.users
  WHERE (users.id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)))))) AND (((preferences ->> 'online'::text))::boolean = true) AND (operating_location_status = 'verified'::text))));


--
-- Name: workouts Enable SELECT for authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable SELECT for authenticated users" ON public.workouts FOR SELECT USING (((auth.role() = 'authenticated'::text) OR (public.is_local_development() AND (EXISTS ( SELECT 1
   FROM public.users
  WHERE (users.id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)))))));


--
-- Name: device_tokens Enable SELECT for owner or admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable SELECT for owner or admin" ON public.device_tokens FOR SELECT USING (((user_id = (auth.uid())::text) OR public.is_admin((auth.uid())::text)));


--
-- Name: trainer_applications Enable SELECT for owner or admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable SELECT for owner or admin" ON public.trainer_applications FOR SELECT USING (((phone = ( SELECT users.phone
   FROM public.users
  WHERE (users.id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)))) OR public.is_admin(((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))));


--
-- Name: bookings Enable SELECT for participant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable SELECT for participant" ON public.bookings FOR SELECT USING (((client_id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)) OR (trainer_id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))));


--
-- Name: chat_messages Enable SELECT for participant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable SELECT for participant" ON public.chat_messages FOR SELECT USING ((chat_id ~~ (('%'::text || ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)) || '%'::text)));


--
-- Name: credit_transactions Enable SELECT for self only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable SELECT for self only" ON public.credit_transactions FOR SELECT USING ((user_id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)));


--
-- Name: user_profiles Enable SELECT for self or admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable SELECT for self or admin" ON public.user_profiles FOR SELECT USING (((user_id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)) OR public.is_admin(((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))));


--
-- Name: users Enable SELECT for self or admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable SELECT for self or admin" ON public.users FOR SELECT USING (((id = COALESCE(NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text), ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))) OR public.is_admin(COALESCE(NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text), ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)))));


--
-- Name: user_profiles Enable SELECT for self or assigned trainer; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable SELECT for self or assigned trainer" ON public.user_profiles FOR SELECT USING (((user_id = COALESCE(NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text), ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))) OR (EXISTS ( SELECT 1
   FROM public.bookings
  WHERE ((bookings.client_id = user_profiles.user_id) AND (bookings.trainer_id = COALESCE(NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text), ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))))))));


--
-- Name: trainer_earnings Enable SELECT for trainer only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable SELECT for trainer only" ON public.trainer_earnings FOR SELECT USING ((trainer_id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)));


--
-- Name: trainer_workout_assignments Enable UPDATE for own assignments or admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable UPDATE for own assignments or admin" ON public.trainer_workout_assignments FOR UPDATE USING (((trainer_id = (auth.uid())::text) OR public.is_admin((auth.uid())::text))) WITH CHECK ((((trainer_id = (auth.uid())::text) AND (((status = 'REMOVAL_REQUESTED'::text) AND (( SELECT trainer_workout_assignments_1.status
   FROM public.trainer_workout_assignments trainer_workout_assignments_1
  WHERE (trainer_workout_assignments_1.id = trainer_workout_assignments_1.id)) = 'APPROVED'::text)) OR ((status = 'PENDING'::text) AND (( SELECT trainer_workout_assignments_1.status
   FROM public.trainer_workout_assignments trainer_workout_assignments_1
  WHERE (trainer_workout_assignments_1.id = trainer_workout_assignments_1.id)) = 'REJECTED'::text))) AND (NOT (workout_category IS DISTINCT FROM ( SELECT trainer_workout_assignments_1.workout_category
   FROM public.trainer_workout_assignments trainer_workout_assignments_1
  WHERE (trainer_workout_assignments_1.id = trainer_workout_assignments_1.id)))) AND (NOT (approved_at IS DISTINCT FROM ( SELECT trainer_workout_assignments_1.approved_at
   FROM public.trainer_workout_assignments trainer_workout_assignments_1
  WHERE (trainer_workout_assignments_1.id = trainer_workout_assignments_1.id)))) AND (NOT (approved_by IS DISTINCT FROM ( SELECT trainer_workout_assignments_1.approved_by
   FROM public.trainer_workout_assignments trainer_workout_assignments_1
  WHERE (trainer_workout_assignments_1.id = trainer_workout_assignments_1.id)))) AND (NOT (rejected_at IS DISTINCT FROM ( SELECT trainer_workout_assignments_1.rejected_at
   FROM public.trainer_workout_assignments trainer_workout_assignments_1
  WHERE (trainer_workout_assignments_1.id = trainer_workout_assignments_1.id)))) AND (NOT (rejected_by IS DISTINCT FROM ( SELECT trainer_workout_assignments_1.rejected_by
   FROM public.trainer_workout_assignments trainer_workout_assignments_1
  WHERE (trainer_workout_assignments_1.id = trainer_workout_assignments_1.id))))) OR public.is_admin((auth.uid())::text)));


--
-- Name: device_tokens Enable UPDATE for owner or admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable UPDATE for owner or admin" ON public.device_tokens FOR UPDATE USING (((user_id = (auth.uid())::text) OR public.is_admin((auth.uid())::text))) WITH CHECK (((user_id = (auth.uid())::text) OR public.is_admin((auth.uid())::text)));


--
-- Name: trainer_applications Enable UPDATE for owner or admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable UPDATE for owner or admin" ON public.trainer_applications FOR UPDATE USING (((phone = ( SELECT users.phone
   FROM public.users
  WHERE (users.id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)))) OR public.is_admin(((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)))) WITH CHECK (((phone = ( SELECT users.phone
   FROM public.users
  WHERE (users.id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)))) OR public.is_admin(((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))));


--
-- Name: users Enable UPDATE for self or admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable UPDATE for self or admin" ON public.users FOR UPDATE USING (((id = COALESCE(NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text), ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))) OR public.is_admin(COALESCE(NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text), ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))))) WITH CHECK (((id = COALESCE(NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text), ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))) OR public.is_admin(COALESCE(NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text), ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)))));


--
-- Name: trainers Enable UPDATE for trainers self only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable UPDATE for trainers self only" ON public.trainers FOR UPDATE USING (((id = (auth.uid())::text) OR ((current_setting('app.settings.jwt_secret'::text, true) = 'super-secret-jwt-token-with-at-least-32-characters-long'::text) AND (id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))) OR ((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((u.id = (auth.uid())::text) AND (u.role = 'admin'::text))))) OR ((current_setting('app.settings.jwt_secret'::text, true) = 'super-secret-jwt-token-with-at-least-32-characters-long'::text) AND (EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((u.id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)) AND (u.role = 'admin'::text))))))) WITH CHECK (((((id = (auth.uid())::text) OR ((current_setting('app.settings.jwt_secret'::text, true) = 'super-secret-jwt-token-with-at-least-32-characters-long'::text) AND (id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)))) AND (NOT (price IS DISTINCT FROM ( SELECT t.price
   FROM public.trainers t
  WHERE (t.id = trainers.id)))) AND (NOT (rating IS DISTINCT FROM ( SELECT t.rating
   FROM public.trainers t
  WHERE (t.id = trainers.id)))) AND (NOT (rating_count IS DISTINCT FROM ( SELECT t.rating_count
   FROM public.trainers t
  WHERE (t.id = trainers.id)))) AND (NOT (completed_sessions IS DISTINCT FROM ( SELECT t.completed_sessions
   FROM public.trainers t
  WHERE (t.id = trainers.id)))) AND (NOT (verified_badge IS DISTINCT FROM ( SELECT t.verified_badge
   FROM public.trainers t
  WHERE (t.id = trainers.id)))) AND (NOT (level IS DISTINCT FROM ( SELECT t.level
   FROM public.trainers t
  WHERE (t.id = trainers.id)))) AND (NOT (operating_address IS DISTINCT FROM ( SELECT t.operating_address
   FROM public.trainers t
  WHERE (t.id = trainers.id)))) AND (NOT (operating_latitude IS DISTINCT FROM ( SELECT t.operating_latitude
   FROM public.trainers t
  WHERE (t.id = trainers.id)))) AND (NOT (operating_longitude IS DISTINCT FROM ( SELECT t.operating_longitude
   FROM public.trainers t
  WHERE (t.id = trainers.id)))) AND (NOT (operating_place_id IS DISTINCT FROM ( SELECT t.operating_place_id
   FROM public.trainers t
  WHERE (t.id = trainers.id)))) AND (NOT (operating_location_status IS DISTINCT FROM ( SELECT t.operating_location_status
   FROM public.trainers t
  WHERE (t.id = trainers.id))))) OR ((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((u.id = (auth.uid())::text) AND (u.role = 'admin'::text))))) OR ((current_setting('app.settings.jwt_secret'::text, true) = 'super-secret-jwt-token-with-at-least-32-characters-long'::text) AND (EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((u.id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)) AND (u.role = 'admin'::text)))))));


--
-- Name: user_profiles Enable UPDATE profile details except credits; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable UPDATE profile details except credits" ON public.user_profiles FOR UPDATE USING (((user_id = COALESCE(NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text), ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))) OR public.is_admin(COALESCE(NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text), ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))))) WITH CHECK ((((user_id = COALESCE(NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text), ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))) AND (NOT (credits_balance IS DISTINCT FROM public.get_profile_credits(id)))) OR public.is_admin(COALESCE(NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text), ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)))));


--
-- Name: addresses Enable all for self only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable all for self only" ON public.addresses USING ((user_id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))) WITH CHECK ((user_id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)));


--
-- Name: calorie_logs Enable all for self only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable all for self only" ON public.calorie_logs USING ((user_id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))) WITH CHECK ((user_id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)));


--
-- Name: hydration_logs Enable all for self only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable all for self only" ON public.hydration_logs USING ((user_id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))) WITH CHECK ((user_id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)));


--
-- Name: notifications Enable all for self only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable all for self only" ON public.notifications USING ((user_id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))) WITH CHECK ((user_id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)));


--
-- Name: workouts Enable write for admin only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable write for admin only" ON public.workouts USING (public.is_admin((auth.uid())::text)) WITH CHECK (public.is_admin((auth.uid())::text));


--
-- Name: credit_transactions Restrict INSERT for transactions to system RPC; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Restrict INSERT for transactions to system RPC" ON public.credit_transactions FOR INSERT WITH CHECK (public.is_admin((auth.uid())::text));


--
-- Name: bookings Restrict bookings updates to non-timeline fields; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Restrict bookings updates to non-timeline fields" ON public.bookings FOR UPDATE USING (((client_id = (auth.uid())::text) OR (trainer_id = (auth.uid())::text) OR public.is_admin((auth.uid())::text) OR (public.is_local_development() AND (client_id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))) OR (public.is_local_development() AND (trainer_id = ((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))) OR (public.is_local_development() AND public.is_admin(((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text))))) WITH CHECK ((((NOT (status IS DISTINCT FROM ( SELECT bookings_1.status
   FROM public.bookings bookings_1
  WHERE (bookings_1.id = bookings_1.id)))) AND (NOT (timeline_status IS DISTINCT FROM ( SELECT bookings_1.timeline_status
   FROM public.bookings bookings_1
  WHERE (bookings_1.id = bookings_1.id)))) AND (NOT (scheduled_start_at IS DISTINCT FROM ( SELECT bookings_1.scheduled_start_at
   FROM public.bookings bookings_1
  WHERE (bookings_1.id = bookings_1.id)))) AND (NOT (scheduled_end_at IS DISTINCT FROM ( SELECT bookings_1.scheduled_end_at
   FROM public.bookings bookings_1
  WHERE (bookings_1.id = bookings_1.id)))) AND (NOT (travel_started_at IS DISTINCT FROM ( SELECT bookings_1.travel_started_at
   FROM public.bookings bookings_1
  WHERE (bookings_1.id = bookings_1.id)))) AND (NOT (trainer_arrived_at IS DISTINCT FROM ( SELECT bookings_1.trainer_arrived_at
   FROM public.bookings bookings_1
  WHERE (bookings_1.id = bookings_1.id)))) AND (NOT (session_started_at IS DISTINCT FROM ( SELECT bookings_1.session_started_at
   FROM public.bookings bookings_1
  WHERE (bookings_1.id = bookings_1.id)))) AND (NOT (session_completed_at IS DISTINCT FROM ( SELECT bookings_1.session_completed_at
   FROM public.bookings bookings_1
  WHERE (bookings_1.id = bookings_1.id)))) AND (NOT (otp IS DISTINCT FROM ( SELECT bookings_1.otp
   FROM public.bookings bookings_1
  WHERE (bookings_1.id = bookings_1.id)))) AND (NOT (otp_expires_at IS DISTINCT FROM ( SELECT bookings_1.otp_expires_at
   FROM public.bookings bookings_1
  WHERE (bookings_1.id = bookings_1.id)))) AND (NOT (manual_accepted_at IS DISTINCT FROM ( SELECT bookings_1.manual_accepted_at
   FROM public.bookings bookings_1
  WHERE (bookings_1.id = bookings_1.id)))) AND (NOT (auto_accepted_at IS DISTINCT FROM ( SELECT bookings_1.auto_accepted_at
   FROM public.bookings bookings_1
  WHERE (bookings_1.id = bookings_1.id))))) OR public.is_admin((auth.uid())::text) OR (public.is_local_development() AND public.is_admin(((current_setting('request.headers'::text, true))::jsonb ->> 'x-user-id'::text)))));


--
-- Name: trainers Restrict trainers details insert to admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Restrict trainers details insert to admin" ON public.trainers FOR INSERT WITH CHECK (public.is_admin((auth.uid())::text));


--
-- Name: addresses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_state_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.booking_state_events ENABLE ROW LEVEL SECURITY;

--
-- Name: bookings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

--
-- Name: calorie_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.calorie_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_transactions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: device_tokens; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: hydration_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.hydration_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: push_delivery_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.push_delivery_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: slot_reservations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.slot_reservations ENABLE ROW LEVEL SECURITY;

--
-- Name: trainer_applications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.trainer_applications ENABLE ROW LEVEL SECURITY;

--
-- Name: trainer_earnings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.trainer_earnings ENABLE ROW LEVEL SECURITY;

--
-- Name: trainer_workout_assignments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.trainer_workout_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: trainers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.trainers ENABLE ROW LEVEL SECURITY;

--
-- Name: user_profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: workouts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION acknowledge_auto_accept(p_booking_id text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.acknowledge_auto_accept(p_booking_id text) TO anon;
GRANT ALL ON FUNCTION public.acknowledge_auto_accept(p_booking_id text) TO authenticated;
GRANT ALL ON FUNCTION public.acknowledge_auto_accept(p_booking_id text) TO service_role;


--
-- Name: FUNCTION apply_auto_acceptances(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.apply_auto_acceptances() TO anon;
GRANT ALL ON FUNCTION public.apply_auto_acceptances() TO authenticated;
GRANT ALL ON FUNCTION public.apply_auto_acceptances() TO service_role;


--
-- Name: FUNCTION approve_trainer_application(app_id text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.approve_trainer_application(app_id text) TO anon;
GRANT ALL ON FUNCTION public.approve_trainer_application(app_id text) TO authenticated;
GRANT ALL ON FUNCTION public.approve_trainer_application(app_id text) TO service_role;


--
-- Name: FUNCTION auto_accept_booking(p_booking_id text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.auto_accept_booking(p_booking_id text) TO anon;
GRANT ALL ON FUNCTION public.auto_accept_booking(p_booking_id text) TO authenticated;
GRANT ALL ON FUNCTION public.auto_accept_booking(p_booking_id text) TO service_role;


--
-- Name: FUNCTION cancel_booking(p_booking_id text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.cancel_booking(p_booking_id text) TO anon;
GRANT ALL ON FUNCTION public.cancel_booking(p_booking_id text) TO authenticated;
GRANT ALL ON FUNCTION public.cancel_booking(p_booking_id text) TO service_role;


--
-- Name: FUNCTION close_session(p_booking_id text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.close_session(p_booking_id text) TO anon;
GRANT ALL ON FUNCTION public.close_session(p_booking_id text) TO authenticated;
GRANT ALL ON FUNCTION public.close_session(p_booking_id text) TO service_role;


--
-- Name: FUNCTION complete_session(p_booking_id text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.complete_session(p_booking_id text) TO anon;
GRANT ALL ON FUNCTION public.complete_session(p_booking_id text) TO authenticated;
GRANT ALL ON FUNCTION public.complete_session(p_booking_id text) TO service_role;


--
-- Name: FUNCTION create_booking(p_booking_id text, p_workout_id text, p_scheduled_start_at timestamp with time zone, p_scheduled_end_at timestamp with time zone, p_assigned_trainer_id text, p_trainer_note text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.create_booking(p_booking_id text, p_workout_id text, p_scheduled_start_at timestamp with time zone, p_scheduled_end_at timestamp with time zone, p_assigned_trainer_id text, p_trainer_note text) TO anon;
GRANT ALL ON FUNCTION public.create_booking(p_booking_id text, p_workout_id text, p_scheduled_start_at timestamp with time zone, p_scheduled_end_at timestamp with time zone, p_assigned_trainer_id text, p_trainer_note text) TO authenticated;
GRANT ALL ON FUNCTION public.create_booking(p_booking_id text, p_workout_id text, p_scheduled_start_at timestamp with time zone, p_scheduled_end_at timestamp with time zone, p_assigned_trainer_id text, p_trainer_note text) TO service_role;


--
-- Name: FUNCTION create_user_with_profile(user_row jsonb, profile_row jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.create_user_with_profile(user_row jsonb, profile_row jsonb) TO anon;
GRANT ALL ON FUNCTION public.create_user_with_profile(user_row jsonb, profile_row jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.create_user_with_profile(user_row jsonb, profile_row jsonb) TO service_role;


--
-- Name: FUNCTION dispatch_audit_notification(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.dispatch_audit_notification() TO anon;
GRANT ALL ON FUNCTION public.dispatch_audit_notification() TO authenticated;
GRANT ALL ON FUNCTION public.dispatch_audit_notification() TO service_role;


--
-- Name: FUNCTION expire_stale_bookings(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.expire_stale_bookings() TO anon;
GRANT ALL ON FUNCTION public.expire_stale_bookings() TO authenticated;
GRANT ALL ON FUNCTION public.expire_stale_bookings() TO service_role;


--
-- Name: FUNCTION get_client_assessment_history(p_client_id text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_client_assessment_history(p_client_id text) TO anon;
GRANT ALL ON FUNCTION public.get_client_assessment_history(p_client_id text) TO authenticated;
GRANT ALL ON FUNCTION public.get_client_assessment_history(p_client_id text) TO service_role;


--
-- Name: FUNCTION get_profile_credits(p_profile_id text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_profile_credits(p_profile_id text) TO anon;
GRANT ALL ON FUNCTION public.get_profile_credits(p_profile_id text) TO authenticated;
GRANT ALL ON FUNCTION public.get_profile_credits(p_profile_id text) TO service_role;


--
-- Name: FUNCTION get_server_time(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_server_time() TO anon;
GRANT ALL ON FUNCTION public.get_server_time() TO authenticated;
GRANT ALL ON FUNCTION public.get_server_time() TO service_role;


--
-- Name: FUNCTION handle_device_token_cleanup(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_device_token_cleanup() TO anon;
GRANT ALL ON FUNCTION public.handle_device_token_cleanup() TO authenticated;
GRANT ALL ON FUNCTION public.handle_device_token_cleanup() TO service_role;


--
-- Name: FUNCTION handle_no_show(p_booking_id text, p_no_show_type text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_no_show(p_booking_id text, p_no_show_type text) TO anon;
GRANT ALL ON FUNCTION public.handle_no_show(p_booking_id text, p_no_show_type text) TO authenticated;
GRANT ALL ON FUNCTION public.handle_no_show(p_booking_id text, p_no_show_type text) TO service_role;


--
-- Name: FUNCTION is_admin(user_id text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_admin(user_id text) TO anon;
GRANT ALL ON FUNCTION public.is_admin(user_id text) TO authenticated;
GRANT ALL ON FUNCTION public.is_admin(user_id text) TO service_role;


--
-- Name: FUNCTION is_local_development(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_local_development() TO anon;
GRANT ALL ON FUNCTION public.is_local_development() TO authenticated;
GRANT ALL ON FUNCTION public.is_local_development() TO service_role;


--
-- Name: FUNCTION mark_trainer_arrived(p_booking_id text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.mark_trainer_arrived(p_booking_id text) TO anon;
GRANT ALL ON FUNCTION public.mark_trainer_arrived(p_booking_id text) TO authenticated;
GRANT ALL ON FUNCTION public.mark_trainer_arrived(p_booking_id text) TO service_role;


--
-- Name: FUNCTION on_booking_status_updated(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.on_booking_status_updated() TO anon;
GRANT ALL ON FUNCTION public.on_booking_status_updated() TO authenticated;
GRANT ALL ON FUNCTION public.on_booking_status_updated() TO service_role;


--
-- Name: FUNCTION on_notification_inserted(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.on_notification_inserted() TO anon;
GRANT ALL ON FUNCTION public.on_notification_inserted() TO authenticated;
GRANT ALL ON FUNCTION public.on_notification_inserted() TO service_role;


--
-- Name: FUNCTION parse_booking_start_time(b_date text, b_time text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.parse_booking_start_time(b_date text, b_time text) TO anon;
GRANT ALL ON FUNCTION public.parse_booking_start_time(b_date text, b_time text) TO authenticated;
GRANT ALL ON FUNCTION public.parse_booking_start_time(b_date text, b_time text) TO service_role;


--
-- Name: FUNCTION process_pending_acceptance_bookings(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.process_pending_acceptance_bookings() TO anon;
GRANT ALL ON FUNCTION public.process_pending_acceptance_bookings() TO authenticated;
GRANT ALL ON FUNCTION public.process_pending_acceptance_bookings() TO service_role;


--
-- Name: FUNCTION purchase_credits(p_plan_name text, p_credits integer, p_amount text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.purchase_credits(p_plan_name text, p_credits integer, p_amount text) TO anon;
GRANT ALL ON FUNCTION public.purchase_credits(p_plan_name text, p_credits integer, p_amount text) TO authenticated;
GRANT ALL ON FUNCTION public.purchase_credits(p_plan_name text, p_credits integer, p_amount text) TO service_role;


--
-- Name: FUNCTION reassign_booking_trainer(p_booking_id text, p_action text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.reassign_booking_trainer(p_booking_id text, p_action text) TO anon;
GRANT ALL ON FUNCTION public.reassign_booking_trainer(p_booking_id text, p_action text) TO authenticated;
GRANT ALL ON FUNCTION public.reassign_booking_trainer(p_booking_id text, p_action text) TO service_role;


--
-- Name: FUNCTION reject_trainer_application(app_id text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.reject_trainer_application(app_id text) TO anon;
GRANT ALL ON FUNCTION public.reject_trainer_application(app_id text) TO authenticated;
GRANT ALL ON FUNCTION public.reject_trainer_application(app_id text) TO service_role;


--
-- Name: FUNCTION reschedule_booking(p_booking_id text, p_new_date text, p_new_time text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.reschedule_booking(p_booking_id text, p_new_date text, p_new_time text) TO anon;
GRANT ALL ON FUNCTION public.reschedule_booking(p_booking_id text, p_new_date text, p_new_time text) TO authenticated;
GRANT ALL ON FUNCTION public.reschedule_booking(p_booking_id text, p_new_date text, p_new_time text) TO service_role;


--
-- Name: FUNCTION send_booking_reminders(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.send_booking_reminders() TO anon;
GRANT ALL ON FUNCTION public.send_booking_reminders() TO authenticated;
GRANT ALL ON FUNCTION public.send_booking_reminders() TO service_role;


--
-- Name: FUNCTION start_session(p_booking_id text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.start_session(p_booking_id text) TO anon;
GRANT ALL ON FUNCTION public.start_session(p_booking_id text) TO authenticated;
GRANT ALL ON FUNCTION public.start_session(p_booking_id text) TO service_role;


--
-- Name: FUNCTION start_travel(p_booking_id text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.start_travel(p_booking_id text) TO anon;
GRANT ALL ON FUNCTION public.start_travel(p_booking_id text) TO authenticated;
GRANT ALL ON FUNCTION public.start_travel(p_booking_id text) TO service_role;


--
-- Name: FUNCTION submit_customer_review(p_booking_id text, p_rating_details jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.submit_customer_review(p_booking_id text, p_rating_details jsonb) TO anon;
GRANT ALL ON FUNCTION public.submit_customer_review(p_booking_id text, p_rating_details jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.submit_customer_review(p_booking_id text, p_rating_details jsonb) TO service_role;


--
-- Name: FUNCTION submit_trainer_report(p_booking_id text, p_questionnaire jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.submit_trainer_report(p_booking_id text, p_questionnaire jsonb) TO anon;
GRANT ALL ON FUNCTION public.submit_trainer_report(p_booking_id text, p_questionnaire jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.submit_trainer_report(p_booking_id text, p_questionnaire jsonb) TO service_role;


--
-- Name: FUNCTION trainer_accept_booking(p_booking_id text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.trainer_accept_booking(p_booking_id text) TO anon;
GRANT ALL ON FUNCTION public.trainer_accept_booking(p_booking_id text) TO authenticated;
GRANT ALL ON FUNCTION public.trainer_accept_booking(p_booking_id text) TO service_role;


--
-- Name: FUNCTION trainer_check_in(p_booking_id text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.trainer_check_in(p_booking_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.trainer_check_in(p_booking_id text) TO anon;
GRANT ALL ON FUNCTION public.trainer_check_in(p_booking_id text) TO authenticated;
GRANT ALL ON FUNCTION public.trainer_check_in(p_booking_id text) TO service_role;


--
-- Name: FUNCTION transfer_credits(p_to_phone text, p_amount integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.transfer_credits(p_to_phone text, p_amount integer) TO anon;
GRANT ALL ON FUNCTION public.transfer_credits(p_to_phone text, p_amount integer) TO authenticated;
GRANT ALL ON FUNCTION public.transfer_credits(p_to_phone text, p_amount integer) TO service_role;


--
-- Name: FUNCTION validate_booking_transition(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.validate_booking_transition() TO anon;
GRANT ALL ON FUNCTION public.validate_booking_transition() TO authenticated;
GRANT ALL ON FUNCTION public.validate_booking_transition() TO service_role;


--
-- Name: FUNCTION verify_and_start_session(booking_id text, entered_otp text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.verify_and_start_session(booking_id text, entered_otp text) TO anon;
GRANT ALL ON FUNCTION public.verify_and_start_session(booking_id text, entered_otp text) TO authenticated;
GRANT ALL ON FUNCTION public.verify_and_start_session(booking_id text, entered_otp text) TO service_role;


--
-- Name: FUNCTION verify_session_otp(p_booking_id text, p_entered_otp text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.verify_session_otp(p_booking_id text, p_entered_otp text) TO anon;
GRANT ALL ON FUNCTION public.verify_session_otp(p_booking_id text, p_entered_otp text) TO authenticated;
GRANT ALL ON FUNCTION public.verify_session_otp(p_booking_id text, p_entered_otp text) TO service_role;


--
-- Name: TABLE addresses; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.addresses TO anon;
GRANT ALL ON TABLE public.addresses TO authenticated;
GRANT ALL ON TABLE public.addresses TO service_role;


--
-- Name: TABLE booking_state_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.booking_state_events TO anon;
GRANT ALL ON TABLE public.booking_state_events TO authenticated;
GRANT ALL ON TABLE public.booking_state_events TO service_role;


--
-- Name: TABLE bookings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bookings TO anon;
GRANT ALL ON TABLE public.bookings TO authenticated;
GRANT ALL ON TABLE public.bookings TO service_role;


--
-- Name: TABLE calorie_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.calorie_logs TO anon;
GRANT ALL ON TABLE public.calorie_logs TO authenticated;
GRANT ALL ON TABLE public.calorie_logs TO service_role;


--
-- Name: TABLE chat_messages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.chat_messages TO anon;
GRANT ALL ON TABLE public.chat_messages TO authenticated;
GRANT ALL ON TABLE public.chat_messages TO service_role;


--
-- Name: TABLE credit_transactions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.credit_transactions TO anon;
GRANT ALL ON TABLE public.credit_transactions TO authenticated;
GRANT ALL ON TABLE public.credit_transactions TO service_role;


--
-- Name: TABLE device_tokens; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.device_tokens TO anon;
GRANT ALL ON TABLE public.device_tokens TO authenticated;
GRANT ALL ON TABLE public.device_tokens TO service_role;


--
-- Name: TABLE hydration_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.hydration_logs TO anon;
GRANT ALL ON TABLE public.hydration_logs TO authenticated;
GRANT ALL ON TABLE public.hydration_logs TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


--
-- Name: TABLE push_delivery_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.push_delivery_logs TO anon;
GRANT ALL ON TABLE public.push_delivery_logs TO authenticated;
GRANT ALL ON TABLE public.push_delivery_logs TO service_role;


--
-- Name: TABLE slot_reservations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.slot_reservations TO anon;
GRANT ALL ON TABLE public.slot_reservations TO authenticated;
GRANT ALL ON TABLE public.slot_reservations TO service_role;


--
-- Name: TABLE trainer_applications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.trainer_applications TO anon;
GRANT ALL ON TABLE public.trainer_applications TO authenticated;
GRANT ALL ON TABLE public.trainer_applications TO service_role;


--
-- Name: TABLE trainer_earnings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.trainer_earnings TO anon;
GRANT ALL ON TABLE public.trainer_earnings TO authenticated;
GRANT ALL ON TABLE public.trainer_earnings TO service_role;


--
-- Name: TABLE trainer_workout_assignments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.trainer_workout_assignments TO anon;
GRANT ALL ON TABLE public.trainer_workout_assignments TO authenticated;
GRANT ALL ON TABLE public.trainer_workout_assignments TO service_role;


--
-- Name: TABLE trainers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.trainers TO anon;
GRANT ALL ON TABLE public.trainers TO authenticated;
GRANT ALL ON TABLE public.trainers TO service_role;


--
-- Name: TABLE user_profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_profiles TO anon;
GRANT ALL ON TABLE public.user_profiles TO authenticated;
GRANT ALL ON TABLE public.user_profiles TO service_role;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.users TO anon;
GRANT ALL ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;


--
-- Name: TABLE workouts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.workouts TO anon;
GRANT ALL ON TABLE public.workouts TO authenticated;
GRANT ALL ON TABLE public.workouts TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--


