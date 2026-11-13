-- Credit validity policy: every purchased session pack is valid for 6 months,
-- matching what the pricing page promises, followed by the existing 7-day grace
-- window. Lots that already exist keep the expiry they were granted with
-- (grandfathered); only newly created lots use the 6-month window.

-- sync_credit_lots_on_transaction: 6-month validity for new lots
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
    v_expiry_date := v_now_date + INTERVAL '6 months' - INTERVAL '1 day';
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
      v_expiry_date := v_now_date + INTERVAL '6 months' - INTERVAL '1 day';
      v_grace_date := v_expiry_date + INTERVAL '7 days';
      INSERT INTO public.credit_lots (user_id, original_purchaser_id, original_purchase_date, official_expiry_date, grace_expiry_date, initial_credits, remaining_credits, original_lot_id)
      VALUES (NEW.user_id, NEW.user_id, v_now_date, v_expiry_date, v_grace_date, v_needed, v_needed, NULL);
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- fulfill_payment_order: 6-month validity for new lots
CREATE OR REPLACE FUNCTION public.fulfill_payment_order(
  p_merchant_txn_no TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tx RECORD;
  v_current_balance INT;
  v_new_balance INT;
  v_today DATE := CURRENT_DATE;
  v_official_expiry DATE;
  v_grace_expiry DATE;
  v_lot_id TEXT;
  v_date_str TEXT;
BEGIN
  -- ATOMIC ROW LOCK: Only ONE concurrent worker (Webhook OR verify-order) can proceed
  SELECT * INTO v_tx
  FROM public.credit_transactions
  WHERE id = p_merchant_txn_no
  FOR UPDATE;

  -- 1. Check if order exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'not_found',
      'error', 'Order not found'
    );
  END IF;

  -- 2. IDEMPOTENCY CHECK: If already fulfilled, return paid immediately
  IF v_tx.status = 'paid' THEN
    SELECT credits_balance INTO v_current_balance
    FROM public.user_profiles
    WHERE user_id = v_tx.user_id;

    RETURN jsonb_build_object(
      'success', true,
      'status', 'already_processed',
      'merchant_txn_no', p_merchant_txn_no,
      'credits', v_tx.credits,
      'new_balance', COALESCE(v_current_balance, 0),
      'balance', COALESCE(v_current_balance, 0)
    );
  END IF;

  -- 3. Atomically Lock and Update user profile balance
  SELECT credits_balance INTO v_current_balance
  FROM public.user_profiles
  WHERE user_id = v_tx.user_id
  FOR UPDATE;

  v_new_balance := COALESCE(v_current_balance, 0) + v_tx.credits;

  UPDATE public.user_profiles
  SET 
    credits_balance = v_new_balance,
    updated_at = now()
  WHERE user_id = v_tx.user_id;

  -- 4. Mark transaction as paid
  v_date_str := to_char(now(), 'Mon DD, YYYY');
  UPDATE public.credit_transactions
  SET 
    status = 'paid',
    date = v_date_str
  WHERE id = p_merchant_txn_no;

  -- 5. Allocate Credit Lot with 6-month validity and UNIQUE order_id constraint
  v_official_expiry := v_today + INTERVAL '6 months';
  v_grace_expiry := v_official_expiry + INTERVAL '7 days';
  v_lot_id := 'lot-' || (extract(epoch from now()) * 1000)::bigint || '-' || floor(random() * 1000000)::int;

  INSERT INTO public.credit_lots (
    id,
    user_id,
    original_purchaser_id,
    original_purchase_date,
    official_expiry_date,
    grace_expiry_date,
    initial_credits,
    remaining_credits,
    original_lot_id,
    order_id
  ) VALUES (
    v_lot_id,
    v_tx.user_id,
    v_tx.user_id,
    v_today,
    v_official_expiry,
    v_grace_expiry,
    v_tx.credits,
    v_tx.credits,
    NULL,
    p_merchant_txn_no
  )
  ON CONFLICT (order_id) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'paid',
    'merchant_txn_no', p_merchant_txn_no,
    'credits', v_tx.credits,
    'new_balance', v_new_balance,
    'balance', v_new_balance
  );
END;
$$;

-- backfill_credit_lots_from_transactions: 6-month validity for new lots
CREATE OR REPLACE FUNCTION public.backfill_credit_lots_from_transactions()
RETURNS void AS $$
DECLARE
  v_user record;
  v_tx record;
  v_lot record;
  v_parsed_date date;
  v_expiry date;
  v_grace date;
  v_needed integer;
  v_room integer;
  v_reconstructed_sum integer;
  v_discrepancy integer;
  v_is_elite boolean;
