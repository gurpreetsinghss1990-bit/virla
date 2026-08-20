-- Migration: Create Test Client and Test Admin users
-- Created At: 2026-08-20

-- Create Test Client (customer role)
INSERT INTO public.users (
  id, name, phone, email, password_hash, avatar, role, status, created_date, last_login, device_info, notification_prefs, registration_status
) VALUES (
  'u-testclient',
  'Test Client',
  '911234567891',
  'client1234567891@virla.in',
  'secure-hash-1450575459-6',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  'customer',
  'active',
  to_char(now(), 'DD/MM/YYYY'),
  '',
  'Simulated Seed',
  '{"bookingUpdates": true, "trainerMessages": true, "offers": true, "membershipAlerts": true}'::jsonb,
  'complete'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  registration_status = EXCLUDED.registration_status;

INSERT INTO public.user_profiles (
  id, user_id, age, gender, height, weight, fitness_goal, preferred_workout, emergency_contact, medical_notes, membership_status, credits_balance, dob, fitness_level, preferred_language, city, member_since, selected_goals
) VALUES (
  'prof-testclient',
  'u-testclient',
  25,
  'male',
  '175 cm',
  '70 kg',
  'Strength Training',
  'PowerForge',
  '{}'::jsonb,
  '',
  'Premium',
  50,
  '1999-01-01',
  'Intermediate',
  'English',
  'Mumbai',
  to_char(now(), 'Mon YYYY'),
  ARRAY['Strength Training']
) ON CONFLICT (user_id) DO UPDATE SET
  credits_balance = EXCLUDED.credits_balance,
  membership_status = EXCLUDED.membership_status;


-- Create Test Admin (admin role)
INSERT INTO public.users (
  id, name, phone, email, password_hash, avatar, role, status, created_date, last_login, device_info, notification_prefs, registration_status
) VALUES (
  'u-testadmin',
  'Test Admin',
  '911234567892',
  'admin1234567892@virla.in',
  'secure-hash-1450575459-6',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  'admin',
  'active',
  to_char(now(), 'DD/MM/YYYY'),
  '',
  'Simulated Seed',
  '{"bookingUpdates": true, "trainerMessages": true, "offers": true, "membershipAlerts": true}'::jsonb,
  'complete'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  registration_status = EXCLUDED.registration_status;

INSERT INTO public.user_profiles (
  id, user_id, age, gender, height, weight, fitness_goal, preferred_workout, emergency_contact, medical_notes, membership_status, credits_balance, dob, fitness_level, preferred_language, city, member_since, selected_goals
) VALUES (
  'prof-testadmin',
  'u-testadmin',
  35,
  'male',
  '180 cm',
  '80 kg',
  'Strength Training',
  'PowerForge',
  '{}'::jsonb,
  '',
  'Premium',
  50,
  '1989-01-01',
  'Advanced',
  'English',
  'Mumbai',
  to_char(now(), 'Mon YYYY'),
  ARRAY['Strength Training']
) ON CONFLICT (user_id) DO UPDATE SET
  credits_balance = EXCLUDED.credits_balance,
  membership_status = EXCLUDED.membership_status;
