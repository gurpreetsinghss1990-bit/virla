-- Migration: Correct Credit Lot Expiry Anniversary and Transfer Selection Logic
-- Created At: 2026-08-30

-- 1. Redefine sync_credit_lots_on_transaction trigger function to calculate expiry as purchase_date + 1 year - 1 day
CREATE OR REPLACE FUNCTION public.sync_credit_lots_on_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_lot record;
  v_needed integer;
  v_room integer;
  v_now_date date := CURRENT_DATE;
  v_expiry_date date;
  v_grace_date date;
  v_is_elite boolean;
BEGIN
  -- Determine if user is Elite
  SELECT (membership_status = 'Elite') INTO v_is_elite 
  FROM public.user_profiles 
  WHERE user_id = NEW.user_id;
  v_is_elite := COALESCE(v_is_elite, false);

  -- A. PURCHASE: New purchase additions
  IF NEW.type = 'purchase' OR NEW.type = 'paid' THEN
    -- Anniversary rule: exactly 1 year minus 1 day (e.g. 01/01/2026 -> 31/12/2026)
    v_expiry_date := v_now_date + INTERVAL '1 year' - INTERVAL '1 day';
    v_grace_date := v_expiry_date + INTERVAL '7 days';
    
    INSERT INTO public.credit_lots (user_id, original_purchaser_id, original_purchase_date, official_expiry_date, grace_expiry_date, initial_credits, remaining_credits, original_lot_id)
    VALUES (NEW.user_id, NEW.user_id, v_now_date, v_expiry_date, v_grace_date, NEW.credits, NEW.credits, NULL);

  -- B. SPEND or PENALTY: Consume credits in FIFO order of expiry
  ELSIF NEW.type = 'spend' OR NEW.type = 'penalty' THEN
    v_needed := NEW.credits;
    FOR v_lot IN 
      SELECT * FROM public.credit_lots 
      WHERE user_id = NEW.user_id 
        AND remaining_credits > 0 
        AND (
          (v_is_elite AND v_now_date <= grace_expiry_date)
          OR 
          (NOT v_is_elite AND v_now_date <= official_expiry_date)
        )
      ORDER BY official_expiry_date ASC, created_at ASC
    LOOP
      IF v_needed <= 0 THEN
        EXIT;
      END IF;

      IF v_lot.remaining_credits >= v_needed THEN
        UPDATE public.credit_lots SET remaining_credits = remaining_credits - v_needed WHERE id = v_lot.id;
        v_needed := 0;
      ELSE
        v_needed := v_needed - v_lot.remaining_credits;
        UPDATE public.credit_lots SET remaining_credits = 0 WHERE id = v_lot.id;
      END IF;
    END LOOP;

  -- C. REFUND: Restore credits back to the original credit lots that have room (reversing consumption)
  ELSIF NEW.type = 'refund' THEN
    v_needed := NEW.credits;
    FOR v_lot IN 
      SELECT * FROM public.credit_lots 
      WHERE user_id = NEW.user_id 
        AND remaining_credits < initial_credits
      ORDER BY official_expiry_date DESC, created_at DESC
    LOOP
      IF v_needed <= 0 THEN
        EXIT;
      END IF;

      v_room := v_lot.initial_credits - v_lot.remaining_credits;
      IF v_room >= v_needed THEN
        UPDATE public.credit_lots SET remaining_credits = remaining_credits + v_needed WHERE id = v_lot.id;
        v_needed := 0;
      ELSE
        v_needed := v_needed - v_room;
        UPDATE public.credit_lots SET remaining_credits = v_lot.initial_credits WHERE id = v_lot.id;
      END IF;
    END LOOP;

    -- If there's still refund credit remainder, allocate a brand new lot
    IF v_needed > 0 THEN
      -- Anniversary rule: exactly 1 year minus 1 day (e.g. 01/01/2026 -> 31/12/2026)
      v_expiry_date := v_now_date + INTERVAL '1 year' - INTERVAL '1 day';
      v_grace_date := v_expiry_date + INTERVAL '7 days';
      INSERT INTO public.credit_lots (user_id, original_purchaser_id, original_purchase_date, official_expiry_date, grace_expiry_date, initial_credits, remaining_credits, original_lot_id)
      VALUES (NEW.user_id, NEW.user_id, v_now_date, v_expiry_date, v_grace_date, v_needed, v_needed, NULL);
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- 2. Update all existing credit lots in the database to align with the Anniversary Business Rule (1 year - 1 day)
UPDATE public.credit_lots
SET 
  official_expiry_date = original_purchase_date + INTERVAL '1 year' - INTERVAL '1 day',
  grace_expiry_date = (original_purchase_date + INTERVAL '1 year' - INTERVAL '1 day') + INTERVAL '7 days';


