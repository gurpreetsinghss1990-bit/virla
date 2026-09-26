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
    const payload = await req.json().catch(() => ({}));
    console.log('[payphi-webhook] Server-to-Server Webhook Received:', JSON.stringify(payload));

    const extract = (keys: string[], fallback = ''): string => {
      for (const key of keys) {
        if (payload[key] !== undefined && payload[key] !== null) {
          return String(payload[key]).trim();
        }
      }
      return fallback;
    };

    const merchantTxnNo = extract(['merchantTxnNo', 'MerchantTxnNo', 'txnNo', 'txId']);
    const status = extract(['responseCode', 'txnResponseCode', 'txnStatus', 'resultCode', 'status']).toLowerCase();
    const resultType = extract(['ResultType', 'resultType', 'paymentStatus']).toUpperCase();
    const message = extract(['respDescription', 'txnRespDescription', 'ResultMessage', 'message', 'statusMessage']);
    const receivedChecksum = extract(['secureToken', 'SecureToken', 'checksum', 'responseHash']);
    const amount = extract(['amount', 'Amount']);

    if (!merchantTxnNo) {
      return new Response(JSON.stringify({ error: 'Missing merchantTxnNo' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const secretKey = Deno.env.get('PAYPHI_SECRET_KEY') || 'db06cca0-838b-4e01-8b20-6ac446ffb6bd';

    // Cryptographic Checksum Verification (Antitamper Protection)
    if (receivedChecksum && amount) {
      const expectedChecksum = await computeHmacSHA256Hex(`${amount}${merchantTxnNo}`, secretKey);
      if (receivedChecksum.toLowerCase() !== expectedChecksum.toLowerCase()) {
        console.error(`[payphi-webhook] CHECKSUM MISMATCH! Received: ${receivedChecksum}, Expected: ${expectedChecksum}`);
        return new Response(JSON.stringify({ error: 'Invalid HMAC signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const isSuccess =
      ['0000', '000', 'success'].includes(status) ||
      resultType === 'SUCCESS' ||
      resultType === 'COMPLETED' ||
      message.toLowerCase().includes('success');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!isSuccess) {
      console.warn(`[payphi-webhook] Payment failed/cancelled for ${merchantTxnNo}. Status: ${status}`);
      await supabase
        .from('credit_transactions')
        .update({ status: 'failed' })
        .eq('id', merchantTxnNo);

      return new Response(JSON.stringify({ status: 'acknowledged', paymentStatus: 'failed' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // =========================================================================
    // ATOMIC ROW-LOCK FULFILLMENT (Concurrency & TOCTOU Race Condition Proof)
    // Calls PostgreSQL `fulfill_payment_order` with SELECT ... FOR UPDATE
    // =========================================================================
    const { data: fulfillment, error: rpcError } = await supabase.rpc('fulfill_payment_order', {
      p_merchant_txn_no: merchantTxnNo,
    });

    if (rpcError) {
      console.error('[payphi-webhook] Atomic fulfillment RPC failed:', rpcError);
      return new Response(JSON.stringify({ error: rpcError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[payphi-webhook] Atomic fulfillment result for ${merchantTxnNo}:`, JSON.stringify(fulfillment));

    return new Response(
      JSON.stringify({
        success: true,
        merchantTxnNo,
        outcome: fulfillment?.status,
        credits: fulfillment?.credits,
        newBalance: fulfillment?.new_balance || fulfillment?.balance,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('[payphi-webhook] Unhandled error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
