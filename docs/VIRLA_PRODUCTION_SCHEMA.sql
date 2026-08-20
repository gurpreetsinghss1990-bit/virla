


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."approve_trainer_application"("app_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."approve_trainer_application"("app_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_user_with_profile"("user_row" "jsonb", "profile_row" "jsonb") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."create_user_with_profile"("user_row" "jsonb", "profile_row" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expire_stale_bookings"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  b RECORD;
  booked_start timestamptz;
  expire_count integer := 0;
BEGIN
  FOR b IN 
    SELECT id, date, time, status, timeline_status 
    FROM public.bookings 
    WHERE status = 'upcoming' 
      AND (timeline_status IS NULL OR timeline_status IN ('booked', 'trainer_assigned', 'trainer_accepted', 'trainer_preparing', 'trainer_travelling', 'trainer_arrived'))
  LOOP
    booked_start := public.parse_booking_start_time(b.date, b.time);
    
    IF now() > booked_start + interval '30 minutes' THEN
      UPDATE public.bookings
      SET 
        status = 'missed_session_not_started',
        timeline_status = 'session_closed'
      WHERE id = b.id;
      expire_count := expire_count + 1;
    END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."expire_stale_bookings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_server_time"() RETURNS timestamp with time zone
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN now();
END;
$$;


ALTER FUNCTION "public"."get_server_time"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"("user_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."is_admin"("user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."on_booking_status_updated"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."on_booking_status_updated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."on_notification_inserted"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."on_notification_inserted"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."parse_booking_start_time"("b_date" "text", "b_time" "text") RETURNS timestamp with time zone
    LANGUAGE "plpgsql" IMMUTABLE
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
  
  -- Extract start time range start (first part of "HH:MI AM - HH:MI PM")
  start_time := trim(split_part(b_time, '-', 1));
  
  -- Combine and convert
  IF clean_date ~ '^\d{4}-\d{2}-\d{2}$' THEN
    result_ts := to_timestamp(clean_date || ' ' || start_time, 'YYYY-MM-DD HH12:MI AM');
  ELSE
    result_ts := to_timestamp(clean_date || ' ' || start_time, 'Mon DD, YYYY HH12:MI AM');
  END IF;
  
  -- Subtract 5.5 hours to align UTC database now() comparison with IST calendar times
  RETURN result_ts - interval '5 hours 30 minutes';
EXCEPTION WHEN OTHERS THEN
  RETURN now() + interval '2 hours'; -- safe fallback
END;
$_$;


ALTER FUNCTION "public"."parse_booking_start_time"("b_date" "text", "b_time" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_pending_acceptance_bookings"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  b RECORD;
  now_ms bigint;
  notify_id text;
  client_body text;
  trainer_body text;
  admin_body text;
  admin_notify_id text;
BEGIN
  now_ms := (extract(epoch from now()) * 1000)::bigint;

  FOR b IN
    SELECT id, client_id, client_name, trainer_id, trainer_name, date, time, workout_title, created_at,
           acceptance_notification_count, last_acceptance_notification_at, acceptance_deadline
    FROM public.bookings
    WHERE status = 'upcoming'
      AND timeline_status = 'booked'
  LOOP
    -- 3.1. Auto-Accept booking after 10 minutes
    IF now_ms >= b.created_at + 10 * 60 * 1000 THEN
      UPDATE public.bookings
      SET
        timeline_status = 'trainer_accepted',
        acceptance_method = 'auto',
        auto_accepted_at = now_ms,
        acceptance_notification_count = 3,
        last_acceptance_notification_at = now_ms
      WHERE id = b.id;

      -- Client notification
      notify_id := 'notify-' || now_ms::text || '-' || floor(random() * 1000000)::text;
      client_body := json_build_object(
        'is_meta', true,
        'body', 'Your booking for ' || b.workout_title || ' is confirmed. Coach ' || b.trainer_name || ' is assigned to your session on ' || b.date || ' @ ' || b.time || '.',
        'type', 'Bookings',
        'priority', 'high',
        'actionLabel', 'View Details',
        'deepLink', '/session-detail?id=' || b.id,
        'expiry', ''
      )::text;

      INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
      VALUES (notify_id, b.client_id, 'Trainer Assigned ⚡', client_body, false, 'Just now', 'today', 'check-circle');

      -- Trainer notification
      notify_id := 'notify-' || now_ms::text || '-' || floor(random() * 1000000)::text;
      trainer_body := json_build_object(
        'is_meta', true,
        'body', 'Session automatically accepted because no response was received within 10 minutes.',
        'type', 'Trainer Updates',
        'priority', 'high',
        'actionLabel', 'View Details',
        'deepLink', '/session-detail?id=' || b.id,
        'expiry', ''
      )::text;

      INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
      VALUES (notify_id, b.trainer_id, 'Booking Automatically Accepted ⚠️', trainer_body, false, 'Just now', 'today', 'alert-circle');

      -- Admin notification (Operational alert)
      admin_notify_id := 'notify-' || now_ms::text || '-' || floor(random() * 1000000)::text;
      admin_body := json_build_object(
        'is_meta', true,
        'body', 'A booking for ' || b.client_name || ' (ID: ' || b.id || ') was auto-accepted because Coach ' || b.trainer_name || ' did not respond within 10 minutes. Please contact the trainer.',
        'type', 'Admin Alerts',
        'priority', 'high',
        'actionLabel', 'View Details',
        'deepLink', '/admin-panel',
        'expiry', ''
      )::text;

      INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
      VALUES (admin_notify_id, 'u-testadmin', 'Booking Request Auto-Accepted 🚨', admin_body, false, 'Just now', 'today', 'alert-triangle');

    -- 3.2. Pending Acceptance Reminder after 5 minutes
    ELSIF now_ms >= b.created_at + 5 * 60 * 1000 AND b.acceptance_notification_count = 1 THEN
      notify_id := 'notify-' || now_ms::text || '-' || floor(random() * 1000000)::text;
      trainer_body := json_build_object(
        'is_meta', true,
        'body', 'URGENT: Booking request for ' || b.workout_title || ' on ' || b.date || ' @ ' || b.time || ' is still awaiting your action (5 mins left).',
        'type', 'Trainer Updates',
        'priority', 'high',
        'actionLabel', 'View Details',
        'deepLink', '/session-detail?id=' || b.id,
        'expiry', ''
      )::text;

      INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
      VALUES (notify_id, b.trainer_id, 'Urgent: Pending Booking Request — 5 Mins Left! 🔔', trainer_body, false, 'Just now', 'today', 'bell');

      -- Update notification count
      UPDATE public.bookings
      SET
        acceptance_notification_count = 2,
        last_acceptance_notification_at = now_ms
      WHERE id = b.id;

    END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."process_pending_acceptance_bookings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_trainer_application"("app_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."reject_trainer_application"("app_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_booking_reminders"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  b RECORD;
  booked_start timestamptz;
  client_user_name text;
  formatted_start_time text;
  client_body text;
  trainer_body text;
  notify_id_client text;
  notify_id_trainer text;
BEGIN
  FOR b IN 
    SELECT id, client_id, trainer_id, trainer_name, date, time, status
    FROM public.bookings
    WHERE status = 'upcoming'
      AND trainer_id IS NOT NULL 
      AND trainer_id != 'searching'
      AND (reminder_sent IS FALSE OR reminder_sent IS NULL)
  LOOP
    booked_start := public.parse_booking_start_time(b.date, b.time);
    
    -- Send if within 1 hour
    IF now() >= booked_start - interval '1 hour' AND now() < booked_start THEN
      
      SELECT name INTO client_user_name FROM public.users WHERE id = b.client_id;
      IF client_user_name IS NULL OR client_user_name = '' THEN
        client_user_name := 'Client';
      END IF;
      
      formatted_start_time := trim(split_part(b.time, '-', 1));
      
      client_body := json_build_object(
        'is_meta', true,
        'body', 'Your VIRLA session with Coach ' || b.trainer_name || ' starts at ' || formatted_start_time || '.',
        'type', 'Bookings',
        'priority', 'medium',
        'actionLabel', 'View Details',
        'deepLink', '/session-detail?id=' || b.id,
        'expiry', ''
      )::text;
      
      trainer_body := json_build_object(
        'is_meta', true,
        'body', 'Your VIRLA session with ' || client_user_name || ' starts at ' || formatted_start_time || '.',
        'type', 'Bookings',
        'priority', 'medium',
        'actionLabel', 'View Details',
        'deepLink', '/session-detail?id=' || b.id,
        'expiry', ''
      )::text;
      
      notify_id_client := 'notify-' || (extract(epoch from now()) * 1000)::text || '-' || floor(random() * 1000000)::text;
      notify_id_trainer := 'notify-' || (extract(epoch from now()) * 1000)::text || '-' || floor(random() * 1000000)::text;
      
      INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
      VALUES (notify_id_client, b.client_id, 'Session Reminder ⏱️', client_body, false, 'Just now', 'today', 'clock');
      
      INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
      VALUES (notify_id_trainer, b.trainer_id, 'Session Reminder ⏱️', trainer_body, false, 'Just now', 'today', 'clock');
      
      UPDATE public.bookings
      SET reminder_sent = true
      WHERE id = b.id;
      
    END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."send_booking_reminders"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_booking_transition"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."validate_booking_transition"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_and_start_session"("booking_id" "text", "entered_otp" "text") RETURNS bigint
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."verify_and_start_session"("booking_id" "text", "entered_otp" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."addresses" (
    "id" "text" NOT NULL,
    "user_id" "text",
    "label" "text" NOT NULL,
    "name" "text" NOT NULL,
    "building" "text" NOT NULL,
    "street" "text" NOT NULL,
    "landmark" "text",
    "city" "text" NOT NULL,
    "pin_code" "text" NOT NULL,
    "gps_placeholder" "text",
    "is_default" boolean DEFAULT false,
    "lat" double precision,
    "lng" double precision,
    "apartment" "text",
    "floor" "text",
    "notes" "text",
    "place_id" "text"
);


ALTER TABLE "public"."addresses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "text" NOT NULL,
    "status" "text" NOT NULL,
    "timeline_status" "text" NOT NULL,
    "otp" "text" NOT NULL,
    "client_name" "text",
    "client_phone" "text",
    "trainer_name" "text",
    "trainer_photo" "text",
    "date" "text" NOT NULL,
    "time" "text" NOT NULL,
    "workout_title" "text" NOT NULL,
    "price" integer NOT NULL,
    "address" "text",
    "client_id" "text",
    "trainer_id" "text",
    "rating_details" "jsonb",
    "created_at" bigint DEFAULT ((EXTRACT(epoch FROM "now"()) * (1000)::numeric))::bigint,
    "trainer_note" "text",
    "duration_minutes" integer DEFAULT 60,
    "current_trainer_index" integer DEFAULT 0,
    "grace_period_started_at" bigint,
    "otp_expires_at" bigint,
    "workout_started_at" bigint,
    "trainer_level" "text",
    "trainer_rating" numeric(3,2) DEFAULT 5.0,
    "trainer_completed_sessions" integer DEFAULT 0,
    "trainer_speciality" "text",
    "trainer_languages" "text"[] DEFAULT '{}'::"text"[],
    "trainer_distance" "text",
    "trainer_arrival_time" "text",
    "calories_burned" integer DEFAULT 0,
    "reminder_sent" boolean DEFAULT false,
    "acceptance_notification_count" integer DEFAULT 1,
    "last_acceptance_notification_at" bigint DEFAULT ((EXTRACT(epoch FROM "now"()) * (1000)::numeric))::bigint,
    "acceptance_method" "text",
    "acceptance_deadline" bigint DEFAULT (((EXTRACT(epoch FROM "now"()) * (1000)::numeric) + (((30 * 60) * 1000))::numeric))::bigint,
    "auto_accepted_at" bigint,
    "trainer_accepted_at" bigint,
    "travel_started_at" bigint,
    "workout_completed_at" bigint
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calorie_logs" (
    "id" "text" NOT NULL,
    "user_id" "text",
    "date" "date" NOT NULL,
    "amount" integer NOT NULL
);


ALTER TABLE "public"."calorie_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "text" NOT NULL,
    "chat_id" "text" NOT NULL,
    "sender" "text" NOT NULL,
    "text" "text" NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "is_pinned" boolean DEFAULT false,
    "is_favorite" boolean DEFAULT false,
    CONSTRAINT "chat_messages_sender_check" CHECK (("sender" = ANY (ARRAY['user'::"text", 'coach'::"text", 'virla'::"text"])))
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_transactions" (
    "id" "text" NOT NULL,
    "user_id" "text",
    "type" "text" NOT NULL,
    "amount" "text" NOT NULL,
    "date" "text" NOT NULL,
    "status" "text" NOT NULL,
    "credits" integer NOT NULL
);


ALTER TABLE "public"."credit_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."device_tokens" (
    "id" "text" DEFAULT ((('tok-'::"text" || ((EXTRACT(epoch FROM "now"()) * (1000)::numeric))::"text") || '-'::"text") || ("floor"(("random"() * (1000000)::double precision)))::"text") NOT NULL,
    "user_id" "text",
    "token" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_seen_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."device_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hydration_logs" (
    "id" "text" NOT NULL,
    "user_id" "text",
    "date" "date" NOT NULL,
    "amount" integer NOT NULL
);


ALTER TABLE "public"."hydration_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "text" NOT NULL,
    "user_id" "text",
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "read" boolean DEFAULT false,
    "timestamp" "text",
    "group" "text",
    "icon" "text"
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_delivery_logs" (
    "id" "text" DEFAULT ((('pushlog-'::"text" || ((EXTRACT(epoch FROM "now"()) * (1000)::numeric))::"text") || '-'::"text") || ("floor"(("random"() * (1000000)::double precision)))::"text") NOT NULL,
    "notification_id" "text",
    "user_id" "text",
    "device_token" "text",
    "platform" "text",
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "payload" "jsonb"
);


ALTER TABLE "public"."push_delivery_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."slot_reservations" (
    "id" "text" NOT NULL,
    "slot_time" "text" NOT NULL,
    "slot_date" "text" NOT NULL,
    "trainer_id" "text" NOT NULL,
    "client_id" "text" NOT NULL,
    "expires_at" bigint NOT NULL
);


ALTER TABLE "public"."slot_reservations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trainer_applications" (
    "id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "full_name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "email" "text" NOT NULL,
    "dob" "text" NOT NULL,
    "gender" "text" NOT NULL,
    "avatar" "text" NOT NULL,
    "address" "text" NOT NULL,
    "city" "text" NOT NULL,
    "state" "text" NOT NULL,
    "pin_code" "text" NOT NULL,
    "emergency_contact" "jsonb" NOT NULL,
    "primary_workout" "text" NOT NULL,
    "secondary_skills" "text" NOT NULL,
    "years_of_experience" integer NOT NULL,
    "languages" "text" NOT NULL,
    "about_me" "text" NOT NULL,
    "fitness_qualifications" "text" NOT NULL,
    "working_days" "text"[] NOT NULL,
    "availability_morning" boolean NOT NULL,
    "availability_afternoon" boolean NOT NULL,
    "availability_evening" boolean NOT NULL,
    "max_sessions_per_day" integer NOT NULL,
    "preferred_working_radius" integer NOT NULL,
    "preferred_cities" "text"[] NOT NULL,
    "bank_account_name" "text" NOT NULL,
    "bank_name" "text" NOT NULL,
    "bank_account_number" "text" NOT NULL,
    "bank_ifsc" "text" NOT NULL,
    "bank_upi_id" "text" NOT NULL,
    "pan_number" "text" NOT NULL,
    "gst_number" "text",
    "document_aadhaar" "text" NOT NULL,
    "document_pan" "text" NOT NULL,
    "document_selfie" "text" NOT NULL,
    "document_certifications" "jsonb" NOT NULL,
    CONSTRAINT "chk_application_gender" CHECK (("gender" = ANY (ARRAY['male'::"text", 'female'::"text"])))
);


ALTER TABLE "public"."trainer_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trainer_earnings" (
    "id" "text" NOT NULL,
    "trainer_id" "text",
    "booking_id" "text",
    "client_name" "text" NOT NULL,
    "amount" integer NOT NULL,
    "date" "text" NOT NULL,
    "type" "text" NOT NULL
);


ALTER TABLE "public"."trainer_earnings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trainer_workout_assignments" (
    "id" "text" NOT NULL,
    "trainer_id" "text",
    "workout_category" "text" NOT NULL,
    "status" "text" NOT NULL,
    "requested_at" bigint NOT NULL,
    "approved_at" bigint,
    "approved_by" "text",
    "rejected_at" bigint,
    "rejected_by" "text",
    "rejection_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "trainer_workout_assignments_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'APPROVED'::"text", 'REJECTED'::"text", 'REMOVAL_REQUESTED'::"text", 'REMOVED'::"text"])))
);


