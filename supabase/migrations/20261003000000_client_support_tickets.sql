-- 20261003000000_client_support_tickets.sql
-- Create support_tickets table for Client Concierge Support with Admin Realtime Chat

-- 1. Ensure helper functions exist
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()::text AND u.role = 'admin'))
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = (current_setting('request.headers', true)::jsonb->>'x-user-id') AND u.role = 'admin')
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

-- 2. Create support_tickets table
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id text PRIMARY KEY DEFAULT 'supp_' || gen_random_uuid()::text,
  ticket_id text NOT NULL UNIQUE,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_name text NOT NULL DEFAULT '',
  user_phone text NOT NULL DEFAULT '',
  booking_id text REFERENCES public.bookings(id) ON DELETE SET NULL,
  category text NOT NULL,
  reason text NOT NULL,
  description text NOT NULL DEFAULT '',
  preferred_resolution text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'OPEN',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 3. Trigger function to auto-generate ticket_id and resolve user details
CREATE OR REPLACE FUNCTION public.tr_generate_support_ticket_id()
RETURNS TRIGGER AS $$
DECLARE
  v_today_str text;
  v_seq integer;
  v_user_name text;
  v_user_phone text;
BEGIN
  v_today_str := to_char(CURRENT_DATE, 'YYYYMMDD');
  SELECT COALESCE(count(*), 0) + 1 INTO v_seq
  FROM public.support_tickets
  WHERE ticket_id LIKE 'VRL-SUP-' || v_today_str || '-%';

  NEW.ticket_id := 'VRL-SUP-' || v_today_str || '-' || lpad(v_seq::text, 4, '0');

  -- Resolve user details if not supplied
  SELECT name, phone INTO v_user_name, v_user_phone
  FROM public.users
  WHERE id = NEW.user_id;

  NEW.user_name := COALESCE(NULLIF(NEW.user_name, ''), v_user_name, '');
  NEW.user_phone := COALESCE(NULLIF(NEW.user_phone, ''), v_user_phone, '');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_generate_support_ticket_id ON public.support_tickets;
CREATE TRIGGER trigger_generate_support_ticket_id
BEFORE INSERT ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.tr_generate_support_ticket_id();

-- 4. Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_support_tickets ON public.support_tickets;
DROP POLICY IF EXISTS insert_support_tickets ON public.support_tickets;
DROP POLICY IF EXISTS update_support_tickets ON public.support_tickets;

CREATE POLICY select_support_tickets ON public.support_tickets
  FOR SELECT TO public
  USING (public.is_admin() OR user_id = public.get_auth_user_id() OR user_id = (current_setting('request.headers', true)::jsonb->>'x-user-id'));

CREATE POLICY insert_support_tickets ON public.support_tickets
  FOR INSERT TO public
  WITH CHECK (public.is_admin() OR user_id = public.get_auth_user_id() OR user_id = (current_setting('request.headers', true)::jsonb->>'x-user-id'));

CREATE POLICY update_support_tickets ON public.support_tickets
  FOR UPDATE TO public
  USING (public.is_admin() OR user_id = public.get_auth_user_id() OR user_id = (current_setting('request.headers', true)::jsonb->>'x-user-id'));

-- 5. Support RLS on chat_messages for support tickets
DROP POLICY IF EXISTS "Enable SELECT for support ticket participant" ON public.chat_messages;
DROP POLICY IF EXISTS "Enable INSERT for support ticket participant" ON public.chat_messages;

CREATE POLICY "Enable SELECT for support ticket participant" ON public.chat_messages FOR SELECT
  USING (
    public.is_admin()
    OR chat_id LIKE '%' || (current_setting('request.headers', true)::jsonb->>'x-user-id') || '%'
    OR chat_id LIKE 'support_%'
  );

CREATE POLICY "Enable INSERT for support ticket participant" ON public.chat_messages FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR chat_id LIKE '%' || (current_setting('request.headers', true)::jsonb->>'x-user-id') || '%'
    OR chat_id LIKE 'support_%'
  );
