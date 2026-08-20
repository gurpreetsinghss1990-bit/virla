-- Migration: Fix Trainer Approval RPC and update existing trainers
-- Created At: 2026-08-20

-- 1. Redefine approve_trainer_application RPC to set gender and operating_location_status
CREATE OR REPLACE FUNCTION public.approve_trainer_application(app_id text)
RETURNS void AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update existing approved trainers to verified status and gender 'male'
UPDATE public.trainers 
SET operating_location_status = 'verified', 
    gender = 'male',
    preferences = jsonb_set(preferences, '{operatingLocationStatus}', '"verified"')
WHERE id IN ('u-lzz5170zr', 'u-mgrblijdh');
