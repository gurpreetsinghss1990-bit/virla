-- 20261014000000_fix_create_user_with_profile_trainer_preference.sql
-- Fix chk_user_trainer_preference violation in create_user_with_profile RPC
-- Ensures trainer_preference defaults to 'no_preference' if NULL, blank, or invalid

-- 1. Ensure the check constraint allows NULL or ('male', 'female', 'no_preference')
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS chk_user_trainer_preference;
ALTER TABLE public.user_profiles ADD CONSTRAINT chk_user_trainer_preference 
  CHECK (trainer_preference IN ('male', 'female', 'no_preference'));

-- 2. Update create_user_with_profile RPC to sanitize trainer_preference
CREATE OR REPLACE FUNCTION public.create_user_with_profile(user_row jsonb, profile_row jsonb)
RETURNS text AS $$
DECLARE
  v_pref text;
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

  -- Sanitize trainer_preference to satisfy chk_user_trainer_preference
  v_pref := LOWER(COALESCE(NULLIF(profile_row->>'trainer_preference', ''), 'no_preference'));
  IF v_pref NOT IN ('male', 'female', 'no_preference') THEN
    v_pref := 'no_preference';
  END IF;

  -- Insert into public.user_profiles
  INSERT INTO public.user_profiles (
    id, user_id, age, gender, height, weight, fitness_goal, preferred_workout, emergency_contact, medical_notes, membership_status, credits_balance, trainer_preference, dob, fitness_level, preferred_language, city, member_since, selected_goals
  ) VALUES (
    profile_row->>'id',
    profile_row->>'user_id',
    COALESCE(NULLIF(profile_row->>'age', '')::integer, 0),
    COALESCE(profile_row->>'gender', ''),
    COALESCE(profile_row->>'height', ''),
    COALESCE(profile_row->>'weight', ''),
    COALESCE(profile_row->>'fitness_goal', ''),
    COALESCE(profile_row->>'preferred_workout', ''),
    COALESCE(profile_row->'emergency_contact', '{}'::jsonb),
    COALESCE(profile_row->>'medical_notes', ''),
    COALESCE(profile_row->>'membership_status', 'Standard'),
    COALESCE(NULLIF(profile_row->>'credits_balance', '')::integer, 0),
    v_pref,
    COALESCE(profile_row->>'dob', ''),
    COALESCE(profile_row->>'fitness_level', ''),
    COALESCE(profile_row->>'preferred_language', 'English'),
    COALESCE(profile_row->>'city', ''),
    COALESCE(profile_row->>'member_since', ''),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(profile_row->'selected_goals', '[]'::jsonb)))
  );

  RETURN user_row->>'id';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
