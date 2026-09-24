import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
  'plan-ind-1': {
    name: 'Single Session',
    credits: 1,
    amountVal: '1270.00',
    gstVal: '229.00',
    totalPrice: '1499.00',
  },
  'plan-ind-2': {
    name: 'Starter Pack',
    credits: 8,
    amountVal: '9321.00',
    gstVal: '1678.00',
    totalPrice: '10999.00',
  },
  'plan-ind-3': {
    name: 'Active Pack',
    credits: 12,
    amountVal: '10169.00',
    gstVal: '1830.00',
    totalPrice: '11999.00',
  },
  'plan-ind-4': {
    name: 'Elite Pack',
    credits: 15,
    amountVal: '15253.00',
    gstVal: '2746.00',
    totalPrice: '17999.00',
  },
  // Couple Plans
  'plan-cpl-1': {
    name: 'Couple Single Session',
    credits: 1,
    amountVal: '2118.00',
    gstVal: '381.00',
    totalPrice: '2499.00',
  },
  'plan-cpl-2': {
    name: 'Couple Starter Pack',
    credits: 8,
    amountVal: '15253.00',
    gstVal: '2746.00',
    totalPrice: '17999.00',
  },
  'plan-cpl-3': {
    name: 'Couple Active Pack',
    credits: 12,
    amountVal: '16270.00',
    gstVal: '2929.00',
    totalPrice: '19199.00',
  },
  'plan-cpl-4': {
    name: 'Couple Elite Pack',
    credits: 15,
    amountVal: '25423.00',
    gstVal: '4576.00',
    totalPrice: '29999.00',
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
    const { planId, customerEmail } = reqBody;

    const userId = getRequestUserId(req);
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

    const merchantId = Deno.env.get('PAYPHI_MERCHANT_ID') || '100000000007164';
    const appId = Deno.env.get('PAYPHI_APP_ID') || '80bc18249511f868';
    const secretKey = Deno.env.get('PAYPHI_SECRET_KEY') || 'db06cca0-838b-4e01-8b20-6ac446ffb6bd';
    const currencyCode = '356';
    const aggregatorId = Deno.env.get('PAYPHI_AGGREGATOR_ID') || 'A100000000007164';
    const merchantName = Deno.env.get('PAYPHI_MERCHANT_NAME') || 'Sapphire Test';
    const envType = Deno.env.get('PAYPHI_ENV') || 'INT';

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
