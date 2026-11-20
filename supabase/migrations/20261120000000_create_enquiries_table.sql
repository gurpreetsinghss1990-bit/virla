-- Create enquiries table for website & ad booking leads
CREATE TABLE IF NOT EXISTS public.enquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    workout_experience TEXT,
    trainer_preference TEXT,
    training_address TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    booking_date TEXT,
    booking_time_slot TEXT,
    status TEXT DEFAULT 'pending',
    source TEXT DEFAULT 'website'
);

-- Enable RLS
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

-- Allow public anonymous inserts from website form
DROP POLICY IF EXISTS "Allow anon inserts to enquiries" ON public.enquiries;
CREATE POLICY "Allow anon inserts to enquiries"
ON public.enquiries
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow authenticated admins to view/manage enquiries
DROP POLICY IF EXISTS "Allow authenticated users to read enquiries" ON public.enquiries;
CREATE POLICY "Allow authenticated users to read enquiries"
ON public.enquiries
FOR SELECT
TO authenticated
USING (true);
