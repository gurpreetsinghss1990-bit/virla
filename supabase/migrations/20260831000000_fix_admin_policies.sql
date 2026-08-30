-- Migration: Fix Admin RLS policies for disputes and kit orders
-- Created At: 2026-08-31

-- 1. Drop dependent policies first
DROP POLICY IF EXISTS select_disputes ON public.disputes;
DROP POLICY IF EXISTS update_disputes ON public.disputes;
DROP POLICY IF EXISTS select_kit_orders ON public.kit_orders;
DROP POLICY IF EXISTS update_kit_orders ON public.kit_orders;

-- 2. Drop the zero-argument is_admin function to avoid conflicts
DROP FUNCTION IF EXISTS public.is_admin();

-- 3. Create new RLS policies for public.disputes
CREATE POLICY select_disputes ON public.disputes
  FOR SELECT TO public
  USING (public.is_admin(public.get_auth_user_id()) OR trainer_id = public.get_auth_user_id());

CREATE POLICY update_disputes ON public.disputes
  FOR UPDATE TO public
  USING (public.is_admin(public.get_auth_user_id()));

-- 4. Create new RLS policies for public.kit_orders
CREATE POLICY select_kit_orders ON public.kit_orders
  FOR SELECT TO public
  USING (public.is_admin(public.get_auth_user_id()) OR trainer_id = public.get_auth_user_id());

CREATE POLICY update_kit_orders ON public.kit_orders
  FOR UPDATE TO public
  USING (public.is_admin(public.get_auth_user_id()));
