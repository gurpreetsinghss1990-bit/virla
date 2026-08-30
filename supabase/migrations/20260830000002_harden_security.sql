-- Migration: Production Security Hardening for Transfer Credits and Mock Headers
-- Created At: 2026-08-30

-- 1. Redefine find_recipient_by_phone with strict production security checks
CREATE OR REPLACE FUNCTION public.find_recipient_by_phone(p_phone text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user record;
  v_sender_id text;
  v_clean_phone text;
BEGIN
  -- Normalize phone to digits
  v_clean_phone := regexp_replace(p_phone, '\D', '', 'g');

  -- Resolve sender: use JWT claim in production, fall back to x-user-id header ONLY in local development
  v_sender_id := COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    CASE WHEN public.is_local_development() THEN (current_setting('request.headers', true)::jsonb->>'x-user-id') ELSE NULL END
  );

  IF v_sender_id IS NULL OR v_sender_id = '' THEN
     RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT id, name, phone, role INTO v_user 
  FROM public.users 
  WHERE regexp_replace(phone, '\D', '', 'g') = v_clean_phone AND role = 'customer';

  IF NOT FOUND THEN
     RETURN jsonb_build_object('found', false);
  END IF;

  IF v_user.id = v_sender_id THEN
     RETURN jsonb_build_object('found', true, 'is_self', true, 'name', v_user.name);
  END IF;

  RETURN jsonb_build_object('found', true, 'is_self', false, 'name', v_user.name, 'user_id', v_user.id);
END;
$$;


