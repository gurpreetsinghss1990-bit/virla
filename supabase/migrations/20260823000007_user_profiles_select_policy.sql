-- Recreate user_profiles SELECT policy to support trainers reading profiles of clients who have booked them
DROP POLICY IF EXISTS "Enable SELECT for self or assigned trainer" ON public.user_profiles;

CREATE POLICY "Enable SELECT for self or assigned trainer" ON public.user_profiles
  FOR SELECT
  USING (
    user_id = COALESCE(nullif(current_setting('request.jwt.claim.sub', true), ''), (current_setting('request.headers', true)::jsonb->>'x-user-id'))
    OR
    EXISTS (
      SELECT 1 FROM public.bookings
      WHERE client_id = user_profiles.user_id
        AND trainer_id = COALESCE(nullif(current_setting('request.jwt.claim.sub', true), ''), (current_setting('request.headers', true)::jsonb->>'x-user-id'))
    )
  );
