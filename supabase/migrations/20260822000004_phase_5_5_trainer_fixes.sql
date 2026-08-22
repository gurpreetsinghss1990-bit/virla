-- Migration: Phase 5.5 Trainer RLS UPDATE Policy Fix (Resolve subquery shadowing)
-- Created At: 2026-08-22

DROP POLICY IF EXISTS "Enable UPDATE for trainers self only" ON public.trainers;
CREATE POLICY "Enable UPDATE for trainers self only" ON public.trainers
  FOR UPDATE USING (
    id = auth.uid()::text
    OR (current_setting('app.settings.jwt_secret', true) = 'super-secret-jwt-token-with-at-least-32-characters-long' AND id = (current_setting('request.headers', true)::jsonb->>'x-user-id'))
    OR (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()::text AND u.role = 'admin'))
    OR (current_setting('app.settings.jwt_secret', true) = 'super-secret-jwt-token-with-at-least-32-characters-long' AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = (current_setting('request.headers', true)::jsonb->>'x-user-id') AND u.role = 'admin'))
  )
  WITH CHECK (
    (
      (
        id = auth.uid()::text
        OR (current_setting('app.settings.jwt_secret', true) = 'super-secret-jwt-token-with-at-least-32-characters-long' AND id = (current_setting('request.headers', true)::jsonb->>'x-user-id'))
      )
      AND price IS NOT DISTINCT FROM (SELECT t.price FROM public.trainers t WHERE t.id = trainers.id)
      AND rating IS NOT DISTINCT FROM (SELECT t.rating FROM public.trainers t WHERE t.id = trainers.id)
      AND rating_count IS NOT DISTINCT FROM (SELECT t.rating_count FROM public.trainers t WHERE t.id = trainers.id)
      AND completed_sessions IS NOT DISTINCT FROM (SELECT t.completed_sessions FROM public.trainers t WHERE t.id = trainers.id)
      AND verified_badge IS NOT DISTINCT FROM (SELECT t.verified_badge FROM public.trainers t WHERE t.id = trainers.id)
      AND level IS NOT DISTINCT FROM (SELECT t.level FROM public.trainers t WHERE t.id = trainers.id)
      AND operating_address IS NOT DISTINCT FROM (SELECT t.operating_address FROM public.trainers t WHERE t.id = trainers.id)
      AND operating_latitude IS NOT DISTINCT FROM (SELECT t.operating_latitude FROM public.trainers t WHERE t.id = trainers.id)
      AND operating_longitude IS NOT DISTINCT FROM (SELECT t.operating_longitude FROM public.trainers t WHERE t.id = trainers.id)
      AND operating_place_id IS NOT DISTINCT FROM (SELECT t.operating_place_id FROM public.trainers t WHERE t.id = trainers.id)
      AND operating_location_status IS NOT DISTINCT FROM (SELECT t.operating_location_status FROM public.trainers t WHERE t.id = trainers.id)
    )
    OR (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()::text AND u.role = 'admin'))
    OR (current_setting('app.settings.jwt_secret', true) = 'super-secret-jwt-token-with-at-least-32-characters-long' AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = (current_setting('request.headers', true)::jsonb->>'x-user-id') AND u.role = 'admin'))
  );