-- 2. Redefine transfer_credits with strict production security checks
CREATE OR REPLACE FUNCTION public.transfer_credits(
  p_to_phone text,
  p_amount integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_from_client_id text;
  v_to_client_id text;
  v_from_balance integer;
  v_to_balance integer;
  v_to_name text;
  v_from_name text;
  v_now_ms bigint;
  v_tx_ref_id text;
  v_lot record;
  v_needed integer;
  v_transferred integer;
  v_now_date date := CURRENT_DATE;
  v_earliest_expiry date;
  v_clean_phone text;
  v_orig_lot_id text;
BEGIN
  -- Resolve sender: use JWT claim in production, fall back to x-user-id header ONLY in local development
  v_from_client_id := COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    CASE WHEN public.is_local_development() THEN (current_setting('request.headers', true)::jsonb->>'x-user-id') ELSE NULL END
  );

  IF v_from_client_id IS NULL OR v_from_client_id = '' THEN
     RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_amount <= 0 THEN
     RAISE EXCEPTION 'Transfer amount must be greater than 0';
  END IF;

  v_clean_phone := regexp_replace(p_to_phone, '\D', '', 'g');

  -- Resolve recipient
  SELECT id, name INTO v_to_client_id, v_to_name 
  FROM public.users 
  WHERE regexp_replace(phone, '\D', '', 'g') = v_clean_phone AND role = 'customer';
  
  IF NOT FOUND THEN
     RAISE EXCEPTION 'Recipient phone number not found or not a client';
  END IF;

  IF v_from_client_id = v_to_client_id THEN
     RAISE EXCEPTION 'You cannot transfer credits to yourself.';
  END IF;

  -- Lock user profiles to guarantee order & prevent deadlocks/race conditions
  IF v_from_client_id < v_to_client_id THEN
    SELECT name INTO v_from_name FROM public.users WHERE id = v_from_client_id;
    SELECT credits_balance INTO v_from_balance FROM public.user_profiles WHERE user_id = v_from_client_id FOR UPDATE;
    SELECT credits_balance INTO v_to_balance FROM public.user_profiles WHERE user_id = v_to_client_id FOR UPDATE;
  ELSE
    SELECT credits_balance INTO v_to_balance FROM public.user_profiles WHERE user_id = v_to_client_id FOR UPDATE;
    SELECT name INTO v_from_name FROM public.users WHERE id = v_from_client_id;
    SELECT credits_balance INTO v_from_balance FROM public.user_profiles WHERE user_id = v_from_client_id FOR UPDATE;
  END IF;

  IF v_from_balance < p_amount THEN
     RAISE EXCEPTION 'Insufficient credits available for transfer';
  END IF;

  -- Verify sender has enough active unexpired lots (transfer only unexpired credits)
  SELECT COALESCE(sum(remaining_credits), 0) INTO v_transferred
  FROM public.credit_lots
  WHERE user_id = v_from_client_id 
    AND remaining_credits > 0
    AND official_expiry_date >= v_now_date;

  IF v_transferred < p_amount THEN
     RAISE EXCEPTION 'Insufficient unexpired credits available for transfer';
  END IF;

  v_now_ms := (EXTRACT(epoch FROM now()) * 1000)::bigint;
  v_tx_ref_id := 'ref-' || v_now_ms || '-' || floor(random()*1000)::text;

  -- Consume sender lots and credit recipient segments
  v_needed := p_amount;
  FOR v_lot IN 
    SELECT * FROM public.credit_lots 
    WHERE user_id = v_from_client_id 
      AND remaining_credits > 0
      AND official_expiry_date >= v_now_date
    ORDER BY official_expiry_date ASC, created_at ASC
  LOOP
    IF v_needed <= 0 THEN
      EXIT;
    END IF;

    v_orig_lot_id := COALESCE(v_lot.original_lot_id, v_lot.id);

    IF v_lot.remaining_credits >= v_needed THEN
      UPDATE public.credit_lots SET remaining_credits = remaining_credits - v_needed WHERE id = v_lot.id;
      
      INSERT INTO public.credit_lots (user_id, original_purchaser_id, original_purchase_date, official_expiry_date, grace_expiry_date, initial_credits, remaining_credits, original_lot_id)
      VALUES (v_to_client_id, v_lot.original_purchaser_id, v_lot.original_purchase_date, v_lot.official_expiry_date, v_lot.grace_expiry_date, v_needed, v_needed, v_orig_lot_id);
      
      v_needed := 0;
    ELSE
      v_transferred := v_lot.remaining_credits;
      UPDATE public.credit_lots SET remaining_credits = 0 WHERE id = v_lot.id;
      
      INSERT INTO public.credit_lots (user_id, original_purchaser_id, original_purchase_date, official_expiry_date, grace_expiry_date, initial_credits, remaining_credits, original_lot_id)
      VALUES (v_to_client_id, v_lot.original_purchaser_id, v_lot.original_purchase_date, v_lot.official_expiry_date, v_lot.grace_expiry_date, v_transferred, v_transferred, v_orig_lot_id);
      
      v_needed := v_needed - v_transferred;
    END IF;
  END LOOP;

  -- Update profiles
  UPDATE public.user_profiles SET credits_balance = credits_balance - p_amount WHERE user_id = v_from_client_id;
  UPDATE public.user_profiles SET credits_balance = credits_balance + p_amount WHERE user_id = v_to_client_id;

  -- Insert Sender Transaction Ledger Log
  INSERT INTO public.credit_transactions (id, user_id, type, amount, date, status, credits)
  VALUES (
    'tx-' || v_now_ms || '-sent-' || floor(random()*1000)::text,
    v_from_client_id,
    'transfer_sent',
    'To: ' || COALESCE(v_to_name, p_to_phone) || ' (Ref: ' || v_tx_ref_id || ')',
    to_char(now(), 'Mon DD, YYYY'),
    'paid',
    p_amount
  );

  -- Insert Recipient Transaction Ledger Log
  INSERT INTO public.credit_transactions (id, user_id, type, amount, date, status, credits)
  VALUES (
    'tx-' || v_now_ms || '-rcvd-' || floor(random()*1000)::text,
    v_to_client_id,
    'transfer_received',
    'From: ' || COALESCE(v_from_name, 'Sender') || ' (Ref: ' || v_tx_ref_id || ')',
    to_char(now(), 'Mon DD, YYYY'),
    'paid',
    p_amount
  );

  -- Determine earliest expiry date among the transferred lot elements
  SELECT min(official_expiry_date) INTO v_earliest_expiry
  FROM public.credit_lots
  WHERE user_id = v_to_client_id
    AND created_at >= now() - interval '3 seconds';

  RETURN jsonb_build_object(
    'success', true, 
    'recipient_name', v_to_name,
    'ref_id', v_tx_ref_id,
    'expiry_date', to_char(v_earliest_expiry, 'DD Month YYYY')
  );
END;
$$;


-- 3. Redefine SELECT policy on credit_lots to support mock headers ONLY in local development
DROP POLICY IF EXISTS "Enable select for own lots" ON public.credit_lots;
CREATE POLICY "Enable select for own lots" ON public.credit_lots
    FOR SELECT TO authenticated, anon USING (
      user_id = COALESCE(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        CASE WHEN public.is_local_development() THEN (current_setting('request.headers', true)::jsonb->>'x-user-id') ELSE NULL END
      )
    );


-- 4. Redefine INSERT policy on invitations to support mock headers ONLY in local development
DROP POLICY IF EXISTS "Enable insert for sender" ON public.invitations;
CREATE POLICY "Enable insert for sender" ON public.invitations
    FOR INSERT TO authenticated, anon WITH CHECK (
      sender_id = COALESCE(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        CASE WHEN public.is_local_development() THEN (current_setting('request.headers', true)::jsonb->>'x-user-id') ELSE NULL END
      )
    );
