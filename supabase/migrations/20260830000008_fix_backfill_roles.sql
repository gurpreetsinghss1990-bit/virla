-- Migration: Fix Backfill Roles & Re-run Reconstructed Credit Lots
-- Created At: 2026-08-30

-- 1. Create or replace the backfill procedure to include all roles and enforce the anniversary expiry rule
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
      v_expiry := v_parsed_date + INTERVAL '1 year' - INTERVAL '1 day';
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

-- 2. Run the backfill now to populate all active lots for all roles
SELECT public.backfill_credit_lots_from_transactions();
