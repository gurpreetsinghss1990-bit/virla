-- Migration: Secure RLS policies via public.get_current_user_id()
-- Created At: 2026-08-24

-- 1. Create secure identity resolver function
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_sub text;
BEGIN
  -- Local Development Fallback
  IF public.is_local_development() THEN
    RETURN COALESCE(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      current_setting('request.headers', true)::jsonb->>'x-user-id',
      ''
    );
  END IF;

  -- Remote TestFlight/Production secure JWT sub resolution
  v_sub := nullif(current_setting('request.jwt.claim.sub', true), '');
  
  -- Map GoTrue UUIDs of demo accounts to text-based IDs
  IF v_sub = 'd3b07384-d113-4ec5-a5d7-be7c21e6be7c' THEN
    RETURN 'demo.trainer';
  ELSIF v_sub = 'a8e0f9b6-7c0b-4680-8df3-1c887d188fdc' THEN
    RETURN 'u-testclient';
  END IF;

  RETURN v_sub;
END;
$$;


-- 2. Update users table policies
DROP POLICY IF EXISTS "Enable SELECT for self or admin" ON public.users;
DROP POLICY IF EXISTS "Enable UPDATE for self or admin" ON public.users;
DROP POLICY IF EXISTS "Enable DELETE for self or admin" ON public.users;
DROP POLICY IF EXISTS "Enable INSERT for admin" ON public.users;

CREATE POLICY "Enable SELECT for self or admin" ON public.users FOR SELECT USING (
  id = public.get_current_user_id() OR public.is_admin(public.get_current_user_id())
);
CREATE POLICY "Enable UPDATE for self or admin" ON public.users FOR UPDATE USING (
  id = public.get_current_user_id() OR public.is_admin(public.get_current_user_id())
) WITH CHECK (
  id = public.get_current_user_id() OR public.is_admin(public.get_current_user_id())
);
CREATE POLICY "Enable DELETE for self or admin" ON public.users FOR DELETE USING (
  id = public.get_current_user_id() OR public.is_admin(public.get_current_user_id())
);
CREATE POLICY "Enable INSERT for admin" ON public.users FOR INSERT WITH CHECK (
  public.is_admin(public.get_current_user_id())
);


-- 3. Update user_profiles table policies
DROP POLICY IF EXISTS "Enable SELECT for self or assigned trainer" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable UPDATE profile details except credits" ON public.user_profiles;

CREATE POLICY "Enable SELECT for self or assigned trainer" ON public.user_profiles FOR SELECT USING (
  user_id = public.get_current_user_id()
  OR EXISTS (
    SELECT 1 FROM public.bookings
    WHERE client_id = user_profiles.user_id AND trainer_id = public.get_current_user_id()
  )
);
CREATE POLICY "Enable UPDATE profile details except credits" ON public.user_profiles FOR UPDATE USING (
  user_id = public.get_current_user_id() OR public.is_admin(public.get_current_user_id())
) WITH CHECK (
  (user_id = public.get_current_user_id() AND credits_balance IS NOT DISTINCT FROM public.get_profile_credits(id))
  OR public.is_admin(public.get_current_user_id())
);


-- 4. Update trainers table policies
DROP POLICY IF EXISTS "Enable SELECT for authenticated users" ON public.trainers;
DROP POLICY IF EXISTS "Enable UPDATE for trainers self only" ON public.trainers;

