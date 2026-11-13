-- ============================================================================
-- CREDIT LOT / BALANCE CONSISTENCY
--
-- Problem: booking spend and refund paths only touch user_profiles.credits_balance.
-- credit_lots were therefore never decremented on a booking and never restored on
-- a refund, so the lot breakdown drifted away from the real balance:
--   * lots could claim more credits than the user actually had
--   * legacy users with a balance but no lots at all could not transfer credits
--     ("Insufficient unexpired credits available for transfer")
--
-- Fix: keep credit_lots reconciled with the authoritative credits_balance.
-- The reconciliation runs as a DEFERRED constraint trigger so it observes the
-- final state of the transaction (fulfill_payment_order updates the balance and
-- then inserts the real lot in the same transaction).
-- ============================================================================

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
      v_today + INTERVAL '1 year',
      v_today + INTERVAL '1 year' + INTERVAL '7 days',
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

REVOKE EXECUTE ON FUNCTION public.reconcile_credit_lots(text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reconcile_credit_lots(text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reconcile_credit_lots(text, integer) FROM authenticated;

CREATE OR REPLACE FUNCTION public.sync_credit_lots_after_balance_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.credits_balance IS NOT DISTINCT FROM OLD.credits_balance THEN
    RETURN NULL;
  END IF;

  PERFORM public.reconcile_credit_lots(NEW.user_id, COALESCE(NEW.credits_balance, 0));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_credit_lots ON public.user_profiles;
CREATE CONSTRAINT TRIGGER trg_sync_credit_lots
  AFTER UPDATE ON public.user_profiles
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_credit_lots_after_balance_change();

-- One-time reconciliation of the drift already present in production data.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.user_id, COALESCE(p.credits_balance, 0) AS bal
      FROM public.user_profiles p
     WHERE p.user_id IS NOT NULL
  LOOP
    IF r.bal > 0 OR EXISTS (SELECT 1 FROM public.credit_lots l WHERE l.user_id = r.user_id) THEN
      PERFORM public.reconcile_credit_lots(r.user_id, r.bal);
    END IF;
  END LOOP;
END;
$$;
