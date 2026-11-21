-- Migration: Guard sync_credit_lots_on_transaction trigger against unpaid purchase orders
-- Purpose: Prevent ghost credit lots from being allocated when a purchase payment order is created but not yet paid/settled.
-- Created At: 2026-11-21

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

  -- A. PURCHASE: New purchase additions ONLY if transaction status is 'paid'
  -- Unpaid/pending orders should NOT allocate lots until fulfilled by fulfill_payment_order
  IF (NEW.type = 'purchase' OR NEW.type = 'paid') AND NEW.status = 'paid' THEN
    -- Anniversary rule: exactly 6 months minus 1 day (standard policy)
    v_expiry_date := v_now_date + INTERVAL '6 months' - INTERVAL '1 day';
    v_grace_date := v_expiry_date + INTERVAL '7 days';
    
    INSERT INTO public.credit_lots (
      user_id,
      original_purchaser_id,
      original_purchase_date,
      official_expiry_date,
      grace_expiry_date,
      initial_credits,
      remaining_credits,
      original_lot_id
    ) VALUES (
      NEW.user_id,
      NEW.user_id,
      v_now_date,
      v_expiry_date,
      v_grace_date,
      NEW.credits,
      NEW.credits,
      NULL
    );

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
      v_expiry_date := v_now_date + INTERVAL '6 months' - INTERVAL '1 day';
      v_grace_date := v_expiry_date + INTERVAL '7 days';
      INSERT INTO public.credit_lots (
        user_id,
        original_purchaser_id,
        original_purchase_date,
        official_expiry_date,
        grace_expiry_date,
        initial_credits,
        remaining_credits,
        original_lot_id
      ) VALUES (
        NEW.user_id,
        NEW.user_id,
        v_now_date,
        v_expiry_date,
        v_grace_date,
        v_needed,
        v_needed,
        NULL
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