CREATE POLICY "Enable SELECT for authenticated users" ON public.trainers FOR SELECT TO public USING (
  id = public.get_current_user_id()
  OR public.is_admin(public.get_current_user_id())
  OR (
    public.get_current_user_id() IS NOT NULL
    AND (preferences->>'online')::boolean = true
    AND operating_location_status = 'verified'
  )
);
CREATE POLICY "Enable UPDATE for trainers self only" ON public.trainers FOR UPDATE USING (
  id = public.get_current_user_id() OR public.is_admin(public.get_current_user_id())
) WITH CHECK (
  (
    id = public.get_current_user_id()
    AND price IS NOT DISTINCT FROM (SELECT price FROM public.trainers WHERE id = trainers.id)
    AND rating IS NOT DISTINCT FROM (SELECT rating FROM public.trainers WHERE id = trainers.id)
    AND rating_count IS NOT DISTINCT FROM (SELECT rating_count FROM public.trainers WHERE id = trainers.id)
    AND completed_sessions IS NOT DISTINCT FROM (SELECT completed_sessions FROM public.trainers WHERE id = trainers.id)
    AND verified_badge IS NOT DISTINCT FROM (SELECT verified_badge FROM public.trainers WHERE id = trainers.id)
    AND level IS NOT DISTINCT FROM (SELECT level FROM public.trainers WHERE id = trainers.id)
    AND operating_address IS NOT DISTINCT FROM (SELECT operating_address FROM public.trainers WHERE id = trainers.id)
    AND operating_latitude IS NOT DISTINCT FROM (SELECT operating_latitude FROM public.trainers WHERE id = trainers.id)
    AND operating_longitude IS NOT DISTINCT FROM (SELECT operating_longitude FROM public.trainers WHERE id = trainers.id)
    AND operating_place_id IS NOT DISTINCT FROM (SELECT operating_place_id FROM public.trainers WHERE id = trainers.id)
    AND operating_location_status IS NOT DISTINCT FROM (SELECT operating_location_status FROM public.trainers WHERE id = trainers.id)
  )
  OR public.is_admin(public.get_current_user_id())
);


-- 5. Update trainer_workout_assignments table policies
DROP POLICY IF EXISTS "Enable SELECT for authenticated users" ON public.trainer_workout_assignments;

CREATE POLICY "Enable SELECT for authenticated users" ON public.trainer_workout_assignments FOR SELECT TO public USING (
  trainer_id = public.get_current_user_id()
  OR public.is_admin(public.get_current_user_id())
  OR (
    public.get_current_user_id() IS NOT NULL
    AND status = 'APPROVED'
    AND EXISTS (
      SELECT 1 FROM public.trainers t
      WHERE t.id = trainer_workout_assignments.trainer_id
      AND (t.preferences->>'online')::boolean = true
      AND t.operating_location_status = 'verified'
    )
  )
);


-- 6. Update workouts table policies
DROP POLICY IF EXISTS "Enable SELECT for authenticated users" ON public.workouts;

CREATE POLICY "Enable SELECT for authenticated users" ON public.workouts FOR SELECT TO public USING (
  public.get_current_user_id() IS NOT NULL
);


-- 7. Update bookings table policies
DROP POLICY IF EXISTS "Enable SELECT for participant" ON public.bookings;
DROP POLICY IF EXISTS "Enable UPDATE for participant" ON public.bookings;
DROP POLICY IF EXISTS "Enable INSERT for client" ON public.bookings;
DROP POLICY IF EXISTS "Restrict bookings updates to non-timeline fields" ON public.bookings;

CREATE POLICY "Enable SELECT for participant" ON public.bookings FOR SELECT USING (
  client_id = public.get_current_user_id() OR trainer_id = public.get_current_user_id() OR public.is_admin(public.get_current_user_id())
);
CREATE POLICY "Enable INSERT for client" ON public.bookings FOR INSERT WITH CHECK (
  client_id = public.get_current_user_id() OR public.is_admin(public.get_current_user_id())
);
CREATE POLICY "Restrict bookings updates to non-timeline fields" ON public.bookings FOR UPDATE USING (
  client_id = public.get_current_user_id() OR trainer_id = public.get_current_user_id() OR public.is_admin(public.get_current_user_id())
) WITH CHECK (
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
  OR public.is_admin(public.get_current_user_id())
);


