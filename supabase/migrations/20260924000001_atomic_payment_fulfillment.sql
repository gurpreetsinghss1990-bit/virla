-- ============================================================================
-- CONCURRENCY HARDENING: Atomic Idempotent Payment Fulfillment
-- Prevents Double-Crediting race condition between Webhook and verify-order
-- ============================================================================

-- 1. Add order_id unique tracking column on credit_lots
ALTER TABLE public.credit_lots 
ADD COLUMN IF NOT EXISTS order_id TEXT UNIQUE;

-- 2. Create atomic, idempotent fulfillment function with ROW LOCK (FOR UPDATE)
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
  -- The other worker blocks until this transaction commits.
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

  -- 2. IDEMPOTENCY CHECK: If already fulfilled by concurrent worker, return paid immediately
  IF v_tx.status = 'paid' THEN
    SELECT credits_balance INTO v_current_balance
    FROM public.user_profiles
    WHERE user_id = v_tx.user_id;

    RETURN jsonb_build_object(
      'success', true,
      'status', 'already_processed',
      'merchant_txn_no', p_merchant_txn_no,
      'credits', v_tx.credits,
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

  -- 5. Allocate Credit Lot with 1 year validity and UNIQUE order_id constraint
  v_official_expiry := v_today + INTERVAL '1 year';
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
    'lot_id', v_lot_id
  );
END;
$$;

-- Grant execution to service_role and postgres only
REVOKE EXECUTE ON FUNCTION public.fulfill_payment_order(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fulfill_payment_order(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fulfill_payment_order(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_payment_order(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fulfill_payment_order(TEXT) TO postgres;
