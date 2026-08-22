-- Migration: Create Local Demo Trainer
-- Created At: 2026-08-22

CREATE OR REPLACE FUNCTION public.is_local_development()
RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  RETURN current_setting('app.settings.jwt_secret', true) = 'super-secret-jwt-token-with-at-least-32-characters-long';
END;
$$;

DO $$
BEGIN
  IF NOT public.is_local_development() THEN
    RAISE NOTICE 'Skipping demo trainer creation in production environment.';
    RETURN;
  END IF;

  -- Create Demo Trainer (trainer role)
  INSERT INTO public.users (
    id, name, phone, email, password_hash, avatar, role, status, created_date, last_login, device_info, notification_prefs, registration_status
  ) VALUES (
    'demo.trainer',
    'Demo Trainer',
    '919999999999',
    'demo.trainer@virla.local',
    crypt('VirlaTrainer@123', gen_salt('bf')),
    'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=150&q=80',
    'trainer',
    'active',
    to_char(now(), 'DD/MM/YYYY'),
    '',
    'Simulated Local Seed',
    '{"bookingUpdates": true, "trainerMessages": true, "offers": false, "membershipAlerts": true}'::jsonb,
    'complete'
  ) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    registration_status = EXCLUDED.registration_status;

  -- Insert into trainers table
  INSERT INTO public.trainers (
    id, name, photo, experience, rating, specialty, years_experience, specialization, languages, short_bio, price, verified_badge, certifications, achievements, level, completed_sessions, rating_count, operating_address, operating_latitude, operating_longitude, operating_location_status, preferences, gender
  ) VALUES (
    'demo.trainer',
    'Demo Trainer',
    'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=150&q=80',
    '10 years',
    4.0,
    'Elite Master Trainer',
    10,
    'Strength, Cardio, Mind & Body, Conditioning, Boxing',
    ARRAY['English', 'Hindi'],
    'Local development demo trainer account certified in all 5 workout specialties.',
    1200,
    true,
    ARRAY['ACE Certified Personal Trainer'],
    ARRAY['Elite Coach of the Year'],
    'Elite',
    0,
    10,
    'Juhu Beach, Mumbai, Maharashtra, India',
    19.1013,
    72.8258,
    'verified',
    '{"online": true, "radiusKm": 30, "categories": ["Strength", "Cardio", "Mind & Body", "Conditioning", "Boxing"], "maxDailySessions": 5, "operatingLocationStatus": "verified"}'::jsonb,
    'male'
  ) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    photo = EXCLUDED.photo,
    specialty = EXCLUDED.specialty,
    specialization = EXCLUDED.specialization,
    operating_location_status = EXCLUDED.operating_location_status,
    preferences = EXCLUDED.preferences,
    gender = EXCLUDED.gender;

  -- Assign all 5 workouts
  INSERT INTO public.trainer_workout_assignments (id, trainer_id, workout_category, status, requested_at, approved_at, approved_by)
  VALUES 
    ('twa-demo-strength', 'demo.trainer', 'Strength', 'APPROVED', (EXTRACT(epoch FROM now())*1000)::bigint, (EXTRACT(epoch FROM now())*1000)::bigint, 'admin-seed'),
    ('twa-demo-cardio', 'demo.trainer', 'Cardio', 'APPROVED', (EXTRACT(epoch FROM now())*1000)::bigint, (EXTRACT(epoch FROM now())*1000)::bigint, 'admin-seed'),
    ('twa-demo-mindbody', 'demo.trainer', 'Mind & Body', 'APPROVED', (EXTRACT(epoch FROM now())*1000)::bigint, (EXTRACT(epoch FROM now())*1000)::bigint, 'admin-seed'),
    ('twa-demo-conditioning', 'demo.trainer', 'Conditioning', 'APPROVED', (EXTRACT(epoch FROM now())*1000)::bigint, (EXTRACT(epoch FROM now())*1000)::bigint, 'admin-seed'),
    ('twa-demo-boxing', 'demo.trainer', 'Boxing', 'APPROVED', (EXTRACT(epoch FROM now())*1000)::bigint, (EXTRACT(epoch FROM now())*1000)::bigint, 'admin-seed')
  ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status;

END $$;
