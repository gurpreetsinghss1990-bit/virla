import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Built-in Web Crypto API HMAC SHA-256
async function computeHmacSHA256Hex(message: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const msgData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[reconcile-pending-orders] Starting scheduled reconciliation sweep...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const merchantId = Deno.env.get('PAYPHI_MERCHANT_ID') || '100000000007164';
    const secretKey = Deno.env.get('PAYPHI_SECRET_KEY') || 'db06cca0-838b-4e01-8b20-6ac446ffb6bd';
    const envType = Deno.env.get('PAYPHI_ENV') || 'INT';

    const payphiBaseUrl = envType === 'PRD'
      ? 'https://phicommerce.com/pg'
      : 'https://qa.phicommerce.com/pg';

    // 1. Fetch pending purchase transactions created more than 5 minutes ago
    // In our system, transactions start with "TXN_" followed by timestamp in milliseconds
    const { data: pendingTxs, error: fetchErr } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('status', 'pending')
      .eq('type', 'purchase')
      .order('id', { ascending: false })
      .limit(30);

    if (fetchErr) {
      console.error('[reconcile-pending-orders] Error querying pending orders:', fetchErr);
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!pendingTxs || pendingTxs.length === 0) {
      console.log('[reconcile-pending-orders] No pending transactions found to reconcile.');
      return new Response(JSON.stringify({ message: 'No pending orders found', reconciledCount: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[reconcile-pending-orders] Found ${pendingTxs.length} pending transactions. Inquiring PayPhi gateway...`);

    const results: any[] = [];
    const nowMs = Date.now();

    for (const tx of pendingTxs) {
      const merchantTxnNo = tx.id;

      // Extract transaction creation timestamp from ID if format TXN_<timestamp>_<random>
      let isOldEnough = true;
      const parts = merchantTxnNo.split('_');
      if (parts.length >= 2) {
        const txTimestamp = parseInt(parts[1], 10);
        if (!isNaN(txTimestamp) && (nowMs - txTimestamp) < (2 * 60 * 1000)) {
          // Less than 2 minutes old — let active client/webhook handle it first
          isOldEnough = false;
        }
      }

      if (!isOldEnough) {
        console.log(`[reconcile-pending-orders] Skipping ${merchantTxnNo} (created < 2 mins ago).`);
        continue;
      }

      try {
        const inquiryHash = await computeHmacSHA256Hex(`${merchantId}${merchantTxnNo}`, secretKey);

        const inquiryResponse = await fetch(`${payphiBaseUrl}/api/v1/transaction/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            merchantId,
            merchantTxnNo,
            secureToken: inquiryHash,
          }),
        });

        if (!inquiryResponse.ok) {
          console.warn(`[reconcile-pending-orders] Inquiry HTTP ${inquiryResponse.status} for ${merchantTxnNo}`);
          continue;
        }

        const inquiryData = await inquiryResponse.json();

        const extract = (keys: string[], fallback = ''): string => {
          for (const key of keys) {
            if (inquiryData[key] !== undefined && inquiryData[key] !== null) {
              return String(inquiryData[key]).trim();
            }
          }
          return fallback;
        };

        const resCode = extract(['responseCode', 'txnResponseCode', 'resultCode', 'status']).toLowerCase();
        const resType = extract(['ResultType', 'resultType', 'paymentStatus']).toUpperCase();

        const isSuccess = ['0000', '000', 'success'].includes(resCode) || resType === 'SUCCESS' || resType === 'COMPLETED';
        const isFailed = ['fail', 'failed', 'cancelled', 'canceled'].includes(resCode) || resType === 'FAILED';

        if (isSuccess) {
          console.log(`[reconcile-pending-orders] RECOVERED ORPHAN TRANSACTION: ${merchantTxnNo} was SUCCESSFUL! Fulfilling credits...`);

          const creditsToAdd = tx.credits || 0;

          // Update user balance
          const { data: currentProfile } = await supabase
            .from('user_profiles')
            .select('credits_balance')
            .eq('user_id', tx.user_id)
            .single();

          const newCredits = ((currentProfile?.credits_balance) || 0) + creditsToAdd;

          await supabase
            .from('user_profiles')
            .update({
              credits_balance: newCredits,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', tx.user_id);

          // Mark paid
          await supabase
            .from('credit_transactions')
            .update({
              status: 'paid',
              date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
            })
            .eq('id', merchantTxnNo);

          // Allocate credit lot
          const today = new Date();
          const officialExpiry = new Date(today);
          officialExpiry.setFullYear(officialExpiry.getFullYear() + 1);
          const graceExpiry = new Date(officialExpiry);
          graceExpiry.setDate(graceExpiry.getDate() + 7);
          const fmtDate = (d: Date) => d.toISOString().split('T')[0];

          await supabase
            .from('credit_lots')
            .insert({
              id: `lot-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
              user_id: tx.user_id,
              original_purchaser_id: tx.user_id,
              original_purchase_date: fmtDate(today),
              official_expiry_date: fmtDate(officialExpiry),
              grace_expiry_date: fmtDate(graceExpiry),
              initial_credits: creditsToAdd,
              remaining_credits: creditsToAdd,
              original_lot_id: null,
            });

          results.push({ merchantTxnNo, outcome: 'recovered_and_credited', credits: creditsToAdd });
        } else if (isFailed) {
          console.log(`[reconcile-pending-orders] ${merchantTxnNo} marked failed by gateway.`);
          await supabase
            .from('credit_transactions')
            .update({ status: 'failed' })
            .eq('id', merchantTxnNo);
          results.push({ merchantTxnNo, outcome: 'marked_failed' });
        } else {
          // If transaction is older than 24 hours and still unknown/pending, expire it
          let txAgeHours = 0;
          if (parts.length >= 2) {
            const txTimestamp = parseInt(parts[1], 10);
            if (!isNaN(txTimestamp)) {
              txAgeHours = (nowMs - txTimestamp) / (1000 * 60 * 60);
            }
          }

          if (txAgeHours >= 24) {
            console.log(`[reconcile-pending-orders] ${merchantTxnNo} expired after 24 hours of inactivity.`);
            await supabase
              .from('credit_transactions')
              .update({ status: 'expired' })
              .eq('id', merchantTxnNo);
            results.push({ merchantTxnNo, outcome: 'expired' });
          } else {
            results.push({ merchantTxnNo, outcome: 'still_pending' });
          }
        }
      } catch (inqErr: any) {
        console.warn(`[reconcile-pending-orders] Error reconciling ${merchantTxnNo}:`, inqErr.message);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        reconciledCount: results.length,
        details: results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('[reconcile-pending-orders] Fatal error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
