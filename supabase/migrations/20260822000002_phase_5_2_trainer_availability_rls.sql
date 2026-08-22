-- Migration: Phase 5.2 Trainer Availability RLS SELECT Policy Hardening for Local Dev (Strict Row-Level Isolation)
-- Created At: 2026-08-22

-- 1. trainers table
DROP POLICY IF EXISTS "Enable SELECT for authenticated users" ON public.trainers;
CREATE POLICY "Enable SELECT for authenticated users" ON public.trainers
  FOR SELECT TO public USING (
    -- Own trainer record
    (id = auth.uid()::text) OR
    (public.is_local_development() AND id = (current_setting('request.headers', true)::jsonb->>'x-user-id')) OR
    -- Admin bypass
    public.is_admin(auth.uid()::text) OR
    (public.is_local_development() AND public.is_admin(current_setting('request.headers', true)::jsonb->>'x-user-id')) OR
    -- Customer access: Only online and verified trainers required for booking flow
    (
      (auth.role() = 'authenticated' OR (
        public.is_local_development() AND EXISTS (
          SELECT 1 FROM public.users WHERE id = (current_setting('request.headers', true)::jsonb->>'x-user-id')
        )
      )) AND
      (preferences->>'online')::boolean = true AND
      operating_location_status = 'verified'
    )
  );

-- 2. trainer_workout_assignments table
DROP POLICY IF EXISTS "Enable SELECT for authenticated users" ON public.trainer_workout_assignments;
CREATE POLICY "Enable SELECT for authenticated users" ON public.trainer_workout_assignments
  FOR SELECT TO public USING (
    -- Own assignments
    (trainer_id = auth.uid()::text) OR
    (public.is_local_development() AND trainer_id = (current_setting('request.headers', true)::jsonb->>'x-user-id')) OR
    -- Admin bypass
    public.is_admin(auth.uid()::text) OR
    (public.is_local_development() AND public.is_admin(current_setting('request.headers', true)::jsonb->>'x-user-id')) OR
    -- Customer access: Only approved assignments for online and verified trainers
    (
      (auth.role() = 'authenticated' OR (
        public.is_local_development() AND EXISTS (
          SELECT 1 FROM public.users WHERE id = (current_setting('request.headers', true)::jsonb->>'x-user-id')
        )
      )) AND
      status = 'APPROVED' AND
      EXISTS (
        SELECT 1 FROM public.trainers t 
        WHERE t.id = trainer_workout_assignments.trainer_id 
        AND (t.preferences->>'online')::boolean = true 
        AND t.operating_location_status = 'verified'
      )
    )
  );

-- 3. workouts table
DROP POLICY IF EXISTS "Enable SELECT for authenticated users" ON public.workouts;
CREATE POLICY "Enable SELECT for authenticated users" ON public.workouts
  FOR SELECT TO public USING (
    (auth.role() = 'authenticated') OR 
    (public.is_local_development() AND EXISTS (
      SELECT 1 FROM public.users WHERE id = (current_setting('request.headers', true)::jsonb->>'x-user-id')
    ))
  );

-- 4. slot_reservations table
DROP POLICY IF EXISTS "Enable SELECT for authenticated users" ON public.slot_reservations;
CREATE POLICY "Enable SELECT for authenticated users" ON public.slot_reservations
  FOR SELECT TO public USING (
    -- Own reservation (client)
    (client_id = auth.uid()::text) OR
    (public.is_local_development() AND client_id = (current_setting('request.headers', true)::jsonb->>'x-user-id')) OR
    -- Own slots (trainer)
    (trainer_id = auth.uid()::text) OR
    (public.is_local_development() AND trainer_id = (current_setting('request.headers', true)::jsonb->>'x-user-id')) OR
    -- Admin bypass
    public.is_admin(auth.uid()::text) OR
    (public.is_local_development() AND public.is_admin(current_setting('request.headers', true)::jsonb->>'x-user-id')) OR
    -- Customer availability check: view reservation slots for online and verified trainers
    (
      (auth.role() = 'authenticated' OR (
        public.is_local_development() AND EXISTS (
          SELECT 1 FROM public.users WHERE id = (current_setting('request.headers', true)::jsonb->>'x-user-id')
        )
      )) AND
      EXISTS (
        SELECT 1 FROM public.trainers t 
        WHERE t.id = slot_reservations.trainer_id 
        AND (t.preferences->>'online')::boolean = true 
        AND t.operating_location_status = 'verified'
      )
    )
  );
