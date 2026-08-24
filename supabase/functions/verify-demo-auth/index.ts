import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function getEffectiveSupabaseUrl(): string {
  return Deno.env.get('SUPABASE_URL') || '';
}

function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) {
    return digits;
  }
  if (digits.length === 10) {
    return '91' + digits;
  }
  return digits;
}

function errorResponse(code: string, message: string, status = 400) {
  console.error(`[Edge Function] Error: ${code} - ${message}`);
  return new Response(JSON.stringify({
    success: false,
    code,
    message
  }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function mapPostgresToDBUser(row: any) {
  let regStatus = 'name_pending';
  const rawStatus = row.registration_status || '';
  if (rawStatus === 'COMPLETE' || rawStatus === 'complete') {
    regStatus = 'complete';
  } else if (
    rawStatus === 'PROFILE_DETAILS_PENDING' || 
    rawStatus === 'PROFILE_NAME_PENDING' || 
    rawStatus === 'incomplete'
  ) {
    regStatus = 'incomplete';
  }

  return {
    id: row.id,
    name: row.name || '',
    phone: row.phone || '',
    email: row.email || '',
    passwordHash: row.password_hash || '',
    avatar: row.avatar || '',
    role: row.role || 'customer',
    status: row.status || 'active',
    createdDate: row.created_date || '',
    lastLogin: row.last_login || '',
    deviceInfo: row.device_info || '',
    registrationStatus: regStatus,
    notificationPrefs: typeof row.notification_prefs === 'string'
      ? row.notification_prefs
      : JSON.stringify(row.notification_prefs || {})
  };
}

Deno.serve(async (req) => {
  // Handle CORS OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('[Edge Function] Received demo authentication request');

  try {
    let phone: string;
    let otp: string;

    try {
      const body = await req.json();
      phone = body.phone;
      otp = body.otp;
    } catch (e) {
      return errorResponse('PARSE_ERROR', 'Malformed request payload', 400);
    }

    if (!phone || !otp) {
      return errorResponse('INVALID_PARAMS', 'Phone and OTP are required', 400);
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    console.log(`[Edge Function] Phone: ${normalizedPhone}, OTP: ${otp}`);

    // Whitelist check
    let demoUserId = '';
    let demoEmail = '';
    let demoPassword = '';

    if (normalizedPhone === '911234567891' && otp === '123456') {
      demoUserId = 'u-testclient';
      demoEmail = 'client@demo.virla.in';
      demoPassword = 'VirlaClient@123';
    } else if (normalizedPhone === '919999999999' && otp === '123456') {
      demoUserId = 'demo.trainer';
      demoEmail = 'trainer@demo.virla.in';
      demoPassword = 'VirlaTrainer@123';
    } else {
      return errorResponse('UNAUTHORIZED', 'Invalid phone number or OTP code', 401);
    }

    const supabaseUrl = getEffectiveSupabaseUrl();
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return errorResponse('CONFIG_ERROR', 'Server database keys missing.', 500);
    }

    // privileged client for checking/creating auth accounts and querying public tables
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // standard client for native GoTrue authentication to obtain correct JWT signature
    const supabaseStandard = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const demoUUID = demoUserId === 'demo.trainer' 
      ? 'd3b07384-d113-4ec5-a5d7-be7c21e6be7c' 
      : 'a8e0f9b6-7c0b-4680-8df3-1c887d188fdc';

    console.log(`[Edge Function] Ensuring GoTrue user exists for UUID ${demoUUID}`);
    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      id: demoUUID,
      email: demoEmail,
      password: demoPassword,
      email_confirm: true
    });

    if (createError) {
      if (createError.message.includes('already exists') || createError.message.includes('already registered')) {
        console.log('[Edge Function] GoTrue user already exists.');
      } else {
        console.warn('[Edge Function] Warning creating user:', createError.message);
      }
    } else {
      console.log('[Edge Function] GoTrue user created successfully.');
    }

    // Programmatically authenticate using GoTrue standard flow
    console.log(`[Edge Function] Authenticating ${demoEmail} against GoTrue`);
    const { data: authSession, error: loginError } = await supabaseStandard.auth.signInWithPassword({
      email: demoEmail,
      password: demoPassword
    });

    if (loginError || !authSession || !authSession.session) {
      return errorResponse('AUTH_LOGIN_FAILED', 'GoTrue sign-in failed: ' + (loginError?.message || 'No session returned'), 401);
    }
    console.log('[Edge Function] GoTrue authentication succeeded.');

    // Fetch matching row from public.users
    const { data: publicUsers, error: findError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', demoUserId);

    if (findError || !publicUsers || publicUsers.length === 0) {
      return errorResponse('PUBLIC_USER_NOT_FOUND', 'Corresponding public user record not found', 404);
    }

    const publicUser = publicUsers[0];
    const mappedUser = mapPostgresToDBUser(publicUser);

    return new Response(JSON.stringify({
      success: true,
      user: mappedUser,
      session: {
        accessToken: authSession.session.access_token,
        refreshToken: authSession.session.refresh_token
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    return errorResponse('UNHANDLED_EXCEPTION', err.message || 'Internal server error', 500);
  }
});
