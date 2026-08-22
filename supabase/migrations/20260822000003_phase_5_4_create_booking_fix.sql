-- Migration: Phase 5.4 Create Booking Workout Catalog Fix
-- Created At: 2026-08-22

-- 1. Seed workouts table with canonical workouts and fallback/lookup IDs
INSERT INTO public.workouts (id, title, icon, description, calories, duration, hero_image, category, benefits, difficulty, equipment, home_visit_badge, session_price, rating, reviews, faqs)
VALUES
  ('w-1', 'PowerForge', '💪', 'Build Strength. Build Confidence.', 320, 45, 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80', 'Strength', ARRAY['Increase muscle mass & bone density'], 'Medium - Hard', ARRAY['Dumbbells'], true, 1200, 4.9, '[]'::jsonb, '[]'::jsonb),
  ('w-2', 'ZenFlow', '🧘‍♀️', 'Balance Mind & Body.', 180, 50, 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80', 'Mind & Body', ARRAY['Enhance balance & posture'], 'Beginner - Medium', ARRAY['Yoga mat'], true, 1100, 4.8, '[]'::jsonb, '[]'::jsonb),
  ('w-3', 'CoreAlign', '🧘', 'Core Stability & Posture.', 220, 45, 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80', 'Mind & Body', ARRAY['Deep abdominal strength'], 'Medium', ARRAY['Pilates mat'], true, 1300, 4.85, '[]'::jsonb, '[]'::jsonb),
  ('w-4', 'RhythmX', '💃', 'Move. Sweat. Enjoy.', 380, 45, 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=80', 'Cardio', ARRAY['Cardiovascular conditioning'], 'Medium', ARRAY['Comfy sports shoes'], true, 1000, 4.8, '[]'::jsonb, '[]'::jsonb),
  ('w-5', 'KinetiX', '⚡', 'Functional Agility & Balance.', 300, 45, 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=800&q=80', 'Conditioning', ARRAY['Better daily life agility'], 'Medium', ARRAY['Kettlebells'], true, 1200, 4.8, '[]'::jsonb, '[]'::jsonb),
  ('w-8', 'FightLab', '🥊', 'Train Like a Champion.', 450, 40, 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=800&q=80', 'Cardio', ARRAY['High calorie cardiovascular burn'], 'Hard', ARRAY['Boxing pads & gloves'], true, 1300, 4.9, '[]'::jsonb, '[]'::jsonb),
  ('w-powerforge', 'PowerForge', '💪', 'Build Strength. Build Confidence.', 320, 45, 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80', 'Strength', ARRAY['Increase muscle mass & bone density'], 'Medium - Hard', ARRAY['Dumbbells'], true, 1200, 4.9, '[]'::jsonb, '[]'::jsonb),
  ('w-zenflow', 'ZenFlow', '🧘‍♀️', 'Balance Mind & Body.', 180, 50, 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80', 'Mind & Body', ARRAY['Enhance balance & posture'], 'Beginner - Medium', ARRAY['Yoga mat'], true, 1100, 4.8, '[]'::jsonb, '[]'::jsonb),
  ('w-corealign', 'CoreAlign', '🧘', 'Core Stability & Posture.', 220, 45, 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80', 'Mind & Body', ARRAY['Deep abdominal strength'], 'Medium', ARRAY['Pilates mat'], true, 1300, 4.85, '[]'::jsonb, '[]'::jsonb),
  ('w-rhythmx', 'RhythmX', '💃', 'Move. Sweat. Enjoy.', 380, 45, 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=80', 'Cardio', ARRAY['Cardiovascular conditioning'], 'Medium', ARRAY['Comfy sports shoes'], true, 1000, 4.8, '[]'::jsonb, '[]'::jsonb),
  ('w-kinetix', 'KinetiX', '⚡', 'Functional Agility & Balance.', 300, 45, 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=800&q=80', 'Conditioning', ARRAY['Better daily life agility'], 'Medium', ARRAY['Kettlebells'], true, 1200, 4.8, '[]'::jsonb, '[]'::jsonb),
  ('w-fightlab', 'FightLab', '🥊', 'Train Like a Champion.', 450, 40, 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=800&q=80', 'Cardio', ARRAY['High calorie cardiovascular burn'], 'Hard', ARRAY['Boxing pads & gloves'], true, 1300, 4.9, '[]'::jsonb, '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 2. Redefine create_booking with workout existence check
CREATE OR REPLACE FUNCTION public.create_booking(
  p_booking_id text,
  p_workout_id text,
  p_scheduled_start_at timestamptz,
  p_scheduled_end_at timestamptz,
  p_assigned_trainer_id text
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
    request_created_at, acceptance_notification_count, last_acceptance_notification_at, acceptance_deadline
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
    (EXTRACT(epoch FROM now() + interval '10 minutes')*1000)::bigint
  );

  -- Log state change event
  INSERT INTO public.booking_state_events (booking_id, event_type, previous_state, new_state, actor_user_id, actor_role)
  VALUES (p_booking_id, 'BOOKING_CREATED', NULL, 'BOOKED', v_client_id, 'customer');

  RETURN jsonb_build_object('success', true, 'booking_id', p_booking_id);
END;
$$;