ALTER TABLE "public"."trainer_workout_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trainers" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "photo" "text",
    "experience" "text",
    "rating" numeric(3,2) DEFAULT 5.0,
    "specialty" "text",
    "years_experience" integer,
    "specialization" "text",
    "languages" "text"[],
    "short_bio" "text",
    "completed_sessions" integer DEFAULT 0,
    "rating_count" integer DEFAULT 0,
    "about_text" "text",
    "availability" "text"[],
    "working_radius" "text",
    "bank_details" "jsonb",
    "emergency_contact" "jsonb",
    "level" "text" DEFAULT 'Associate'::"text",
    "weekly_slots_submitted" integer DEFAULT 0,
    "remaining_slot_changes" integer DEFAULT 3,
    "retainer_status" "text" DEFAULT 'not_eligible'::"text",
    "attendance_rate" numeric(5,2) DEFAULT 100.0,
    "punctuality_rate" numeric(5,2) DEFAULT 100.0,
    "availability_compliance" numeric(5,2) DEFAULT 100.0,
    "price" integer DEFAULT 1200,
    "verified_badge" boolean DEFAULT true,
    "certifications" "text"[] DEFAULT '{}'::"text"[],
    "achievements" "text"[] DEFAULT '{}'::"text"[],
    "reviews" "jsonb" DEFAULT '[]'::"jsonb",
    "workout_specialties" "text"[] DEFAULT '{}'::"text"[],
    "is_favourite" boolean DEFAULT false,
    "preferences" "jsonb" DEFAULT '{"online": false, "radiusKm": 15, "categories": [], "maxDailySessions": 5}'::"jsonb",
    "operating_address" "text",
    "operating_latitude" double precision,
    "operating_longitude" double precision,
    "operating_place_id" "text",
    "operating_location_status" "text" DEFAULT 'pending'::"text",
    "service_radius_km" integer DEFAULT 15,
    "address_change_request" "jsonb",
    "gender" "text",
    CONSTRAINT "chk_trainer_gender" CHECK (("gender" = ANY (ARRAY['male'::"text", 'female'::"text"]))),
    CONSTRAINT "trainers_level_check" CHECK (("level" = ANY (ARRAY['Associate'::"text", 'Certified'::"text", 'Elite'::"text"])))
);


