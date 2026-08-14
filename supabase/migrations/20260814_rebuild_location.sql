-- Migration: Rebuild Location System with Real GPS & Google Places columns
-- Created At: 2026-08-14

-- 1. Alter public.addresses table
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS apartment TEXT;
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS floor TEXT;
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS place_id TEXT;

-- 2. Alter public.trainers table
ALTER TABLE public.trainers ADD COLUMN IF NOT EXISTS operating_address TEXT;
ALTER TABLE public.trainers ADD COLUMN IF NOT EXISTS operating_latitude DOUBLE PRECISION;
ALTER TABLE public.trainers ADD COLUMN IF NOT EXISTS operating_longitude DOUBLE PRECISION;
ALTER TABLE public.trainers ADD COLUMN IF NOT EXISTS operating_place_id TEXT;
ALTER TABLE public.trainers ADD COLUMN IF NOT EXISTS operating_location_status TEXT DEFAULT 'pending';
ALTER TABLE public.trainers ADD COLUMN IF NOT EXISTS service_radius_km INTEGER DEFAULT 15;
ALTER TABLE public.trainers ADD COLUMN IF NOT EXISTS address_change_request JSONB;

-- 3. Alter public.user_profiles table
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS home_address TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS home_latitude DOUBLE PRECISION;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS home_longitude DOUBLE PRECISION;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS home_place_id TEXT;
