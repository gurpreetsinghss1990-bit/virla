-- Alter public.bookings table to add partner columns
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS participant_count INTEGER DEFAULT 1;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS session_type TEXT DEFAULT 'SINGLE' CHECK (session_type IN ('SINGLE', 'COUPLE'));
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS original_package_type TEXT DEFAULT 'SINGLE' CHECK (original_package_type IN ('SINGLE', 'COUPLE'));
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS partner_name TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS partner_phone TEXT;
