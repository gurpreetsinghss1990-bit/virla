-- Migration: Phase 4.1 Application Integration Hardening
-- Created At: 2026-08-21
-- Target: LOCAL ONLY

-- 1. Create secure purchase_credits SECURITY DEFINER RPC
CREATE OR REPLACE FUNCTION public.purchase_credits(
  p_plan_name text,
  p_credits integer,
  p_amount text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user_id text;
  v_tx_id text;
  v_date text;
BEGIN
  -- Resolve caller identity: try auth.uid() first, fall back to x-user-id header
  v_user_id := auth.uid()::text;
  IF v_user_id IS NULL OR v_user_id = '' THEN
    BEGIN
      v_user_id := current_setting('request.headers', true)::jsonb->>'x-user-id';
    EXCEPTION WHEN OTHERS THEN
      v_user_id := NULL;
    END;
  END IF;

  IF v_user_id IS NULL OR v_user_id = '' THEN
     RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_credits <= 0 THEN
     RAISE EXCEPTION 'Credits quantity must be greater than zero.';
  END IF;

  -- Validate amount against credit quantity matching client pricing plans
  IF p_credits = 1 AND p_plan_name = 'Single Session' AND p_amount != '₹1,270' THEN
     RAISE EXCEPTION 'Invalid amount for Single Session. Expected: ₹1,270, got: %', p_amount;
  ELSIF p_credits = 8 AND p_plan_name = 'Starter Pack' AND p_amount != '₹9,321' THEN
     RAISE EXCEPTION 'Invalid amount for Starter Pack. Expected: ₹9,321, got: %', p_amount;
  ELSIF p_credits = 12 AND p_plan_name = 'Active Pack' AND p_amount != '₹10,169' THEN
     RAISE EXCEPTION 'Invalid amount for Active Pack. Expected: ₹10,169, got: %', p_amount;
  ELSIF p_credits = 15 AND p_plan_name = 'Elite Pack' AND p_amount != '₹15,253' THEN
     RAISE EXCEPTION 'Invalid amount for Elite Pack. Expected: ₹15,253, got: %', p_amount;
  ELSIF p_credits = 1 AND p_plan_name = 'Couple Single Session' AND p_amount != '₹2,118' THEN
     RAISE EXCEPTION 'Invalid amount for Couple Single Session. Expected: ₹2,118, got: %', p_amount;
  ELSIF p_credits = 8 AND p_plan_name = 'Couple Starter Pack' AND p_amount != '₹15,253' THEN
     RAISE EXCEPTION 'Invalid amount for Couple Starter Pack. Expected: ₹15,253, got: %', p_amount;
  ELSIF p_credits = 12 AND p_plan_name = 'Couple Active Pack' AND p_amount != '₹16,270' THEN
     RAISE EXCEPTION 'Invalid amount for Couple Active Pack. Expected: ₹16,270, got: %', p_amount;
  ELSIF p_credits = 15 AND p_plan_name = 'Couple Elite Pack' AND p_amount != '₹25,423' THEN
     RAISE EXCEPTION 'Invalid amount for Couple Elite Pack. Expected: ₹25,423, got: %', p_amount;
  END IF;

  -- Atomically increment user profile credits
  UPDATE public.user_profiles
  SET credits_balance = credits_balance + p_credits
  WHERE user_id = v_user_id;

  IF NOT FOUND THEN
     RAISE EXCEPTION 'User profile not found.';
  END IF;

  v_tx_id := 'tx-' || extract(epoch from now())::bigint || '-' || floor(random() * 1000)::text;
  v_date := to_char(now(), 'Mon DD, YYYY');

  -- Insert ledger transaction
  INSERT INTO public.credit_transactions (id, user_id, type, amount, date, status, credits)
  VALUES (v_tx_id, v_user_id, 'purchase', p_amount, v_date, 'paid', p_credits);

  RETURN jsonb_build_object(
    'success', true,
    'tx_id', v_tx_id,
    'date', v_date,
    'new_balance', (SELECT credits_balance FROM public.user_profiles WHERE user_id = v_user_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_credits(text, integer, text) TO authenticated;

-- 2. Drop simulation policy on trainers
DROP POLICY IF EXISTS "Enable read/write for simulation trainers" ON public.trainers;

-- 3. Secure policies on public.trainers
DROP POLICY IF EXISTS "Enable SELECT for authenticated users" ON public.trainers;
CREATE POLICY "Enable SELECT for authenticated users" ON public.trainers
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable UPDATE for trainers self only" ON public.trainers;
CREATE POLICY "Enable UPDATE for trainers self only" ON public.trainers
  FOR UPDATE USING (id = auth.uid()::text OR public.is_admin(auth.uid()::text))
  WITH CHECK (
    (
      id = auth.uid()::text AND
      price IS NOT DISTINCT FROM (SELECT price FROM public.trainers WHERE id = auth.uid()::text) AND
      rating IS NOT DISTINCT FROM (SELECT rating FROM public.trainers WHERE id = auth.uid()::text) AND
      rating_count IS NOT DISTINCT FROM (SELECT rating_count FROM public.trainers WHERE id = auth.uid()::text) AND
      completed_sessions IS NOT DISTINCT FROM (SELECT completed_sessions FROM public.trainers WHERE id = auth.uid()::text) AND
      verified_badge IS NOT DISTINCT FROM (SELECT verified_badge FROM public.trainers WHERE id = auth.uid()::text) AND
      level IS NOT DISTINCT FROM (SELECT level FROM public.trainers WHERE id = auth.uid()::text) AND
      operating_address IS NOT DISTINCT FROM (SELECT operating_address FROM public.trainers WHERE id = auth.uid()::text) AND
      operating_latitude IS NOT DISTINCT FROM (SELECT operating_latitude FROM public.trainers WHERE id = auth.uid()::text) AND
      operating_longitude IS NOT DISTINCT FROM (SELECT operating_longitude FROM public.trainers WHERE id = auth.uid()::text) AND
      operating_place_id IS NOT DISTINCT FROM (SELECT operating_place_id FROM public.trainers WHERE id = auth.uid()::text) AND
      operating_location_status IS NOT DISTINCT FROM (SELECT operating_location_status FROM public.trainers WHERE id = auth.uid()::text)
    )
    OR public.is_admin(auth.uid()::text)
  );

-- 4. Drop simulation policy on trainer_workout_assignments
DROP POLICY IF EXISTS "Enable read/write for simulation trainer_workout_assignments" ON public.trainer_workout_assignments;

-- 5. Secure policies on public.trainer_workout_assignments
DROP POLICY IF EXISTS "Enable SELECT for authenticated users" ON public.trainer_workout_assignments;
CREATE POLICY "Enable SELECT for authenticated users" ON public.trainer_workout_assignments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable INSERT for trainers own assignments only" ON public.trainer_workout_assignments;
CREATE POLICY "Enable INSERT for trainers own assignments only" ON public.trainer_workout_assignments
  FOR INSERT WITH CHECK (
    (trainer_id = auth.uid()::text AND status = 'PENDING')
    OR public.is_admin(auth.uid()::text)
  );

DROP POLICY IF EXISTS "Enable UPDATE for own assignments or admin" ON public.trainer_workout_assignments;
CREATE POLICY "Enable UPDATE for own assignments or admin" ON public.trainer_workout_assignments
  FOR UPDATE USING (trainer_id = auth.uid()::text OR public.is_admin(auth.uid()::text))
  WITH CHECK (
    (
      trainer_id = auth.uid()::text AND
      (
        (status = 'REMOVAL_REQUESTED' AND (SELECT status FROM public.trainer_workout_assignments WHERE id = trainer_workout_assignments.id) = 'APPROVED')
        OR
        (status = 'PENDING' AND (SELECT status FROM public.trainer_workout_assignments WHERE id = trainer_workout_assignments.id) = 'REJECTED')
      ) AND
      workout_category IS NOT DISTINCT FROM (SELECT workout_category FROM public.trainer_workout_assignments WHERE id = trainer_workout_assignments.id) AND
      approved_at IS NOT DISTINCT FROM (SELECT approved_at FROM public.trainer_workout_assignments WHERE id = trainer_workout_assignments.id) AND
      approved_by IS NOT DISTINCT FROM (SELECT approved_by FROM public.trainer_workout_assignments WHERE id = trainer_workout_assignments.id) AND
      rejected_at IS NOT DISTINCT FROM (SELECT rejected_at FROM public.trainer_workout_assignments WHERE id = trainer_workout_assignments.id) AND
      rejected_by IS NOT DISTINCT FROM (SELECT rejected_by FROM public.trainer_workout_assignments WHERE id = trainer_workout_assignments.id)
    )
    OR public.is_admin(auth.uid()::text)
  );

-- 6. Drop simulation policy on workouts
DROP POLICY IF EXISTS "Enable read/write for simulation workouts" ON public.workouts;

-- 7. Secure policies on public.workouts
DROP POLICY IF EXISTS "Enable SELECT for authenticated users" ON public.workouts;
CREATE POLICY "Enable SELECT for authenticated users" ON public.workouts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable write for admin only" ON public.workouts;
CREATE POLICY "Enable write for admin only" ON public.workouts
  FOR ALL USING (public.is_admin(auth.uid()::text))
  WITH CHECK (public.is_admin(auth.uid()::text));

-- 8. Recreate user_profiles UPDATE policy to support local x-user-id fallback
DROP POLICY IF EXISTS "Enable UPDATE profile details except credits" ON public.user_profiles;
CREATE POLICY "Enable UPDATE profile details except credits" ON public.user_profiles
  FOR UPDATE USING (
    user_id = (current_setting('request.headers', true)::jsonb->>'x-user-id')
    OR public.is_admin(current_setting('request.headers', true)::jsonb->>'x-user-id')
  )
  WITH CHECK (
    (
      user_id = (current_setting('request.headers', true)::jsonb->>'x-user-id')
      AND credits_balance IS NOT DISTINCT FROM (SELECT credits_balance FROM public.user_profiles WHERE user_id = (current_setting('request.headers', true)::jsonb->>'x-user-id'))
    )
    OR public.is_admin(current_setting('request.headers', true)::jsonb->>'x-user-id')
  );

