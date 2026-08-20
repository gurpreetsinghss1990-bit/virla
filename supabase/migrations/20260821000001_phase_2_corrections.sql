-- 20260821000001_phase_2_corrections.sql
-- Correct Phase 2 issues:
-- 1. Convert bookings.auto_accepted_at from BIGINT (Unix milliseconds) to timestamptz (idempotent block)
-- 2. Add trainer_check_in RPC wrapper delegating to mark_trainer_arrived (idempotent definition)

-- 1. DROP policy that depends on auto_accepted_at
DROP POLICY IF EXISTS "Restrict bookings updates to non-timeline fields" ON public.bookings;

-- 2. ALTER bookings.auto_accepted_at conditionally if it is bigint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'bookings' 
      AND column_name = 'auto_accepted_at' 
      AND data_type = 'bigint'
  ) THEN
    ALTER TABLE public.bookings 
      ALTER COLUMN auto_accepted_at TYPE timestamptz 
      USING to_timestamp(auto_accepted_at / 1000.0);
  END IF;
END $$;

-- 3. RECREATE policy (now safe regardless of column type)
CREATE POLICY "Restrict bookings updates to non-timeline fields" ON public.bookings
  FOR UPDATE USING (client_id = auth.uid()::text OR trainer_id = auth.uid()::text OR public.is_admin(auth.uid()::text))
  WITH CHECK (
    (
      status IS NOT DISTINCT FROM (SELECT status FROM public.bookings WHERE id = bookings.id) AND
      timeline_status IS NOT DISTINCT FROM (SELECT timeline_status FROM public.bookings WHERE id = bookings.id) AND
      scheduled_start_at IS NOT DISTINCT FROM (SELECT scheduled_start_at FROM public.bookings WHERE id = bookings.id) AND
      scheduled_end_at IS NOT DISTINCT FROM (SELECT scheduled_end_at FROM public.bookings WHERE id = bookings.id) AND
      travel_started_at IS NOT DISTINCT FROM (SELECT travel_started_at FROM public.bookings WHERE id = bookings.id) AND
      trainer_arrived_at IS NOT DISTINCT FROM (SELECT trainer_arrived_at FROM public.bookings WHERE id = bookings.id) AND
      session_started_at IS NOT DISTINCT FROM (SELECT session_started_at FROM public.bookings WHERE id = bookings.id) AND
      session_completed_at IS NOT DISTINCT FROM (SELECT session_completed_at FROM public.bookings WHERE id = bookings.id) AND
      otp IS NOT DISTINCT FROM (SELECT otp FROM public.bookings WHERE id = bookings.id) AND
      otp_expires_at IS NOT DISTINCT FROM (SELECT otp_expires_at FROM public.bookings WHERE id = bookings.id) AND
      manual_accepted_at IS NOT DISTINCT FROM (SELECT manual_accepted_at FROM public.bookings WHERE id = bookings.id) AND
      auto_accepted_at IS NOT DISTINCT FROM (SELECT auto_accepted_at FROM public.bookings WHERE id = bookings.id)
    )
    OR public.is_admin(auth.uid()::text)
  );

-- 4. ADD trainer_check_in wrapper with search_path set
CREATE OR REPLACE FUNCTION public.trainer_check_in(
  p_booking_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.mark_trainer_arrived(p_booking_id);
END;
$$;

-- 5. Harden execution privileges
REVOKE ALL ON FUNCTION public.trainer_check_in(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trainer_check_in(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trainer_check_in(text) TO service_role;
