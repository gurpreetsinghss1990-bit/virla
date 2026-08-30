-- Migration: Production Transfer Credits System
-- Created At: 2026-08-30

-- 1. Create Credit Lots Table
CREATE TABLE IF NOT EXISTS public.credit_lots (
    id TEXT PRIMARY KEY DEFAULT ('lot-' || (extract(epoch from now()) * 1000)::text || '-' || floor(random() * 1000000)::text),
    user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    original_purchaser_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    original_purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    official_expiry_date DATE NOT NULL,
    grace_expiry_date DATE NOT NULL,
    initial_credits INTEGER NOT NULL,
    remaining_credits INTEGER NOT NULL CHECK (remaining_credits >= 0),
    original_lot_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable select for own lots" ON public.credit_lots;
CREATE POLICY "Enable select for own lots" ON public.credit_lots
    FOR SELECT TO authenticated USING (auth.uid()::text = user_id);

-- 2. Create Expiry Notifications Sent Log Table
CREATE TABLE IF NOT EXISTS public.expiry_notifications_sent (
    id TEXT PRIMARY KEY DEFAULT ('sentnotify-' || (extract(epoch from now()) * 1000)::text || '-' || floor(random() * 1000000)::text),
    lot_id TEXT REFERENCES public.credit_lots(id) ON DELETE CASCADE,
    milestone_days INTEGER NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(lot_id, milestone_days)
);

-- Disable RLS
ALTER TABLE public.expiry_notifications_sent DISABLE ROW LEVEL SECURITY;

-- 3. Create Credit Backfill Reviews Log Table
CREATE TABLE IF NOT EXISTS public.credit_backfill_reviews (
    id TEXT PRIMARY KEY DEFAULT ('backfillrev-' || (extract(epoch from now()) * 1000)::text || '-' || floor(random() * 1000000)::text),
    user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    profile_credits_balance INTEGER,
    reconstructed_credits_balance INTEGER,
    discrepancy INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Disable RLS
ALTER TABLE public.credit_backfill_reviews DISABLE ROW LEVEL SECURITY;

-- 4. Create Invitations Table
CREATE TABLE IF NOT EXISTS public.invitations (
    id TEXT PRIMARY KEY DEFAULT ('invite-' || (extract(epoch from now()) * 1000)::text || '-' || floor(random() * 1000000)::text),
    sender_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    phone TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for all authenticated users" ON public.invitations;
CREATE POLICY "Enable read for all authenticated users" ON public.invitations
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable insert for sender" ON public.invitations;
CREATE POLICY "Enable insert for sender" ON public.invitations
    FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = sender_id);


-- 5. Trigger Function to auto-allocate or consume credit lots on transaction records
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
    v_expiry_date := v_now_date + INTERVAL '1 year';
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

  -- C. REFUND: Restore credits back to the most recently consumed active lots
  ELSIF NEW.type = 'refund' THEN
    v_needed := NEW.credits;
    
    FOR v_lot IN 
      SELECT * FROM public.credit_lots 
      WHERE user_id = NEW.user_id 
        AND remaining_credits < initial_credits
        AND (
          (v_is_elite AND v_now_date <= grace_expiry_date)
          OR 
          (NOT v_is_elite AND v_now_date <= official_expiry_date)
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

    -- If there's still refund credit remainder, allocate a brand new lot
    IF v_needed > 0 THEN
      v_expiry_date := v_now_date + INTERVAL '1 year';
      v_grace_date := v_expiry_date + INTERVAL '7 days';
      INSERT INTO public.credit_lots (user_id, original_purchaser_id, original_purchase_date, official_expiry_date, grace_expiry_date, initial_credits, remaining_credits, original_lot_id)
      VALUES (NEW.user_id, NEW.user_id, v_now_date, v_expiry_date, v_grace_date, v_needed, v_needed, NULL);
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Register Transaction Trigger
DROP TRIGGER IF EXISTS trg_sync_credit_lots ON public.credit_transactions;
CREATE TRIGGER trg_sync_credit_lots
AFTER INSERT ON public.credit_transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_credit_lots_on_transaction();


-- 6. RPC: find_recipient_by_phone
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

  v_sender_id := auth.uid()::text;
  IF v_sender_id IS NULL OR v_sender_id = '' THEN
    BEGIN
      v_sender_id := current_setting('request.headers', true)::jsonb->>'x-user-id';
    EXCEPTION WHEN OTHERS THEN
      v_sender_id := NULL;
    END;
  END IF;

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


-- 7. RPC: transfer_credits (Atomic, Server-Side)
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
  -- Resolve sender
  v_from_client_id := auth.uid()::text;
  IF v_from_client_id IS NULL OR v_from_client_id = '' THEN
    BEGIN
      v_from_client_id := current_setting('request.headers', true)::jsonb->>'x-user-id';
    EXCEPTION WHEN OTHERS THEN
      v_from_client_id := NULL;
    END;
  END IF;

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


-- 8. RPC: process_credit_expiries_and_reminders (Authoritative Expiry & Push Notifications Scheduler)
CREATE OR REPLACE FUNCTION public.process_credit_expiries_and_reminders()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_lot record;
  v_days integer;
  v_now date := CURRENT_DATE;
  v_is_elite boolean;
  v_title text;
  v_body text;
  v_now_ms bigint;
  v_expired_count integer;
  v_notif_payload text;
BEGIN
  -- A. Expirations Update
  FOR v_lot IN 
    SELECT l.*, p.membership_status 
    FROM public.credit_lots l
    LEFT JOIN public.user_profiles p ON l.user_id = p.user_id
    WHERE l.remaining_credits > 0
  LOOP
    v_is_elite := COALESCE(v_lot.membership_status = 'Elite', false);
    
    IF (v_is_elite AND v_now > v_lot.grace_expiry_date)
       OR (NOT v_is_elite AND v_now > v_lot.official_expiry_date) THEN
       
       v_expired_count := v_lot.remaining_credits;
       v_now_ms := (EXTRACT(epoch FROM now()) * 1000)::bigint;

       UPDATE public.credit_lots SET remaining_credits = 0 WHERE id = v_lot.id;

       UPDATE public.user_profiles 
       SET credits_balance = GREATEST(0, credits_balance - v_expired_count) 
       WHERE user_id = v_lot.user_id;

       INSERT INTO public.credit_transactions (id, user_id, type, amount, date, status, credits)
       VALUES (
         'tx-' || v_now_ms || '-exp-' || floor(random()*1000)::text,
         v_lot.user_id,
         'expired',
         'Original expiry: ' || to_char(v_lot.official_expiry_date, 'Mon DD, YYYY'),
         to_char(now(), 'Mon DD, YYYY'),
         'paid',
         v_expired_count
       );
    END IF;
  END LOOP;

  -- B. Expiring Reminders warnings sending
  FOR v_lot IN 
    SELECT l.*, p.membership_status 
    FROM public.credit_lots l
    LEFT JOIN public.user_profiles p ON l.user_id = p.user_id
    WHERE l.remaining_credits > 0 AND l.official_expiry_date >= v_now
  LOOP
    v_is_elite := COALESCE(v_lot.membership_status = 'Elite', false);
    v_days := v_lot.official_expiry_date - v_now;

    IF v_days IN (30, 21, 14, 7, 5, 4, 3, 2, 1) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.expiry_notifications_sent 
        WHERE lot_id = v_lot.id AND milestone_days = v_days
      ) THEN
        INSERT INTO public.expiry_notifications_sent (lot_id, milestone_days)
        VALUES (v_lot.id, v_days);

        IF v_days = 2 THEN
          IF v_is_elite THEN
            v_title := 'A special benefit for you ❤️';
            v_body := 'Your ' || v_lot.remaining_credits || ' credits are approaching their expiry date. Because you''re a premium Virla client, we don''t want you to compromise on your fitness journey. We''re giving you an additional 7 days to use your remaining credits.';
          ELSE
            v_title := 'Credits Expiry Warning ⚡';
            v_body := 'Your ' || v_lot.remaining_credits || ' credits are expiring in 2 days. Book a session now to use them!';
          END IF;
        ELSIF v_days = 1 THEN
          v_title := 'Final Expiry Reminder ⏰';
          v_body := 'Your ' || v_lot.remaining_credits || ' credits are expiring tomorrow! Don''t let them go to waste—book a session today.';
        ELSE
          v_title := 'Credits Expiring Soon ⚡';
          v_body := 'Your ' || v_lot.remaining_credits || ' credits will expire in ' || v_days || ' days (on ' || to_char(v_lot.official_expiry_date, 'Mon DD, YYYY') || ').';
        END IF;

        -- Format body with JSON payload for Expo Push API triggers compatibility
        v_notif_payload := json_build_object(
          'body', v_body,
          'deepLink', '/wallet',
          'type', 'Wallet Updates'
        )::text;

        -- Insert notification to fire trg_notification_inserted push notifications
        INSERT INTO public.notifications (id, user_id, title, body, read, timestamp, "group", icon)
        VALUES (
          'notif-' || extract(epoch from now())::bigint || '-' || floor(random()*1000)::text,
          v_lot.user_id,
          v_title,
          v_notif_payload,
          false,
          now(),
          'today',
          'bell'
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Grant accesses to authenticated users
GRANT EXECUTE ON FUNCTION public.find_recipient_by_phone(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_credits(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_credit_expiries_and_reminders() TO authenticated;


-- 9. REGISTER CRON SCHEDULER
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('process-credit-expiries-and-reminders-job', '0 0 * * *', 'SELECT public.process_credit_expiries_and_reminders();');
  END IF;
END;
$$;


-- 10. RECONSTRUCT LEDGER HISTORICAL BACKFILL & AUDIT
DO $$
DECLARE
  v_user record;
  v_tx record;
  v_parsed_date date;
  v_expiry date;
  v_grace date;
  v_lot record;
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

  FOR v_user IN SELECT id, role FROM public.users WHERE role = 'customer' LOOP
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

      v_expiry := v_parsed_date + INTERVAL '1 year';
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
$$;
