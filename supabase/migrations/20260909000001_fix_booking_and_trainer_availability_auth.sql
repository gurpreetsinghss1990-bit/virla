-- Migration: Fix Client Booking Authorization (Bug #1) & Trainer Availability RLS (Bug #2)
-- Created At: 2026-09-09

-- 1. Redefine create_booking with robust COALESCE user identification fallback
CREATE OR REPLACE FUNCTION public.create_booking(
  p_booking_id text,
  p_workout_id text,
  p_scheduled_start_at timestamptz,
  p_scheduled_end_at timestamptz,
  p_assigned_trainer_id text,
  p_trainer_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
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
  -- Authentication Check: resolve client ID from JWT claim sub, auth.uid(), or x-user-id header
  v_client_id := COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(auth.uid()::text, ''),
    (current_setting('request.headers', true)::jsonb->>'x-user-id')
  );

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Verify caller role is not trainer (enforce trainer self-booking restriction)
  IF EXISTS (SELECT 1 FROM public.users WHERE id = v_client_id AND role = 'trainer') THEN
    RAISE EXCEPTION 'Trainer accounts cannot use credits to book sessions for themselves.';
  END IF;

  -- Verify caller role is customer or admin
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_client_id AND role IN ('customer', 'admin')) THEN
    RAISE EXCEPTION 'Only customers and admins can create bookings.';
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
    0,
    NULL,
    now() + interval '30 minutes',
    p_trainer_note
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'workout_title', v_workout_title,
    'trainer_name', v_trainer_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_booking(text, text, timestamptz, timestamptz, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking(text, text, timestamptz, timestamptz, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.create_booking(text, text, timestamptz, timestamptz, text, text) TO service_role;

-- 2. Ensure u-testadmin has a corresponding trainer record in trainers table
INSERT INTO public.trainers (
  id, name, photo, experience, rating, specialty, years_experience, specialization, languages, short_bio, price, verified_badge, certifications, achievements, level, completed_sessions, rating_count, operating_address, operating_latitude, operating_longitude, operating_location_status, preferences, gender
) VALUES (
  'u-testadmin',
  'Test Admin',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  '10 years',
  5.0,
  'Master Trainer',
  10,
  'Strength Training, Cardio, Yoga, Stretching, Boxing',
  ARRAY['English', 'Hindi'],
  'Test Admin Account with full Client, Trainer, and Admin capabilities.',
  1200,
  true,
  ARRAY['ACE Certified Personal Trainer', 'VIRLA Master Coach'],
  ARRAY['Master Coach Award'],
  'Elite',
  50,
  25,
  'Juhu Beach, Mumbai, Maharashtra, India',
  19.1013,
  72.8258,
  'verified',
  '{"online": true, "radiusKm": 30, "categories": ["Strength", "Cardio", "Mind & Body", "Conditioning", "Boxing"], "maxDailySessions": 5, "operatingLocationStatus": "verified"}'::jsonb,
  'male'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  specialization = EXCLUDED.specialization;

-- 3. Redefine RLS Policy on trainers table to allow slot availability updates using COALESCE auth fallback
DROP POLICY IF EXISTS "Enable UPDATE for trainers self only" ON public.trainers;
CREATE POLICY "Enable UPDATE for trainers self only" ON public.trainers
  FOR UPDATE USING (
    id = COALESCE(nullif(current_setting('request.jwt.claim.sub', true), ''), nullif(auth.uid()::text, ''), (current_setting('request.headers', true)::jsonb->>'x-user-id'))
    OR public.is_admin(COALESCE(nullif(current_setting('request.jwt.claim.sub', true), ''), nullif(auth.uid()::text, ''), (current_setting('request.headers', true)::jsonb->>'x-user-id')))
  )
  WITH CHECK (
    id = COALESCE(nullif(current_setting('request.jwt.claim.sub', true), ''), nullif(auth.uid()::text, ''), (current_setting('request.headers', true)::jsonb->>'x-user-id'))
    OR public.is_admin(COALESCE(nullif(current_setting('request.jwt.claim.sub', true), ''), nullif(auth.uid()::text, ''), (current_setting('request.headers', true)::jsonb->>'x-user-id')))
  );