BEGIN
  -- Empty tables to restart clean
  TRUNCATE public.expiry_notifications_sent CASCADE;
  TRUNCATE public.credit_lots CASCADE;
  TRUNCATE public.credit_backfill_reviews CASCADE;

  -- Loop chronological transactions for ALL users (customer, trainer, admin, etc.)
  FOR v_user IN SELECT id, role FROM public.users LOOP
    -- Determine Elite status
    SELECT (membership_status = 'Elite') INTO v_is_elite 
    FROM public.user_profiles 
    WHERE user_id = v_user.id;
    v_is_elite := COALESCE(v_is_elite, false);

    -- Loop chronological transactions
    FOR v_tx IN 
      SELECT * FROM public.credit_transactions 
      WHERE user_id = v_user.id 
      ORDER BY date ASC, id ASC
    LOOP
      BEGIN
        v_parsed_date := to_date(v_tx.date, 'Mon DD, YYYY');
      EXCEPTION WHEN OTHERS THEN
        v_parsed_date := CURRENT_DATE - INTERVAL '1 month';
      END;

      -- Anniversary rule: exactly 1 year minus 1 day (e.g. 01/01/2026 -> 31/12/2026)
      v_expiry := v_parsed_date + INTERVAL '6 months' - INTERVAL '1 day';
      v_grace := v_expiry + INTERVAL '7 days';

      -- Sync/backfill logic simulation
      IF v_tx.type = 'purchase' OR v_tx.type = 'paid' THEN
        INSERT INTO public.credit_lots (user_id, original_purchaser_id, original_purchase_date, official_expiry_date, grace_expiry_date, initial_credits, remaining_credits, original_lot_id)
        VALUES (v_user.id, v_user.id, v_parsed_date, v_expiry, v_grace, v_tx.credits, v_tx.credits, NULL);

      ELSIF v_tx.type = 'spend' OR v_tx.type = 'penalty' OR v_tx.type = 'transfer_sent' OR v_tx.type = 'transfer' THEN
        v_needed := v_tx.credits;
        FOR v_lot IN 
          SELECT * FROM public.credit_lots 
          WHERE user_id = v_user.id 
            AND remaining_credits > 0 
            AND (
              (v_is_elite AND v_parsed_date <= grace_expiry_date)
              OR 
              (NOT v_is_elite AND v_parsed_date <= official_expiry_date)
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

      ELSIF v_tx.type = 'refund' OR v_tx.type = 'transfer_received' THEN
        v_needed := v_tx.credits;
        FOR v_lot IN 
          SELECT * FROM public.credit_lots 
          WHERE user_id = v_user.id 
            AND remaining_credits < initial_credits
            AND (
              (v_is_elite AND v_parsed_date <= grace_expiry_date)
              OR 
              (NOT v_is_elite AND v_parsed_date <= official_expiry_date)
            )
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

        IF v_needed > 0 THEN
          INSERT INTO public.credit_lots (user_id, original_purchaser_id, original_purchase_date, official_expiry_date, grace_expiry_date, initial_credits, remaining_credits, original_lot_id)
          VALUES (v_user.id, v_user.id, v_parsed_date, v_expiry, v_grace, v_needed, v_needed, NULL);
        END IF;

      END IF;
    END LOOP;

    -- Calculate reconstructed total
    SELECT COALESCE(sum(remaining_credits), 0) INTO v_reconstructed_sum 
    FROM public.credit_lots 
    WHERE user_id = v_user.id;

    -- Verify profile sync balance discrepancy
    SELECT credits_balance INTO v_discrepancy 
    FROM public.user_profiles 
    WHERE user_id = v_user.id;

    v_discrepancy := COALESCE(v_discrepancy, 0);

    IF v_reconstructed_sum != v_discrepancy THEN
      -- Create discrepancy audit review record
      INSERT INTO public.credit_backfill_reviews (user_id, profile_credits_balance, reconstructed_credits_balance, discrepancy)
      VALUES (v_user.id, v_discrepancy, v_reconstructed_sum, (v_discrepancy - v_reconstructed_sum));
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- reconcile_credit_lots: 6-month validity for new lots
CREATE OR REPLACE FUNCTION public.reconcile_credit_lots(p_user_id text, p_target integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sum integer;
  v_diff integer;
  v_lot record;
  v_take integer;
  v_today date := CURRENT_DATE;
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_user_id) THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(remaining_credits), 0)
    INTO v_sum
    FROM public.credit_lots
   WHERE user_id = p_user_id;

  v_diff := COALESCE(p_target, 0) - v_sum;

  IF v_diff > 0 THEN
    INSERT INTO public.credit_lots (
      user_id,
      original_purchaser_id,
      original_purchase_date,
      official_expiry_date,
      grace_expiry_date,
      initial_credits,
      remaining_credits
    ) VALUES (
      p_user_id,
      p_user_id,
      v_today,
      v_today + INTERVAL '6 months',
      v_today + INTERVAL '6 months' + INTERVAL '7 days',
      v_diff,
      v_diff
    );
  ELSIF v_diff < 0 THEN
    FOR v_lot IN
      SELECT id, remaining_credits
        FROM public.credit_lots
       WHERE user_id = p_user_id
         AND remaining_credits > 0
       ORDER BY official_expiry_date ASC, created_at ASC
    LOOP
      EXIT WHEN v_diff >= 0;
      v_take := LEAST(v_lot.remaining_credits, -v_diff);
      UPDATE public.credit_lots
         SET remaining_credits = remaining_credits - v_take
       WHERE id = v_lot.id;
      v_diff := v_diff + v_take;
    END LOOP;
  END IF;
END;
$$;
