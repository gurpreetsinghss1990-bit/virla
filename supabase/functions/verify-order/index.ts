import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
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

function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(payloadBase64);
    return JSON.parse(decoded);
  } catch (_e) {
    return null;
  }
}

function getRequestUserId(req: Request): string | null {
  const authHeader = req.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = decodeJwtPayload(token);
    if (payload && payload.sub) return payload.sub;
  }
  return req.headers.get('x-user-id') || null;
}

// ============================================================================
// RATE LIMIT & TRANSACTION COOLDOWN PROTECTION
// Prevents API hammering, DoS, and merchant account freeze from PayPhi/ICICI
// ============================================================================
const INQUIRY_COOLDOWN_MS = 10 * 1000; // 10 seconds per transaction
const USER_RATE_LIMIT_MS = 1000; // Max 1 request per second per user
const lastInquiryByTxn = new Map<string, number>();
const lastRequestByUser = new Map<string, number>();

// Clean up maps periodically to prevent memory leaks in persistent workers
setInterval(() => {
  const now = Date.now();
  for (const [txn, time] of lastInquiryByTxn.entries()) {
    if (now - time > 60000) lastInquiryByTxn.delete(txn);
  }
  for (const [u, time] of lastRequestByUser.entries()) {
    if (now - time > 60000) lastRequestByUser.delete(u);
  }
}, 60000);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const reqBody = await req.json().catch(() => ({}));
    const { merchantTxnNo } = reqBody;

    const userId = getRequestUserId(req);
    console.log(`[verify-order] Verification request for ${merchantTxnNo}, authenticated caller: ${userId}`);

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Authentication required to verify orders' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!merchantTxnNo) {
      return new Response(JSON.stringify({ error: 'merchantTxnNo is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. User-Level Anti-Hammering Guard (Max 1 request per second)
    const now = Date.now();
    const lastUserReq = lastRequestByUser.get(userId);
    if (lastUserReq && (now - lastUserReq) < USER_RATE_LIMIT_MS) {
      console.warn(`[verify-order] Rate limit exceeded by user ${userId}`);
      return new Response(
        JSON.stringify({
          error: 'Too many verification attempts. Please wait a moment.',
          status: 'rate_limited',
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    lastRequestByUser.set(userId, now);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Fetch transaction record strictly scoping to authenticated user
    const { data: tx, error: txError } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('id', merchantTxnNo)
      .eq('user_id', userId)
      .maybeSingle();

    if (txError || !tx) {
      console.warn(`[verify-order] Order not found or not owned by user ${userId}: ${merchantTxnNo}`);
      return new Response(JSON.stringify({ error: 'Order not found or access denied', status: 'not_found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Fast Path: If Webhook or previous check already confirmed & credited the order
    if (tx.status === 'paid') {
      console.log(`[verify-order] Order ${merchantTxnNo} is already PAID and fulfilled.`);
      return new Response(
        JSON.stringify({
          success: true,
          status: 'paid',
          merchantTxnNo,
          credits: tx.credits,
          message: 'Order already verified and paid',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (tx.status === 'failed' || tx.status === 'expired') {
      return new Response(
        JSON.stringify({
          success: false,
          status: tx.status,
          merchantTxnNo,
          message: `Order was marked ${tx.status}`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 4. TRANSACTION COOLDOWN CHECK:
    // If PayPhi gateway inquiry was already executed in the last 10 seconds for this transaction,
    // DO NOT call PayPhi again. Return cached pending response to prevent gateway abuse/ban.
    const lastInquiryTime = lastInquiryByTxn.get(merchantTxnNo);
    if (lastInquiryTime && (now - lastInquiryTime) < INQUIRY_COOLDOWN_MS) {
      const waitRemainingSec = Math.ceil((INQUIRY_COOLDOWN_MS - (now - lastInquiryTime)) / 1000);
      console.log(`[verify-order] Cooldown active for ${merchantTxnNo}. Returning cached pending (${waitRemainingSec}s remaining).`);
      return new Response(
        JSON.stringify({
          success: false,
          status: 'pending',
          merchantTxnNo,
          cached: true,
          message: `Status inquiry already executed recently. Retrying too quickly (${waitRemainingSec}s cooldown).`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Mark current inquiry timestamp
    lastInquiryByTxn.set(merchantTxnNo, now);

    // 5. Active Inquiry: Call PayPhi Status Inquiry API Server-to-Server
    const merchantId = Deno.env.get('PAYPHI_MERCHANT_ID') || '100000000007164';
    const secretKey = Deno.env.get('PAYPHI_SECRET_KEY') || 'db06cca0-838b-4e01-8b20-6ac446ffb6bd';
    const envType = Deno.env.get('PAYPHI_ENV') || 'INT';

    const payphiBaseUrl = envType === 'PRD' 
      ? 'https://phicommerce.com/pg' 
      : 'https://qa.phicommerce.com/pg';

    let gatewaySuccess = false;
    let gatewayStatus = 'pending';

    try {
      // Cryptographic signature for Status Inquiry: merchantId + merchantTxnNo
      const inquiryHash = await computeHmacSHA256Hex(`${merchantId}${merchantTxnNo}`, secretKey);

      const inquiryResponse = await fetch(`${payphiBaseUrl}/api/v1/transaction/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          merchantId,
          merchantTxnNo,
          secureToken: inquiryHash,
        }),
      });

      if (inquiryResponse.ok) {
        const inquiryData = await inquiryResponse.json();
        console.log(`[verify-order] PayPhi Server Inquiry Response:`, JSON.stringify(inquiryData));

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

        if (['0000', '000', 'success'].includes(resCode) || resType === 'SUCCESS' || resType === 'COMPLETED') {
          gatewaySuccess = true;
          gatewayStatus = 'paid';
        } else if (['fail', 'failed', 'cancelled', 'canceled'].includes(resCode) || resType === 'FAILED') {
          gatewayStatus = 'failed';
        }
      } else {
        console.warn(`[verify-order] PayPhi Status Inquiry returned HTTP status: ${inquiryResponse.status}`);
      }
    } catch (inquiryErr: any) {
      console.warn(`[verify-order] Inquiry fetch network notice:`, inquiryErr.message);
    }

    // 6. If PayPhi server confirmed success, atomically fulfill credits via row-locked RPC
    if (gatewaySuccess) {
      const { data: fulfillment, error: rpcError } = await supabase.rpc('fulfill_payment_order', {
        p_merchant_txn_no: merchantTxnNo,
      });

      if (rpcError) {
        console.error('[verify-order] fulfill_payment_order RPC failed:', rpcError);
        return new Response(JSON.stringify({ error: rpcError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[verify-order] Atomic fulfillment response for ${merchantTxnNo}:`, JSON.stringify(fulfillment));

      return new Response(
        JSON.stringify({
          success: true,
          status: 'paid',
          merchantTxnNo,
          credits: fulfillment?.credits,
          newBalance: fulfillment?.new_balance || fulfillment?.balance,
          outcome: fulfillment?.status,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (gatewayStatus === 'failed') {
      await supabase
        .from('credit_transactions')
        .update({ status: 'failed' })
        .eq('id', merchantTxnNo);

      return new Response(
        JSON.stringify({
          success: false,
          status: 'failed',
          merchantTxnNo,
          error: 'Payment was marked failed by gateway.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Still pending (waiting for webhook or user didn't complete payment)
    return new Response(
      JSON.stringify({
        success: false,
        status: 'pending',
        merchantTxnNo,
        message: 'Payment is still being processed. Please check back shortly.',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('[verify-order] Unexpected error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
