import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  DECIMAL_PATTERN,
  ID_PATTERN,
  HEX_PATTERN,
  parseJsonObjectText,
  validationErrorResponse,
} from '../_shared/validate.ts'

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
      payload = parseJsonObjectText(await req.text().catch(() => ''));
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
        payload = parseJsonObjectText(rawText);
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
    const merchantId = extract(['merchantId', 'MerchantId'], Deno.env.get('PAYPHI_MERCHANT_ID') || '100000000527739');

    if (!merchantTxnNo || !ID_PATTERN.test(merchantTxnNo) || merchantTxnNo.length > 100) {
      console.warn('[payphi-webhook] Rejecting: invalid merchantTxnNo');
      return new Response(JSON.stringify({ error: 'Invalid merchantTxnNo' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (amount && !DECIMAL_PATTERN.test(amount)) {
      console.warn('[payphi-webhook] Rejecting: invalid amount format');
      return new Response(JSON.stringify({ error: 'Invalid amount' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (receivedChecksum && !HEX_PATTERN.test(receivedChecksum)) {
      console.warn('[payphi-webhook] Rejecting: checksum is not hexadecimal');
      return new Response(JSON.stringify({ error: 'Invalid checksum format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!merchantTxnNo) {
      console.warn('[payphi-webhook] Rejecting: Missing merchantTxnNo');
      return new Response(JSON.stringify({ error: 'Missing merchantTxnNo' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prodSecret = '29037ef8-b1b3-4bc7-a887-02c8ad12c46c';
    const configuredSecret = Deno.env.get('PAYPHI_SECRET_KEY') || prodSecret;

    // Multi-Candidate Checksum Verification (PayPhi HMAC SHA-256)
    if (receivedChecksum && amount) {
      const secretsToTest = Array.from(new Set([configuredSecret, prodSecret]));
      let matchesAny = false;

      for (const key of secretsToTest) {
        const candidates = [
          await computeHmacSHA256Hex(`${amount}${currencyCode}${merchantId}${merchantTxnNo}`, key),
          await computeHmacSHA256Hex(`${amount}${merchantTxnNo}`, key),
          await computeHmacSHA256Hex(`${merchantId}${merchantTxnNo}`, key),
        ];
        if (candidates.some(c => c.toLowerCase() === receivedChecksum.toLowerCase())) {
          matchesAny = true;
          break;
        }
      }

      if (!matchesAny) {
        const strictMode = (Deno.env.get('PAYPHI_WEBHOOK_STRICT') || '').toLowerCase() === 'true';
        console.warn(`[payphi-webhook] Checksum mismatch. Received: ${receivedChecksum}. strict=${strictMode}`);
        if (strictMode) {
          return new Response(JSON.stringify({ error: 'Checksum verification failed' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
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
    if (err?.name === 'RequestValidationError') {
      console.warn('[payphi-webhook] Rejected payload:', err.message);
      return validationErrorResponse(err, corsHeaders);
    }
    console.error('[payphi-webhook] Unhandled error:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