-- 3. Redefine transfer_credits to implement the single-lot selection priority algorithm
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
  v_now_date date := CURRENT_DATE;
  v_clean_phone text;
  v_orig_lot_id text;
BEGIN
  -- Resolve sender: use standard production security model (JWT sub claim or x-user-id header fallback)
  v_from_client_id := COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (current_setting('request.headers', true)::jsonb->>'x-user-id')
  );

  IF v_from_client_id IS NULL OR v_from_client_id = '' THEN
     RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_amount <= 0 THEN
     RAISE EXCEPTION 'Transfer amount must be greater than 0';
  END IF;

  -- Normalize recipient phone to last 10 digits
  v_clean_phone := regexp_replace(p_to_phone, '\D', '', 'g');
  IF length(v_clean_phone) >= 10 THEN
     v_clean_phone := right(v_clean_phone, 10);
  ELSE
     RAISE EXCEPTION 'Invalid recipient phone number format';
  END IF;

  -- Resolve recipient using last 10 digits comparison
  SELECT id, name INTO v_to_client_id, v_to_name 
  FROM public.users 
  WHERE 
    length(regexp_replace(phone, '\D', '', 'g')) >= 10 
    AND right(regexp_replace(phone, '\D', '', 'g'), 10) = v_clean_phone
    AND role IN ('customer', 'trainer');
  
  IF NOT FOUND THEN
     RAISE EXCEPTION 'Recipient phone number not found or not a registered Virla user';
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

  -- Single-Lot Selection Algorithm (enforces anniversary expiries, line-splitting protection, and earlist-expiry priority)
  SELECT * INTO v_lot
  FROM public.credit_lots
  WHERE user_id = v_from_client_id
    AND remaining_credits >= p_amount
    AND official_expiry_date >= v_now_date
  ORDER BY official_expiry_date ASC, created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
     RAISE EXCEPTION 'The requested transfer amount (%) exceeds any single active credit lot. To preserve original expiry dates, please perform separate transfers of smaller amounts.', p_amount;
  END IF;

  -- Perform transfer from the selected lot
  v_orig_lot_id := COALESCE(v_lot.original_lot_id, v_lot.id);

  UPDATE public.credit_lots 
  SET remaining_credits = remaining_credits - p_amount 
  WHERE id = v_lot.id;

  INSERT INTO public.credit_lots (
    user_id, original_purchaser_id, original_purchase_date, 
    official_expiry_date, grace_expiry_date, 
    initial_credits, remaining_credits, original_lot_id
  ) VALUES (
    v_to_client_id, v_lot.original_purchaser_id, v_lot.original_purchase_date, 
    v_lot.official_expiry_date, v_lot.grace_expiry_date, 
    p_amount, p_amount, v_orig_lot_id
  );

  -- Update profile balances
  UPDATE public.user_profiles SET credits_balance = credits_balance - p_amount WHERE user_id = v_from_client_id;
  UPDATE public.user_profiles SET credits_balance = credits_balance + p_amount WHERE user_id = v_to_client_id;

  v_now_ms := (EXTRACT(epoch FROM now()) * 1000)::bigint;
  v_tx_ref_id := 'ref-' || v_now_ms || '-' || floor(random()*1000)::text;

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

  RETURN jsonb_build_object(
    'success', true, 
    'recipient_name', v_to_name,
    'ref_id', v_tx_ref_id,
    'expiry_date', to_char(v_lot.official_expiry_date, 'DD Month YYYY')
  );
END;
$$;
