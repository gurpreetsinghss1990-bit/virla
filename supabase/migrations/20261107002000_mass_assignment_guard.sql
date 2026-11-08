-- Migration: Mass assignment hardening (server-owned columns)
-- Created At: 2026-11-07
-- Description: Blocks clients from writing privileged columns on their own rows
-- (role escalation, verification, ratings, credits, earnings, booking identity).
-- Server-side paths (edge functions with the service role, SECURITY DEFINER RPCs)
-- run as the table owner/service role and are unaffected.

-- 1. True when the request is made with a service-role key or by the DB owner.
CREATE OR REPLACE FUNCTION public.request_is_service_role()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role', 'supabase_storage_admin') THEN
    RETURN true;
  END IF;
  BEGIN
    v_role := (nullif(current_setting('request.jwt.claims', true), '')::jsonb) ->> 'role';
  EXCEPTION WHEN others THEN
    v_role := NULL;
  END;
  RETURN COALESCE(v_role = 'service_role', false);
END;
$$;

-- 2. True when the acting user row says role = 'admin'.
CREATE OR REPLACE FUNCTION public.request_actor_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = public.get_auth_user_id() AND u.role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.request_is_privileged()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.request_is_service_role() OR public.request_actor_is_admin();
$$;

-- 3. Generic guard: compare the listed columns between OLD and NEW.
CREATE OR REPLACE FUNCTION public.guard_protected_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_col text;
  v_old jsonb := to_jsonb(OLD);
  v_new jsonb := to_jsonb(NEW);
BEGIN
  IF public.request_is_privileged() THEN
    RETURN NEW;
  END IF;
  FOREACH v_col IN ARRAY TG_ARGV LOOP
    IF v_new -> v_col IS DISTINCT FROM v_old -> v_col THEN
      RAISE EXCEPTION 'Column % is server-owned and cannot be modified by this account', v_col
        USING ERRCODE = '42501';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

-- 4. users: role may only move customer -> trainer on self-service.
CREATE OR REPLACE FUNCTION public.guard_user_role_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;
  IF public.request_is_privileged() THEN
    RETURN NEW;
  END IF;
  IF OLD.role = 'customer' AND NEW.role = 'trainer' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Role change from % to % is not allowed', OLD.role, NEW.role
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS guard_users_protected_columns ON public.users;
CREATE TRIGGER guard_users_protected_columns
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_protected_columns(
    'id', 'created_date', 'password_hash', 'status'
  );

DROP TRIGGER IF EXISTS guard_users_role_transition ON public.users;
CREATE TRIGGER guard_users_role_transition
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_role_transition();

-- 5. user_profiles: credits and ownership are server-owned (belt and braces on RLS).
DROP TRIGGER IF EXISTS guard_user_profiles_protected_columns ON public.user_profiles;
CREATE TRIGGER guard_user_profiles_protected_columns
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_protected_columns(
    'id', 'user_id', 'credits_balance'
  );

-- 6. trainers: trust, performance and retainer metrics stay with admin/server.
DROP TRIGGER IF EXISTS guard_trainers_protected_columns ON public.trainers;
CREATE TRIGGER guard_trainers_protected_columns
  BEFORE UPDATE ON public.trainers
  FOR EACH ROW EXECUTE FUNCTION public.guard_protected_columns(
    'id', 'rating', 'rating_count', 'completed_sessions', 'verified_badge', 'level',
    'attendance_rate', 'punctuality_rate', 'availability_compliance',
    'retainer_status', 'weekly_slots_submitted', 'remaining_slot_changes'
  );

-- 7. bookings: OTP, price and participants cannot be rewritten by the client.
DROP TRIGGER IF EXISTS guard_bookings_protected_columns ON public.bookings;
CREATE TRIGGER guard_bookings_protected_columns
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.guard_protected_columns(
    'id', 'otp', 'price', 'client_id', 'trainer_id'
  );

-- 8. trainer_earnings: payouts are server-owned. The favourite-trainer bonus
--    moves into a SECURITY DEFINER RPC so the client stops writing money columns.
CREATE OR REPLACE FUNCTION public.apply_favourite_trainer_bonus(p_booking_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_earning public.trainer_earnings%ROWTYPE;
  v_actor text;
  v_booking_trainer text;
BEGIN
  v_actor := public.get_auth_user_id();

  SELECT trainer_id INTO v_booking_trainer
  FROM public.bookings
  WHERE id = p_booking_id;

  IF v_booking_trainer IS NULL THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'booking_not_found');
  END IF;

  IF v_actor IS DISTINCT FROM v_booking_trainer AND NOT public.request_actor_is_admin() THEN
    RAISE EXCEPTION 'Not allowed to modify earnings of another trainer' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_earning
  FROM public.trainer_earnings
  WHERE booking_id = p_booking_id AND type = 'session'
  ORDER BY id DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'no_earning');
  END IF;

  IF coalesce(v_earning.client_name, '') LIKE '%(Favourite Trainer)%' THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'already_applied');
  END IF;

  UPDATE public.trainer_earnings
  SET amount = COALESCE(v_earning.amount, 600) + 50,
      client_name = COALESCE(v_earning.client_name, '') || ' (Favourite Trainer)'
  WHERE id = v_earning.id;

  RETURN jsonb_build_object('applied', true, 'earning_id', v_earning.id);
END;
$$;

DROP TRIGGER IF EXISTS guard_trainer_earnings_protected_columns ON public.trainer_earnings;
CREATE TRIGGER guard_trainer_earnings_protected_columns
  BEFORE UPDATE ON public.trainer_earnings
  FOR EACH ROW EXECUTE FUNCTION public.guard_protected_columns(
    'id', 'trainer_id', 'booking_id', 'type', 'amount'
  );