ALTER TABLE "public"."trainers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "text" NOT NULL,
    "user_id" "text",
    "age" integer,
    "gender" "text",
    "height" "text",
    "weight" "text",
    "fitness_goal" "text",
    "preferred_workout" "text",
    "emergency_contact" "jsonb",
    "medical_notes" "text",
    "membership_status" "text",
    "credits_balance" integer DEFAULT 0,
    "trainer_preference" "text",
    "dob" "text",
    "fitness_level" "text",
    "preferred_language" "text",
    "city" "text",
    "member_since" "text",
    "selected_goals" "text"[],
    "home_address" "text",
    "home_latitude" double precision,
    "home_longitude" double precision,
    "home_place_id" "text",
    CONSTRAINT "chk_user_trainer_preference" CHECK (("trainer_preference" = ANY (ARRAY['male'::"text", 'female'::"text", 'no_preference'::"text"])))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "email" "text",
    "password_hash" "text",
    "avatar" "text",
    "role" "text" NOT NULL,
    "status" "text" NOT NULL,
    "created_date" "text",
    "last_login" "text",
    "device_info" "text",
    "notification_prefs" "jsonb",
    "registration_status" "text" DEFAULT 'PROFILE_NAME_PENDING'::"text",
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['customer'::"text", 'trainer'::"text", 'admin'::"text"]))),
    CONSTRAINT "users_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workouts" (
    "id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "icon" "text",
    "description" "text",
    "calories" integer,
    "duration" integer,
    "hero_image" "text",
    "category" "text",
    "benefits" "text"[],
    "difficulty" "text",
    "equipment" "text"[],
    "home_visit_badge" boolean DEFAULT true,
    "session_price" integer,
    "rating" numeric(3,2) DEFAULT 4.8,
    "reviews" "jsonb" DEFAULT '[]'::"jsonb",
    "faqs" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "public"."workouts" OWNER TO "postgres";


ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calorie_logs"
    ADD CONSTRAINT "calorie_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."device_tokens"
    ADD CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."device_tokens"
    ADD CONSTRAINT "device_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."hydration_logs"
    ADD CONSTRAINT "hydration_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_delivery_logs"
    ADD CONSTRAINT "push_delivery_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."slot_reservations"
    ADD CONSTRAINT "slot_reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trainer_applications"
    ADD CONSTRAINT "trainer_applications_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "public"."trainer_applications"
    ADD CONSTRAINT "trainer_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trainer_earnings"
    ADD CONSTRAINT "trainer_earnings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trainer_workout_assignments"
    ADD CONSTRAINT "trainer_workout_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trainers"
    ADD CONSTRAINT "trainers_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."trainers"
    ADD CONSTRAINT "trainers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workouts"
    ADD CONSTRAINT "workouts_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "unique_active_trainer_slot" ON "public"."bookings" USING "btree" ("trainer_id", "date", "time") WHERE ("status" <> 'cancelled'::"text");



CREATE UNIQUE INDEX "unique_trainer_slot_reservation" ON "public"."slot_reservations" USING "btree" ("trainer_id", "slot_date", "slot_time");



CREATE OR REPLACE TRIGGER "a_validate_booking_transition" BEFORE UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."validate_booking_transition"();



CREATE OR REPLACE TRIGGER "trg_booking_status_updated" BEFORE UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."on_booking_status_updated"();



CREATE OR REPLACE TRIGGER "trg_notification_inserted" AFTER INSERT ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "public"."on_notification_inserted"();



ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calorie_logs"
    ADD CONSTRAINT "calorie_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."device_tokens"
    ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hydration_logs"
    ADD CONSTRAINT "hydration_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trainer_earnings"
    ADD CONSTRAINT "trainer_earnings_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Enable DELETE for self or admin" ON "public"."user_profiles" FOR DELETE USING ((("user_id" = (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text")) OR "public"."is_admin"((("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text"))));



CREATE POLICY "Enable DELETE for self or admin" ON "public"."users" FOR DELETE USING ((("id" = (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text")) OR "public"."is_admin"((("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text"))));



CREATE POLICY "Enable INSERT for admin" ON "public"."users" FOR INSERT WITH CHECK ("public"."is_admin"((("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text")));



CREATE POLICY "Enable INSERT for all" ON "public"."trainer_applications" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable INSERT for client" ON "public"."bookings" FOR INSERT WITH CHECK (("client_id" = (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text")));



CREATE POLICY "Enable INSERT for participant" ON "public"."chat_messages" FOR INSERT WITH CHECK (("chat_id" ~~ (('%'::"text" || (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text")) || '%'::"text")));



CREATE POLICY "Enable INSERT for self only" ON "public"."credit_transactions" FOR INSERT WITH CHECK (("user_id" = (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text")));



CREATE POLICY "Enable INSERT for self or admin" ON "public"."user_profiles" FOR INSERT WITH CHECK ((("user_id" = (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text")) OR "public"."is_admin"((("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text"))));



CREATE POLICY "Enable SELECT for owner or admin" ON "public"."trainer_applications" FOR SELECT USING ((("phone" = ( SELECT "users"."phone"
   FROM "public"."users"
  WHERE ("users"."id" = (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text")))) OR "public"."is_admin"((("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text"))));



CREATE POLICY "Enable SELECT for participant" ON "public"."bookings" FOR SELECT USING ((("client_id" = (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text")) OR ("trainer_id" = (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text"))));



CREATE POLICY "Enable SELECT for participant" ON "public"."chat_messages" FOR SELECT USING (("chat_id" ~~ (('%'::"text" || (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text")) || '%'::"text")));



CREATE POLICY "Enable SELECT for self only" ON "public"."credit_transactions" FOR SELECT USING (("user_id" = (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text")));



CREATE POLICY "Enable SELECT for self or admin" ON "public"."user_profiles" FOR SELECT USING ((("user_id" = (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text")) OR "public"."is_admin"((("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text"))));



CREATE POLICY "Enable SELECT for self or admin" ON "public"."users" FOR SELECT USING ((("id" = (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text")) OR "public"."is_admin"((("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text"))));



CREATE POLICY "Enable SELECT for trainer only" ON "public"."trainer_earnings" FOR SELECT USING (("trainer_id" = (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text")));



CREATE POLICY "Enable UPDATE for owner or admin" ON "public"."trainer_applications" FOR UPDATE USING ((("phone" = ( SELECT "users"."phone"
   FROM "public"."users"
  WHERE ("users"."id" = (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text")))) OR "public"."is_admin"((("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text")))) WITH CHECK ((("phone" = ( SELECT "users"."phone"
   FROM "public"."users"
  WHERE ("users"."id" = (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text")))) OR "public"."is_admin"((("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text"))));



CREATE POLICY "Enable UPDATE for participant" ON "public"."bookings" FOR UPDATE USING ((("client_id" = (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text")) OR ("trainer_id" = (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text")))) WITH CHECK ((("client_id" = (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text")) OR ("trainer_id" = (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text"))));



CREATE POLICY "Enable UPDATE for self or admin" ON "public"."user_profiles" FOR UPDATE USING ((("user_id" = (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text")) OR "public"."is_admin"((("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text")))) WITH CHECK ((("user_id" = (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text")) OR "public"."is_admin"((("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text"))));



CREATE POLICY "Enable UPDATE for self or admin" ON "public"."users" FOR UPDATE USING ((("id" = (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text")) OR "public"."is_admin"((("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text")))) WITH CHECK ((("id" = (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text")) OR "public"."is_admin"((("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text"))));



CREATE POLICY "Enable all for self only" ON "public"."addresses" USING (("user_id" = (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text"))) WITH CHECK (("user_id" = (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text")));



CREATE POLICY "Enable all for self only" ON "public"."calorie_logs" USING (("user_id" = (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text"))) WITH CHECK (("user_id" = (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text")));



CREATE POLICY "Enable all for self only" ON "public"."hydration_logs" USING (("user_id" = (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text"))) WITH CHECK (("user_id" = (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text")));



CREATE POLICY "Enable all for self only" ON "public"."notifications" USING (("user_id" = (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text"))) WITH CHECK (("user_id" = (("current_setting"('request.headers'::"text", true))::"jsonb" ->> 'x-user-id'::"text")));



CREATE POLICY "Enable read/write for simulation trainer_workout_assignments" ON "public"."trainer_workout_assignments" USING (true) WITH CHECK (true);



CREATE POLICY "Enable read/write for simulation trainers" ON "public"."trainers" USING (true) WITH CHECK (true);



CREATE POLICY "Enable read/write for simulation workouts" ON "public"."workouts" USING (true) WITH CHECK (true);



ALTER TABLE "public"."addresses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calorie_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hydration_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."slot_reservations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trainer_applications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trainer_earnings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trainer_workout_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trainers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workouts" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_server_time"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_server_time"() TO "authenticated";



GRANT ALL ON TABLE "public"."addresses" TO "anon";
GRANT ALL ON TABLE "public"."addresses" TO "authenticated";
GRANT ALL ON TABLE "public"."addresses" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."calorie_logs" TO "anon";
GRANT ALL ON TABLE "public"."calorie_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."calorie_logs" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."credit_transactions" TO "anon";
GRANT ALL ON TABLE "public"."credit_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."device_tokens" TO "anon";
GRANT ALL ON TABLE "public"."device_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."device_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."hydration_logs" TO "anon";
GRANT ALL ON TABLE "public"."hydration_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."hydration_logs" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."push_delivery_logs" TO "anon";
GRANT ALL ON TABLE "public"."push_delivery_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."push_delivery_logs" TO "service_role";



GRANT ALL ON TABLE "public"."slot_reservations" TO "anon";
GRANT ALL ON TABLE "public"."slot_reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."slot_reservations" TO "service_role";



GRANT ALL ON TABLE "public"."trainer_applications" TO "anon";
GRANT ALL ON TABLE "public"."trainer_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."trainer_applications" TO "service_role";



GRANT ALL ON TABLE "public"."trainer_earnings" TO "anon";
GRANT ALL ON TABLE "public"."trainer_earnings" TO "authenticated";
GRANT ALL ON TABLE "public"."trainer_earnings" TO "service_role";



GRANT ALL ON TABLE "public"."trainer_workout_assignments" TO "anon";
GRANT ALL ON TABLE "public"."trainer_workout_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."trainer_workout_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."trainers" TO "anon";
GRANT ALL ON TABLE "public"."trainers" TO "authenticated";
GRANT ALL ON TABLE "public"."trainers" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."workouts" TO "anon";
GRANT ALL ON TABLE "public"."workouts" TO "authenticated";
GRANT ALL ON TABLE "public"."workouts" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,USAGE ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,USAGE ON SEQUENCES TO "authenticated";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







