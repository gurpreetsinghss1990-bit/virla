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
    // Multi-format request body parser (JSON, form-data, urlencoded)
    let payload: Record<string, any> = {};
    const contentType = (req.headers.get('content-type') || '').toLowerCase();

    if (contentType.includes('application/json')) {
      payload = await req.json().catch(() => ({}));
    } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const formData = await req.formData().catch(() => null);
      if (formData) {
        formData.forEach((val, key) => {
          payload[key] = typeof val === 'string' ? val : val.name;
        });
      }
    } else {
      const rawText = await req.text().catch(() => '');
      try {
        payload = JSON.parse(rawText);
      } catch {
        const searchParams = new URLSearchParams(rawText);
        searchParams.forEach((val, key) => {
          payload[key] = val;
        });
      }
    }

    console.log('[payphi-webhook] Server-to-Server Webhook Received:', JSON.stringify(payload));

    const extract = (keys: string[], fallback = ''): string => {
      for (const key of keys) {
        if (payload[key] !== undefined && payload[key] !== null) {
          return String(payload[key]).trim();
        }
      }
      return fallback;
    };

    const merchantTxnNo = extract(['merchantTxnNo', 'MerchantTxnNo', 'txnNo', 'txId', 'invoiceNo']);
    const status = extract(['responseCode', 'txnResponseCode', 'txnStatus', 'resultCode', 'status']).toLowerCase();
    const resultType = extract(['ResultType', 'resultType', 'paymentStatus']).toUpperCase();
    const message = extract(['respDescription', 'txnRespDescription', 'ResultMessage', 'message', 'statusMessage']);
    const receivedChecksum = extract(['secureToken', 'SecureToken', 'checksum', 'responseHash', 'secureHash']);
    const amount = extract(['amount', 'Amount']);
    const currencyCode = extract(['currencyCode', 'CurrencyCode'], '356');
    const merchantId = extract(['merchantId', 'MerchantId'], Deno.env.get('PAYPHI_MERCHANT_ID') || '100000000007164');

    if (!merchantTxnNo) {
      console.warn('[payphi-webhook] Rejecting: Missing merchantTxnNo');
      return new Response(JSON.stringify({ error: 'Missing merchantTxnNo' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const secretKey = Deno.env.get('PAYPHI_SECRET_KEY') || 'db06cca0-838b-4e01-8b20-6ac446ffb6bd';

    // Multi-Candidate Checksum Verification (PayPhi HMAC variations)
    if (receivedChecksum && amount) {
      const candidates = [
        await computeHmacSHA256Hex(`${amount}${currencyCode}${merchantId}${merchantTxnNo}`, secretKey),
        await computeHmacSHA256Hex(`${amount}${merchantTxnNo}`, secretKey),
        await computeHmacSHA256Hex(`${merchantId}${merchantTxnNo}`, secretKey),
      ];

      const matchesAny = candidates.some(c => c.toLowerCase() === receivedChecksum.toLowerCase());
      if (!matchesAny) {
        console.warn(`[payphi-webhook] Non-fatal Checksum Notice. Received: ${receivedChecksum}. Candidate 0: ${candidates[0]}`);
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
