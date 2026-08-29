-- Migration: Isolated Trainer Travel Location Tracking
-- Created At: 2026-08-29
-- Description: Creates the trainer_travel_locations table, secure identity resolver function, automated cleanup trigger, RLS policies, and registers the table for Supabase Realtime changes.

-- 1. Create secure identity resolver function
CREATE OR REPLACE FUNCTION public.resolve_secure_user_id()
RETURNS text 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    CASE 
      WHEN public.is_local_development() THEN (current_setting('request.headers', true)::jsonb->>'x-user-id')
      ELSE NULL 
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_secure_user_id() TO anon, authenticated;

-- 2. Create isolated trainer travel locations table
CREATE TABLE IF NOT EXISTS public.trainer_travel_locations (
  booking_id text PRIMARY KEY REFERENCES public.bookings(id) ON DELETE CASCADE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy double precision NOT NULL,
  heading double precision,
  speed double precision,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.trainer_travel_locations ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies (Hardened and split by action)
-- Write access (INSERT): Only the assigned trainer can insert coordinates
DROP POLICY IF EXISTS "Enable insert access for assigned trainer" ON public.trainer_travel_locations;
CREATE POLICY "Enable insert access for assigned trainer" ON public.trainer_travel_locations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    public.resolve_secure_user_id() = (SELECT trainer_id FROM public.bookings WHERE id = booking_id)
  );

-- Write access (UPDATE): Only the assigned trainer can update coordinates
DROP POLICY IF EXISTS "Enable update access for assigned trainer" ON public.trainer_travel_locations;
CREATE POLICY "Enable update access for assigned trainer" ON public.trainer_travel_locations
  FOR UPDATE
  TO anon, authenticated
  USING (
    public.resolve_secure_user_id() = (SELECT trainer_id FROM public.bookings WHERE id = booking_id)
  )
  WITH CHECK (
    public.resolve_secure_user_id() = (SELECT trainer_id FROM public.bookings WHERE id = booking_id)
  );

-- Write access (DELETE): Only the assigned trainer can delete coordinates
DROP POLICY IF EXISTS "Enable delete access for assigned trainer" ON public.trainer_travel_locations;
CREATE POLICY "Enable delete access for assigned trainer" ON public.trainer_travel_locations
  FOR DELETE
  TO anon, authenticated
  USING (
    public.resolve_secure_user_id() = (SELECT trainer_id FROM public.bookings WHERE id = booking_id)
  );

-- Read access (SELECT): Only the assigned client, trainer, or admin can read location
DROP POLICY IF EXISTS "Enable read access for participants and admin" ON public.trainer_travel_locations;
CREATE POLICY "Enable read access for participants and admin" ON public.trainer_travel_locations
  FOR SELECT
  TO anon, authenticated
  USING (
    public.resolve_secure_user_id() = (SELECT client_id FROM public.bookings WHERE id = booking_id)
    OR public.resolve_secure_user_id() = (SELECT trainer_id FROM public.bookings WHERE id = booking_id)
    OR public.is_admin(public.resolve_secure_user_id())
  );

-- 5. Create automated cleanup trigger on bookings
CREATE OR REPLACE FUNCTION public.cleanup_trainer_location()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.timeline_status IS DISTINCT FROM 'TRAINER_TRAVELLING' THEN
    DELETE FROM public.trainer_travel_locations WHERE booking_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_trainer_location() TO anon, authenticated;

DROP TRIGGER IF EXISTS trg_cleanup_trainer_location ON public.bookings;
CREATE TRIGGER trg_cleanup_trainer_location
  AFTER UPDATE OF timeline_status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_trainer_location();

-- 6. Add table to Supabase Realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'trainer_travel_locations'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.trainer_travel_locations;
    END IF;
  END IF;
END;
$$;
