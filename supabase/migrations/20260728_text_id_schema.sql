-- Migration: TEXT ID Schema Bootstrapper
-- Created At: 2026-07-28
-- Description: Creates all database tables with TEXT format IDs and configures client permissions.

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. DROP EXISTING CONFLICTING TABLES (IF THEY EXIST)
DROP TABLE IF EXISTS public.trainer_applications CASCADE;
DROP TABLE IF EXISTS public.trainer_earnings CASCADE;
DROP TABLE IF EXISTS public.addresses CASCADE;
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.calorie_logs CASCADE;
DROP TABLE IF EXISTS public.hydration_logs CASCADE;
DROP TABLE IF EXISTS public.credit_transactions CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.workouts CASCADE;
DROP TABLE IF EXISTS public.trainers CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 2. CREATE USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    password_hash TEXT,
    avatar TEXT,
    role TEXT NOT NULL CHECK (role IN ('customer', 'trainer', 'admin')),
    status TEXT NOT NULL CHECK (status IN ('active', 'suspended')),
    created_date TEXT,
    last_login TEXT,
    device_info TEXT,
    notification_prefs JSONB
);

-- 3. CREATE USER PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
    age INTEGER,
    gender TEXT,
    height TEXT,
    weight TEXT,
    fitness_goal TEXT,
    preferred_workout TEXT,
    emergency_contact JSONB,
    medical_notes TEXT,
    membership_status TEXT,
    credits_balance INTEGER DEFAULT 0,
    trainer_preference TEXT,
    dob TEXT,
    fitness_level TEXT,
    preferred_language TEXT,
    city TEXT,
    member_since TEXT,
    selected_goals TEXT[]
);

-- 4. CREATE TRAINERS TABLE
CREATE TABLE IF NOT EXISTS public.trainers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    photo TEXT,
    experience TEXT,
    rating NUMERIC(3,2) DEFAULT 5.0,
    specialty TEXT,
    years_experience INTEGER,
    specialization TEXT,
    languages TEXT[],
    short_bio TEXT,
    completed_sessions INTEGER DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    about_text TEXT,
    availability TEXT[],
    working_radius TEXT,
    bank_details JSONB,
    emergency_contact JSONB,
    level TEXT DEFAULT 'Associate' CHECK (level IN ('Associate', 'Certified', 'Elite')),
    weekly_slots_submitted INTEGER DEFAULT 0,
    remaining_slot_changes INTEGER DEFAULT 3,
    retainer_status TEXT DEFAULT 'not_eligible',
    attendance_rate NUMERIC(5,2) DEFAULT 100.0,
    punctuality_rate NUMERIC(5,2) DEFAULT 100.0,
    availability_compliance NUMERIC(5,2) DEFAULT 100.0,
    price INTEGER DEFAULT 1200,
    verified_badge BOOLEAN DEFAULT TRUE,
    certifications TEXT[] DEFAULT '{}'::text[],
    achievements TEXT[] DEFAULT '{}'::text[],
    reviews JSONB DEFAULT '[]'::jsonb,
    workout_specialties TEXT[] DEFAULT '{}'::text[],
    is_favourite BOOLEAN DEFAULT FALSE,
    preferences JSONB DEFAULT '{"online": false, "radiusKm": 15, "maxDailySessions": 5, "categories": []}'::jsonb
);

-- 5. CREATE WORKOUTS CATALOG TABLE
CREATE TABLE IF NOT EXISTS public.workouts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    icon TEXT,
    description TEXT,
    calories INTEGER,
    duration INTEGER,
    hero_image TEXT,
    category TEXT,
    benefits TEXT[],
    difficulty TEXT,
    equipment TEXT[],
    home_visit_badge BOOLEAN DEFAULT TRUE,
    session_price INTEGER,
    rating NUMERIC(3,2) DEFAULT 4.8,
    reviews JSONB DEFAULT '[]'::jsonb,
    faqs JSONB DEFAULT '[]'::jsonb
);

-- 6. CREATE BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS public.bookings (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    timeline_status TEXT NOT NULL,
    otp TEXT NOT NULL,
    client_name TEXT,
    client_phone TEXT,
    trainer_name TEXT,
    trainer_photo TEXT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    workout_title TEXT NOT NULL,
    price INTEGER NOT NULL,
    address TEXT,
    client_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    trainer_id TEXT,
    rating_details JSONB
);

-- 7. CREATE CREDIT TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    amount TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL,
    credits INTEGER NOT NULL
);

-- 8. CREATE HYDRATION LOGS TABLE
CREATE TABLE IF NOT EXISTS public.hydration_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    amount INTEGER NOT NULL
);

-- 9. CREATE CALORIE LOGS TABLE
CREATE TABLE IF NOT EXISTS public.calorie_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    amount INTEGER NOT NULL
);

-- 10. CREATE notifications TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    timestamp TEXT,
    "group" TEXT,
    icon TEXT
);

-- 11. CREATE CHAT MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'coach', 'virla')),
    text TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT now(),
    is_pinned BOOLEAN DEFAULT FALSE,
    is_favorite BOOLEAN DEFAULT FALSE
);

-- 12. CREATE SAVED ADDRESSES TABLE
CREATE TABLE IF NOT EXISTS public.addresses (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    name TEXT NOT NULL,
    building TEXT NOT NULL,
    street TEXT NOT NULL,
    landmark TEXT,
    city TEXT NOT NULL,
    pin_code TEXT NOT NULL,
    gps_placeholder TEXT,
    is_default BOOLEAN DEFAULT FALSE
);

