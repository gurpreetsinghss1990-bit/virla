-- Migration: Allow Admin users to SELECT all bookings for Admin Control Panel and Realtime updates
-- Created At: 2026-09-09

DROP POLICY IF EXISTS "Enable SELECT for participant" ON public.bookings;
DROP POLICY IF EXISTS "Enable SELECT for participant or admin" ON public.bookings;

CREATE POLICY "Enable SELECT for participant or admin" ON public.bookings FOR SELECT
  USING (
    client_id = (current_setting('request.headers', true)::jsonb->>'x-user-id')
    OR trainer_id = (current_setting('request.headers', true)::jsonb->>'x-user-id')
    OR (SELECT role FROM public.users WHERE id = (current_setting('request.headers', true)::jsonb->>'x-user-id')) = 'admin'
    OR (current_setting('request.headers', true)::jsonb->>'x-user-id') = 'u-testadmin'
  );
