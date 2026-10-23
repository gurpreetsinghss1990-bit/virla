import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
}

// Canonical Plan Definitions (Server Authoritative)
interface PlanDef {
  name: string;
  credits: number;
  amountVal: string; // Net amount (e.g., '1270.00')
  gstVal: string;    // 18% GST (e.g., '228.60')
  totalPrice: string; // Gross amount payable in INR (e.g., '1499.00')
}

const AUTHORIZED_PLANS: Record<string, PlanDef> = {
  // Internal Dev Testing Plan (₹1 Real Gateway Verification)
  'plan-dev-test': {
    name: 'Dev Test 1 Rupee Verification',
    credits: 1,
    amountVal: '1.00',
    gstVal: '0.00',
    totalPrice: '1.00',
  },
  // Individual Plans (1 Person) - 5% GST
  'plan-ind-1': {
    name: 'Single Session',
    credits: 1,
    amountVal: '1499.00',
    gstVal: '75.00',
    totalPrice: '1574.00',
  },
  'plan-ind-2': {
    name: '8-Session Package',
    credits: 8,
    amountVal: '9800.00',
    gstVal: '490.00',
    totalPrice: '10290.00',
  },
  'plan-ind-3': {
    name: '16-Session Package',
    credits: 16,
    amountVal: '18000.00',
    gstVal: '900.00',
    totalPrice: '18900.00',
  },
  'plan-ind-4': {
    name: '32-Session Package',
    credits: 32,
    amountVal: '34400.00',
    gstVal: '1720.00',
    totalPrice: '36120.00',
  },
  'plan-ind-addon-buddy': {
    name: 'Workout Buddy Add-On',
    credits: 1,
    amountVal: '499.00',
    gstVal: '25.00',
    totalPrice: '524.00',
  },
  // Couple Plans (Train Together) - 5% GST
  'plan-cpl-1': {
    name: 'Single Couple Session',
    credits: 1,
    amountVal: '1899.00',
    gstVal: '95.00',
    totalPrice: '1994.00',
  },
  'plan-cpl-2': {
    name: '8-Session Couple Package',
    credits: 8,
    amountVal: '13000.00',
    gstVal: '650.00',
    totalPrice: '13650.00',
  },
  'plan-cpl-3': {
    name: '16-Session Couple Package',
    credits: 16,
    amountVal: '24400.00',
    gstVal: '1220.00',
    totalPrice: '25620.00',
  },
  'plan-cpl-4': {
    name: '32-Session Couple Package',
    credits: 32,
    amountVal: '47200.00',
    gstVal: '2360.00',
    totalPrice: '49560.00',
  },
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

// Built-in Web Crypto API HMAC SHA-256 (no external imports needed)
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
    const reqBody = await req.json().catch(() => ({}));
    const { planId, customerEmail, userId: bodyUserId } = reqBody;

    const userId = getRequestUserId(req) || bodyUserId || null;
    console.log(`[create-payment-order] Incoming request for plan: ${planId}, caller: ${userId}`);

    if (!userId) {
      console.warn('[create-payment-order] No user identity found on request.');
      return new Response(JSON.stringify({ error: 'Unauthorized: User ID not provided' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!planId) {
      return new Response(JSON.stringify({ error: 'planId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const plan = AUTHORIZED_PLANS[planId];
    if (!plan) {
      return new Response(JSON.stringify({ error: `Invalid planId: ${planId}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const envType = 'PROD';

    // Official Production Credentials exclusively:
    // - 100000000527738 is the parentMID / aggregatorID
    // - 100000000527739 is the sub-merchant ID
    const merchantId = Deno.env.get('PAYPHI_MERCHANT_ID') || '100000000527739';
    const aggregatorId = Deno.env.get('PAYPHI_AGGREGATOR_ID') || '100000000527738';
    const merchantName = Deno.env.get('PAYPHI_MERCHANT_NAME') || 'NAMRATHA JAUNI';
    const secretKey = Deno.env.get('PAYPHI_SECRET_KEY') || '29037ef8-b1b3-4bc7-a887-02c8ad12c46c';
    const appId = Deno.env.get('PAYPHI_APP_ID') || '80bc18249511f868';
    const currencyCode = '356';

    // Generate unique authoritative transaction number
    const merchantTxnNo = `TXN_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    // Generate secureToken using Web Crypto HMAC SHA-256
    const formattedAmount = plan.totalPrice;
    const tokenInput = `${formattedAmount}${currencyCode}${merchantId}${merchantTxnNo}`;
    const secureToken = await computeHmacSHA256Hex(tokenInput, secretKey);

    // Save pending payment record to database via Service Role Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: dbError } = await supabase
      .from('credit_transactions')
      .insert({
        id: merchantTxnNo,
        user_id: userId,
        type: 'purchase',
        amount: `₹${Number(plan.amountVal).toLocaleString('en-IN')}`,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        status: 'pending',
        credits: plan.credits,
      });

    if (dbError) {
      console.warn('[create-payment-order] DB log warning (non-fatal):', dbError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        order: {
          merchantTxnNo,
          amount: formattedAmount,
          currencyCode,
          merchantId,
          aggregatorId,
          merchantName,
          envType,
          appId,
          customerEmail: customerEmail || 'customer@virla.in',
          secureToken,
          secretKey,
          plan: {
            id: planId,
            name: plan.name,
            credits: plan.credits,
            amountVal: plan.amountVal,
            gstVal: plan.gstVal,
            totalPrice: plan.totalPrice,
          },
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('[create-payment-order] Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
