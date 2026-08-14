-- Migration: Add Missing Columns to Bookings Table
-- Created At: 2026-08-15
-- Description: Adds all missing application-state columns to the bookings table.

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS created_at BIGINT DEFAULT (extract(epoch from now()) * 1000)::BIGINT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS trainer_note TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS current_trainer_index INTEGER DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS grace_period_started_at BIGINT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS otp_expires_at BIGINT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS workout_started_at BIGINT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS trainer_level TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS trainer_rating NUMERIC(3,2) DEFAULT 5.0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS trainer_completed_sessions INTEGER DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS trainer_speciality TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS trainer_languages TEXT[] DEFAULT '{}'::text[];
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS trainer_distance TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS trainer_arrival_time TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS calories_burned INTEGER DEFAULT 0;