-- 8. Update slot_reservations table policies
DROP POLICY IF EXISTS "Enable SELECT for authenticated users" ON public.slot_reservations;
DROP POLICY IF EXISTS "Enable INSERT for owner or admin" ON public.slot_reservations;
DROP POLICY IF EXISTS "Enable DELETE for owner, expired, or admin" ON public.slot_reservations;

CREATE POLICY "Enable SELECT for authenticated users" ON public.slot_reservations FOR SELECT TO public USING (
  client_id = public.get_current_user_id()
  OR trainer_id = public.get_current_user_id()
  OR public.is_admin(public.get_current_user_id())
  OR (
    public.get_current_user_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.trainers t
      WHERE t.id = slot_reservations.trainer_id
      AND (t.preferences->>'online')::boolean = true
      AND t.operating_location_status = 'verified'
    )
  )
);
CREATE POLICY "Enable INSERT for owner or admin" ON public.slot_reservations FOR INSERT WITH CHECK (
  client_id = public.get_current_user_id() OR public.is_admin(public.get_current_user_id())
);
CREATE POLICY "Enable DELETE for owner, expired, or admin" ON public.slot_reservations FOR DELETE USING (
  client_id = public.get_current_user_id() OR expires_at <= now() OR public.is_admin(public.get_current_user_id())
);


-- 9. Update addresses table policies
DROP POLICY IF EXISTS "Enable all for self only" ON public.addresses;

CREATE POLICY "Enable all for self only" ON public.addresses FOR ALL USING (
  user_id = public.get_current_user_id() OR public.is_admin(public.get_current_user_id())
) WITH CHECK (
  user_id = public.get_current_user_id() OR public.is_admin(public.get_current_user_id())
);


-- 10. Update credit_transactions table policies
DROP POLICY IF EXISTS "Enable SELECT for self only" ON public.credit_transactions;
DROP POLICY IF EXISTS "Restrict INSERT for transactions to system RPC" ON public.credit_transactions;

CREATE POLICY "Enable SELECT for self only" ON public.credit_transactions FOR SELECT USING (
  user_id = public.get_current_user_id() OR public.is_admin(public.get_current_user_id())
);
CREATE POLICY "Restrict INSERT for transactions to system RPC" ON public.credit_transactions FOR INSERT WITH CHECK (
  public.is_admin(public.get_current_user_id())
);


-- 11. Update chat_messages table policies
DROP POLICY IF EXISTS "Enable SELECT for participant" ON public.chat_messages;
DROP POLICY IF EXISTS "Enable INSERT for participant" ON public.chat_messages;

CREATE POLICY "Enable SELECT for participant" ON public.chat_messages FOR SELECT USING (
  chat_id LIKE '%' || public.get_current_user_id() || '%' OR public.is_admin(public.get_current_user_id())
);
CREATE POLICY "Enable INSERT for participant" ON public.chat_messages FOR INSERT WITH CHECK (
  chat_id LIKE '%' || public.get_current_user_id() || '%' OR public.is_admin(public.get_current_user_id())
);


-- 12. Update trainer_applications table policies
DROP POLICY IF EXISTS "Enable SELECT for owner or admin" ON public.trainer_applications;
DROP POLICY IF EXISTS "Enable UPDATE for owner or admin" ON public.trainer_applications;
DROP POLICY IF EXISTS "Enable INSERT for all" ON public.trainer_applications;

CREATE POLICY "Enable SELECT for owner or admin" ON public.trainer_applications FOR SELECT USING (
  phone = (SELECT phone FROM public.users WHERE id = public.get_current_user_id()) OR public.is_admin(public.get_current_user_id())
);
CREATE POLICY "Enable UPDATE for owner or admin" ON public.trainer_applications FOR UPDATE USING (
  phone = (SELECT phone FROM public.users WHERE id = public.get_current_user_id()) OR public.is_admin(public.get_current_user_id())
);
CREATE POLICY "Enable INSERT for all" ON public.trainer_applications FOR INSERT WITH CHECK (true);