-- 13. CREATE TRAINER EARNINGS TABLE
CREATE TABLE IF NOT EXISTS public.trainer_earnings (
    id TEXT PRIMARY KEY,
    trainer_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    booking_id TEXT,
    client_name TEXT NOT NULL,
    amount INTEGER NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL
);

-- 14. CREATE TRAINER ONBOARDING APPLICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.trainer_applications (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'pending',
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    dob TEXT NOT NULL,
    gender TEXT NOT NULL,
    avatar TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    pin_code TEXT NOT NULL,
    emergency_contact JSONB NOT NULL,
    primary_workout TEXT NOT NULL,
    secondary_skills TEXT NOT NULL,
    years_of_experience INTEGER NOT NULL,
    languages TEXT NOT NULL,
    about_me TEXT NOT NULL,
    fitness_qualifications TEXT NOT NULL,
    working_days TEXT[] NOT NULL,
    availability_morning BOOLEAN NOT NULL,
    availability_afternoon BOOLEAN NOT NULL,
    availability_evening BOOLEAN NOT NULL,
    max_sessions_per_day INTEGER NOT NULL,
    preferred_working_radius INTEGER NOT NULL,
    preferred_cities TEXT[] NOT NULL,
    bank_account_name TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    bank_account_number TEXT NOT NULL,
    bank_ifsc TEXT NOT NULL,
    bank_upi_id TEXT NOT NULL,
    pan_number TEXT NOT NULL,
    gst_number TEXT,
    document_aadhaar TEXT NOT NULL,
    document_pan TEXT NOT NULL,
    document_selfie TEXT NOT NULL,
    document_certifications JSONB NOT NULL
);

-- ====================================================================
-- CLIENT ROLE PERMISSIONS & GRANTS
-- ====================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hydration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calorie_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_applications ENABLE ROW LEVEL SECURITY;

-- Idempotent policy recreation
DROP POLICY IF EXISTS "Enable read/write for simulation users" ON public.users;
CREATE POLICY "Enable read/write for simulation users" ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read/write for simulation user profiles" ON public.user_profiles;
CREATE POLICY "Enable read/write for simulation user profiles" ON public.user_profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read/write for simulation trainers" ON public.trainers;
CREATE POLICY "Enable read/write for simulation trainers" ON public.trainers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read/write for simulation workouts" ON public.workouts;
CREATE POLICY "Enable read/write for simulation workouts" ON public.workouts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read/write for simulation bookings" ON public.bookings;
CREATE POLICY "Enable read/write for simulation bookings" ON public.bookings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read/write for simulation credit transactions" ON public.credit_transactions;
CREATE POLICY "Enable read/write for simulation credit transactions" ON public.credit_transactions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read/write for simulation hydration logs" ON public.hydration_logs;
CREATE POLICY "Enable read/write for simulation hydration logs" ON public.hydration_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read/write for simulation calorie logs" ON public.calorie_logs;
CREATE POLICY "Enable read/write for simulation calorie logs" ON public.calorie_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read/write for simulation notifications" ON public.notifications;
CREATE POLICY "Enable read/write for simulation notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read/write for simulation chat messages" ON public.chat_messages;
CREATE POLICY "Enable read/write for simulation chat messages" ON public.chat_messages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read/write for simulation addresses" ON public.addresses;
CREATE POLICY "Enable read/write for simulation addresses" ON public.addresses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read/write for simulation trainer earnings" ON public.trainer_earnings;
CREATE POLICY "Enable read/write for simulation trainer earnings" ON public.trainer_earnings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read/write for simulation trainer applications" ON public.trainer_applications;
CREATE POLICY "Enable read/write for simulation trainer applications" ON public.trainer_applications FOR ALL USING (true) WITH CHECK (true);

-- ====================================================================
-- ATOMIC SIGNUP TRANSACTION Stored Procedure (RPC)
-- ====================================================================
CREATE OR REPLACE FUNCTION public.create_user_with_profile(user_row jsonb, profile_row jsonb)
RETURNS text AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ALTER TABLES FOR PRE-EXISTING DATABASES
ALTER TABLE public.trainers ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{"online": false, "radiusKm": 15, "maxDailySessions": 5, "categories": []}'::jsonb;

-- ENSURE REALTIME IS ENABLED FOR TABLES
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
exception
  when others then null;
end $$;

-- Enable realtime for tables (adding to publication)
alter publication supabase_realtime add table public.bookings;
alter publication supabase_realtime add table public.trainers;
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.notifications;

-- 12. CREATE SLOT RESERVATIONS TABLE
CREATE TABLE IF NOT EXISTS public.slot_reservations (
    id TEXT PRIMARY KEY,
    slot_time TEXT NOT NULL,
    slot_date TEXT NOT NULL,
    trainer_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    expires_at BIGINT NOT NULL
);

-- Enable realtime for slot_reservations
alter publication supabase_realtime add table public.slot_reservations;

-- ADD UNIQUE INDEX TO PREVENT DOUBLE BOOKINGS AT DATABASE LEVEL
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_trainer_slot 
ON public.bookings (trainer_id, date, time) 
WHERE (status != 'cancelled');

-- ADD UNIQUE INDEX TO PREVENT DOUBLE SLOT RESERVATIONS AT DATABASE LEVEL
CREATE UNIQUE INDEX IF NOT EXISTS unique_trainer_slot_reservation 
ON public.slot_reservations (trainer_id, slot_date, slot_time);

