-- Migration: disputes and kit orders
-- Created At: 2026-08-30

-- 1. Helper functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()::text AND u.role = 'admin'))
    OR 
    (current_setting('app.settings.jwt_secret', true) = 'super-secret-jwt-token-with-at-least-32-characters-long' 
     AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = (current_setting('request.headers', true)::jsonb->>'x-user-id') AND u.role = 'admin'))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_auth_user_id()
RETURNS text AS $$
BEGIN
  RETURN COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (current_setting('request.headers', true)::jsonb->>'x-user-id')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Disputes table
CREATE TABLE IF NOT EXISTS public.disputes (
  id text PRIMARY KEY DEFAULT 'disp_' || gen_random_uuid()::text,
  ticket_id text NOT NULL UNIQUE,
  trainer_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  trainer_name text NOT NULL DEFAULT '',
  trainer_phone text NOT NULL DEFAULT '',
  client_id text REFERENCES public.users(id) ON DELETE SET NULL,
  client_name text NOT NULL DEFAULT '',
  client_phone text NOT NULL DEFAULT '',
  booking_id text REFERENCES public.bookings(id) ON DELETE SET NULL,
  category text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 3. Kit Orders table
CREATE TABLE IF NOT EXISTS public.kit_orders (
  id text PRIMARY KEY DEFAULT 'kit_' || gen_random_uuid()::text,
  order_id text NOT NULL UNIQUE,
  trainer_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  trainer_name text NOT NULL DEFAULT '',
  trainer_phone text NOT NULL DEFAULT '',
  items jsonb NOT NULL,
  tshirt_size text,
  status text NOT NULL DEFAULT 'SUBMITTED',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 4. Trigger functions for ID generation & metadata resolution
CREATE OR REPLACE FUNCTION public.tr_generate_dispute_ticket_id()
RETURNS TRIGGER AS $$
DECLARE
  v_today_str text;
  v_seq integer;
  v_trainer_name text;
  v_trainer_phone text;
  v_client_id text;
  v_client_name text;
  v_client_phone text;
BEGIN
  -- Generate ticket_id server-side
  v_today_str := to_char(CURRENT_DATE, 'YYYYMMDD');
  SELECT COALESCE(count(*), 0) + 1 INTO v_seq
  FROM public.disputes
  WHERE ticket_id LIKE 'VRL-DSP-' || v_today_str || '-%';
  
  NEW.ticket_id := 'VRL-DSP-' || v_today_str || '-' || lpad(v_seq::text, 4, '0');

  -- Enforce trainer_id is user's ID
  IF NOT public.is_admin() THEN
    NEW.trainer_id := public.get_auth_user_id();
    NEW.status := 'OPEN';
  END IF;

  -- Resolve trainer info
  SELECT name, phone INTO v_trainer_name, v_trainer_phone
  FROM public.users
  WHERE id = NEW.trainer_id;
  
  NEW.trainer_name := COALESCE(v_trainer_name, '');
  NEW.trainer_phone := COALESCE(v_trainer_phone, '');

  -- Resolve booking & client info
  IF NEW.booking_id IS NOT NULL AND NEW.booking_id <> '' THEN
    SELECT client_id INTO v_client_id
    FROM public.bookings
    WHERE id = NEW.booking_id;
    
    IF v_client_id IS NOT NULL THEN
      NEW.client_id := v_client_id;
      
      SELECT name, phone INTO v_client_name, v_client_phone
      FROM public.users
      WHERE id = v_client_id;
      
      NEW.client_name := COALESCE(v_client_name, '');
      NEW.client_phone := COALESCE(v_client_phone, '');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.tr_generate_kit_order_id()
RETURNS TRIGGER AS $$
DECLARE
  v_today_str text;
  v_seq integer;
  v_trainer_name text;
  v_trainer_phone text;
BEGIN
  -- Generate order_id server-side
  v_today_str := to_char(CURRENT_DATE, 'YYYYMMDD');
  SELECT COALESCE(count(*), 0) + 1 INTO v_seq
  FROM public.kit_orders
  WHERE order_id LIKE 'VRL-KIT-' || v_today_str || '-%';
  
  NEW.order_id := 'VRL-KIT-' || v_today_str || '-' || lpad(v_seq::text, 4, '0');

  -- Enforce trainer_id is user's ID
  IF NOT public.is_admin() THEN
    NEW.trainer_id := public.get_auth_user_id();
    NEW.status := 'SUBMITTED';
  END IF;

  -- Resolve trainer info
  SELECT name, phone INTO v_trainer_name, v_trainer_phone
  FROM public.users
  WHERE id = NEW.trainer_id;
  
  NEW.trainer_name := COALESCE(v_trainer_name, '');
  NEW.trainer_phone := COALESCE(v_trainer_phone, '');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_generate_dispute_ticket_id ON public.disputes;
DROP TRIGGER IF EXISTS trigger_generate_kit_order_id ON public.kit_orders;

-- Create triggers
CREATE TRIGGER trigger_generate_dispute_ticket_id
BEFORE INSERT ON public.disputes
FOR EACH ROW
EXECUTE FUNCTION public.tr_generate_dispute_ticket_id();

CREATE TRIGGER trigger_generate_kit_order_id
BEFORE INSERT ON public.kit_orders
FOR EACH ROW
EXECUTE FUNCTION public.tr_generate_kit_order_id();

-- 5. RLS Policies
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kit_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_disputes ON public.disputes;
DROP POLICY IF EXISTS insert_disputes ON public.disputes;
DROP POLICY IF EXISTS update_disputes ON public.disputes;

CREATE POLICY select_disputes ON public.disputes
  FOR SELECT TO public
  USING (public.is_admin() OR trainer_id = public.get_auth_user_id());

CREATE POLICY insert_disputes ON public.disputes
  FOR INSERT TO public
  WITH CHECK (public.get_auth_user_id() IS NOT NULL);

CREATE POLICY update_disputes ON public.disputes
  FOR UPDATE TO public
  USING (public.is_admin());

DROP POLICY IF EXISTS select_kit_orders ON public.kit_orders;
DROP POLICY IF EXISTS insert_kit_orders ON public.kit_orders;
DROP POLICY IF EXISTS update_kit_orders ON public.kit_orders;

CREATE POLICY select_kit_orders ON public.kit_orders
  FOR SELECT TO public
  USING (public.is_admin() OR trainer_id = public.get_auth_user_id());

CREATE POLICY insert_kit_orders ON public.kit_orders
  FOR INSERT TO public
  WITH CHECK (public.get_auth_user_id() IS NOT NULL);

CREATE POLICY update_kit_orders ON public.kit_orders
  FOR UPDATE TO public
  USING (public.is_admin());
