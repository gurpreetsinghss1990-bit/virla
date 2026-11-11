-- The live-travel policies were written against resolve_secure_user_id(), which
-- only falls back to the x-user-id header in local development. The app never
-- uses Supabase Auth sessions (anon key + x-user-id header), so in production
-- that function returned NULL and the trainer could neither publish nor the
-- client read the live route. get_auth_user_id() resolves the same identity in
-- both environments, so recreate the four policies on top of it.
DO $$
BEGIN
  IF to_regprocedure('public.get_auth_user_id()') IS NULL THEN
    CREATE FUNCTION public.get_auth_user_id()
    RETURNS text AS $fn$
    BEGIN
      RETURN COALESCE(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        (current_setting('request.headers', true)::jsonb->>'x-user-id')
      );
    END;
    $fn$ LANGUAGE plpgsql SECURITY DEFINER;
  END IF;
END;
$$;

DROP POLICY IF EXISTS "Enable insert access for assigned trainer" ON public.trainer_travel_locations;
CREATE POLICY "Enable insert access for assigned trainer" ON public.trainer_travel_locations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    public.get_auth_user_id() = (SELECT trainer_id FROM public.bookings WHERE id = booking_id)
  );

DROP POLICY IF EXISTS "Enable update access for assigned trainer" ON public.trainer_travel_locations;
CREATE POLICY "Enable update access for assigned trainer" ON public.trainer_travel_locations
  FOR UPDATE
  TO anon, authenticated
  USING (
    public.get_auth_user_id() = (SELECT trainer_id FROM public.bookings WHERE id = booking_id)
  )
  WITH CHECK (
    public.get_auth_user_id() = (SELECT trainer_id FROM public.bookings WHERE id = booking_id)
  );

DROP POLICY IF EXISTS "Enable delete access for assigned trainer" ON public.trainer_travel_locations;
CREATE POLICY "Enable delete access for assigned trainer" ON public.trainer_travel_locations
  FOR DELETE
  TO anon, authenticated
  USING (
    public.get_auth_user_id() = (SELECT trainer_id FROM public.bookings WHERE id = booking_id)
  );

DROP POLICY IF EXISTS "Enable read access for participants and admin" ON public.trainer_travel_locations;
CREATE POLICY "Enable read access for participants and admin" ON public.trainer_travel_locations
  FOR SELECT
  TO anon, authenticated
  USING (
    public.get_auth_user_id() = (SELECT client_id FROM public.bookings WHERE id = booking_id)
    OR public.get_auth_user_id() = (SELECT trainer_id FROM public.bookings WHERE id = booking_id)
    OR public.is_admin(public.get_auth_user_id())
  );
