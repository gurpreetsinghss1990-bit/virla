ALTER TABLE public.trainers ADD COLUMN IF NOT EXISTS service_radius_km INTEGER DEFAULT 5;
ALTER TABLE public.trainers ALTER COLUMN service_radius_km SET DEFAULT 5;
UPDATE public.trainers SET service_radius_km = 5;
UPDATE public.trainers SET preferences = jsonb_set(preferences, '{radiusKm}', '5'::jsonb) WHERE preferences IS NOT NULL;
