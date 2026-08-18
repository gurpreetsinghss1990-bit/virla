-- ====================================================================
-- SECURITY HARDENING MIGRATION
-- ====================================================================

-- Add registration_status column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS registration_status TEXT DEFAULT 'PROFILE_NAME_PENDING';

-- Drop simulation policies
DROP POLICY IF EXISTS "Enable read/write for simulation users" ON public.users;
DROP POLICY IF EXISTS "Enable read/write for simulation user profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable read/write for simulation hydration logs" ON public.hydration_logs;
DROP POLICY IF EXISTS "Enable read/write for simulation calorie logs" ON public.calorie_logs;
DROP POLICY IF EXISTS "Enable read/write for simulation notifications" ON public.notifications;
DROP POLICY IF EXISTS "Enable read/write for simulation chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Enable read/write for simulation addresses" ON public.addresses;
DROP POLICY IF EXISTS "Enable read/write for simulation credit transactions" ON public.credit_transactions;
DROP POLICY IF EXISTS "Enable read/write for simulation bookings" ON public.bookings;
DROP POLICY IF EXISTS "Enable read/write for simulation trainer applications" ON public.trainer_applications;
DROP POLICY IF EXISTS "Enable read/write for simulation trainer earnings" ON public.trainer_earnings;

-- Create hardened RLS policies matching the current x-user-id client header

-- 1. users
CREATE POLICY "Enable SELECT for self only" ON public.users FOR SELECT
  USING (id = (current_setting('request.headers', true)::jsonb->>'x-user-id'));
CREATE POLICY "Enable UPDATE for self only" ON public.users FOR UPDATE
  USING (id = (current_setting('request.headers', true)::jsonb->>'x-user-id'))
  WITH CHECK (id = (current_setting('request.headers', true)::jsonb->>'x-user-id'));
CREATE POLICY "Enable DELETE for self only" ON public.users FOR DELETE
  USING (id = (current_setting('request.headers', true)::jsonb->>'x-user-id'));

-- 2. user_profiles
CREATE POLICY "Enable SELECT for self only" ON public.user_profiles FOR SELECT
  USING (user_id = (current_setting('request.headers', true)::jsonb->>'x-user-id'));
CREATE POLICY "Enable UPDATE for self only" ON public.user_profiles FOR UPDATE
  USING (user_id = (current_setting('request.headers', true)::jsonb->>'x-user-id'))
  WITH CHECK (user_id = (current_setting('request.headers', true)::jsonb->>'x-user-id'));
CREATE POLICY "Enable DELETE for self only" ON public.user_profiles FOR DELETE
  USING (user_id = (current_setting('request.headers', true)::jsonb->>'x-user-id'));
CREATE POLICY "Enable INSERT for self only" ON public.user_profiles FOR INSERT
  WITH CHECK (user_id = (current_setting('request.headers', true)::jsonb->>'x-user-id'));

-- 3. hydration_logs
CREATE POLICY "Enable all for self only" ON public.hydration_logs FOR ALL
  USING (user_id = (current_setting('request.headers', true)::jsonb->>'x-user-id'))
  WITH CHECK (user_id = (current_setting('request.headers', true)::jsonb->>'x-user-id'));

-- 4. calorie_logs
CREATE POLICY "Enable all for self only" ON public.calorie_logs FOR ALL
  USING (user_id = (current_setting('request.headers', true)::jsonb->>'x-user-id'))
  WITH CHECK (user_id = (current_setting('request.headers', true)::jsonb->>'x-user-id'));

-- 5. notifications
CREATE POLICY "Enable all for self only" ON public.notifications FOR ALL
  USING (user_id = (current_setting('request.headers', true)::jsonb->>'x-user-id'))
  WITH CHECK (user_id = (current_setting('request.headers', true)::jsonb->>'x-user-id'));

-- 6. chat_messages (chat_id contains user_id as substring)
CREATE POLICY "Enable SELECT for participant" ON public.chat_messages FOR SELECT
  USING (chat_id LIKE '%' || (current_setting('request.headers', true)::jsonb->>'x-user-id') || '%');
CREATE POLICY "Enable INSERT for participant" ON public.chat_messages FOR INSERT
  WITH CHECK (chat_id LIKE '%' || (current_setting('request.headers', true)::jsonb->>'x-user-id') || '%');

-- 7. addresses
CREATE POLICY "Enable all for self only" ON public.addresses FOR ALL
  USING (user_id = (current_setting('request.headers', true)::jsonb->>'x-user-id'))
  WITH CHECK (user_id = (current_setting('request.headers', true)::jsonb->>'x-user-id'));

-- 8. credit_transactions
CREATE POLICY "Enable SELECT for self only" ON public.credit_transactions FOR SELECT
  USING (user_id = (current_setting('request.headers', true)::jsonb->>'x-user-id'));
CREATE POLICY "Enable INSERT for self only" ON public.credit_transactions FOR INSERT
  WITH CHECK (user_id = (current_setting('request.headers', true)::jsonb->>'x-user-id'));

-- 9. bookings
CREATE POLICY "Enable SELECT for participant" ON public.bookings FOR SELECT
  USING (client_id = (current_setting('request.headers', true)::jsonb->>'x-user-id') OR trainer_id = (current_setting('request.headers', true)::jsonb->>'x-user-id'));
CREATE POLICY "Enable UPDATE for participant" ON public.bookings FOR UPDATE
  USING (client_id = (current_setting('request.headers', true)::jsonb->>'x-user-id') OR trainer_id = (current_setting('request.headers', true)::jsonb->>'x-user-id'))
  WITH CHECK (client_id = (current_setting('request.headers', true)::jsonb->>'x-user-id') OR trainer_id = (current_setting('request.headers', true)::jsonb->>'x-user-id'));
CREATE POLICY "Enable INSERT for client" ON public.bookings FOR INSERT
  WITH CHECK (client_id = (current_setting('request.headers', true)::jsonb->>'x-user-id'));

-- 10. trainer_applications (does not have user_id, queries by phone or admin role)
CREATE POLICY "Enable SELECT for owner or admin" ON public.trainer_applications FOR SELECT
  USING (
    phone = (SELECT phone FROM public.users WHERE id = (current_setting('request.headers', true)::jsonb->>'x-user-id'))
    OR (SELECT role FROM public.users WHERE id = (current_setting('request.headers', true)::jsonb->>'x-user-id')) = 'admin'
  );
CREATE POLICY "Enable INSERT for all" ON public.trainer_applications FOR INSERT
  WITH CHECK (true);
CREATE POLICY "Enable UPDATE for owner or admin" ON public.trainer_applications FOR UPDATE
  USING (
    phone = (SELECT phone FROM public.users WHERE id = (current_setting('request.headers', true)::jsonb->>'x-user-id'))
    OR (SELECT role FROM public.users WHERE id = (current_setting('request.headers', true)::jsonb->>'x-user-id')) = 'admin'
  )
  WITH CHECK (
    phone = (SELECT phone FROM public.users WHERE id = (current_setting('request.headers', true)::jsonb->>'x-user-id'))
    OR (SELECT role FROM public.users WHERE id = (current_setting('request.headers', true)::jsonb->>'x-user-id')) = 'admin'
  );

-- 11. trainer_earnings
CREATE POLICY "Enable SELECT for trainer only" ON public.trainer_earnings FOR SELECT
  USING (trainer_id = (current_setting('request.headers', true)::jsonb->>'x-user-id'));
