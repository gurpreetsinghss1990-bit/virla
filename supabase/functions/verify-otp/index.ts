import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(payloadBase64);
    return JSON.parse(decoded);
  } catch (e) {
    return null;
  }
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

function mapPostgresToDBUser(row: any) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email || '',
    passwordHash: row.password_hash || '',
    avatar: row.avatar || '',
    role: row.role || 'customer',
    status: row.status || 'active',
    createdDate: row.created_date || '',
    lastLogin: row.last_login || '',
    deviceInfo: row.device_info || '',
    notificationPrefs: typeof row.notification_prefs === 'string'
      ? row.notification_prefs
      : JSON.stringify(row.notification_prefs || {})
  };
}

/**
 * Standardized error response helper to return structured JSON errors
 */
function errorResponse(stage: string, message: string, status = 400, extra = {}) {
  console.error(`[Edge Function] Error at ${stage}: ${message}`);
  return new Response(JSON.stringify({
    success: false,
    stage,
    message,
    ...extra
  }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

/**
 * Safely prints the structure, types, and lengths of an object's properties
 * without outputting actual sensitive values in cleartext.
 */
function safeLogStructure(obj: any, prefix = '') {
  if (obj === null || obj === undefined) {
    console.log(`${prefix} is null/undefined`);
    return;
  }
  if (typeof obj !== 'object') {
    let displayVal = typeof obj;
    if (typeof obj === 'string') {
      displayVal = `string (length: ${obj.length})`;
    }
    console.log(`${prefix} is ${displayVal}`);
    return;
  }
  
  const keys = Object.keys(obj);
  console.log(`${prefix} keys: [${keys.join(', ')}]`);
  for (const key of keys) {
    const val = obj[key];
    if (val && typeof val === 'object') {
      safeLogStructure(val, `${prefix}.${key}`);
    } else {
      let typeStr = typeof val;
      if (typeof val === 'string') {
        typeStr = `string (length: ${val.length})`;
      }
      console.log(`${prefix}.${key} type: ${typeStr}`);
    }
  }
}

/**
 * Maps a nested object recursively to replace string values with lengths
 * and primitives with types for safe API transmission on verification failure.
 */
function safeRepresent(obj: any): any {
  if (!obj) return obj;
  if (typeof obj !== 'object') {
    if (typeof obj === 'string') {
      return `string(len:${obj.length})`;
    }
    return typeof obj;
  }
  const res: any = Array.isArray(obj) ? [] : {};
  for (const k of Object.keys(obj)) {
    const val = obj[k];
    if (val && typeof val === 'object') {
      if (Array.isArray(obj)) {
        (res as any).push(safeRepresent(val));
      } else {
        res[k] = safeRepresent(val);
      }
    } else {
      if (Array.isArray(obj)) {
        (res as any).push(typeof val === 'string' ? `string(len:${val.length})` : typeof val);
      } else {
        res[k] = typeof val === 'string' ? `string(len:${val.length})` : typeof val;
      }
    }
  }
  return res;
}

Deno.serve(async (req) => {
  // Handle CORS OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('[Edge Function] Stage A: Received request');

  try {
    let accessToken: string;
    try {
      const body = await req.json();
      accessToken = body.accessToken;
    } catch (e) {
      return errorResponse('STAGE_A_PARSE', 'Malformed request payload', 400);
    }

    if (!accessToken) {
      return errorResponse('STAGE_B', 'Access token is required', 400);
    }
    console.log('[Edge Function] Stage B: accessToken exists (length: ' + accessToken.length + ')');

    const authKey = Deno.env.get('MSG91_LOGINOTP_AUTHKEY')
    if (!authKey) {
      return errorResponse('STAGE_C_CONFIG', 'Server configuration error. Auth key not set.', 500);
    }
    console.log('[Edge Function] MSG91_LOGINOTP_AUTHKEY configuration detected (length: ' + authKey.length + ')');

    console.log('[Edge Function] Stage C: Sending request to MSG91 verifyAccessToken...');
    const response = await fetch('https://api.msg91.com/api/v5/widget/verifyAccessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': authKey
      },
      body: JSON.stringify({
        'access-token': accessToken
      })
    })

    console.log('[Edge Function] Stage D: MSG91 verification HTTP status: ' + response.status);

    const result = await response.json()
    const isSuccess = result.status === 'success' || result.type === 'success' || result.message === 'Token verified successfully';
    console.log('[Edge Function] Stage E: MSG91 verification response result: ' + (isSuccess ? 'SUCCESS' : 'FAILURE') + ' | Msg: ' + (result.message || 'no-message'));

    // Safe diagnostics of the keys & structure returned by MSG91
    console.log('[Edge Function] Log Structure of verifyAccessToken Response:');
    safeLogStructure(result, 'result');

    // Corrected error check condition to trigger on either invalid response OR non-success code
    if (!isSuccess || !response.ok) {
      return errorResponse('STAGE_D_E', 'MSG91 verification failed: ' + (result.message || 'Unknown token or credentials'), 400);
    }

    // Explicit deterministic search for verified identifier properties in MSG91 response
    // MSG91 returns the phone number directly inside 'message' when verification succeeds.
    let mobile = null;
    if (isSuccess && typeof result.message === 'string' && /^\+?\d+$/.test(result.message.trim())) {
      mobile = result.message.trim();
      console.log('[Edge Function] Identifier extracted from result.message directly');
    } else {
      mobile =
        typeof result?.data?.identifier === 'string'
          ? result.data.identifier
          : typeof result?.data?.mobile === 'string'
            ? result.data.mobile
            : typeof result?.data?.phone === 'string'
              ? result.data.phone
              : null;
    }

    // Fallback: decode JWT payload server-side
    const decoded = decodeJwtPayload(accessToken);
    if (!mobile && decoded) {
      console.log('[Edge Function] Fallback: Searching inside JWT payload claims...');
      console.log('[Edge Function] Log Structure of Decoded JWT Payload:');
      safeLogStructure(decoded, 'jwtPayload');
      
      if (typeof decoded.sub === 'string') {
        mobile = decoded.sub;
      }
    }

    // If both explicit checks fail, return structured failure JSON containing diagnostics
    if (!mobile) {
      console.error('[Edge Function] Stage F Error: Could not extract mobile number');
      return errorResponse('IDENTITY_EXTRACTION', 'Could not resolve verified identifier from MSG91 response', 400, {
        diagnostics: {
          result: safeRepresent(result),
          jwtPayload: decoded ? safeRepresent(decoded) : null
        }
      });
    }

    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(mobile)
    console.log('[Edge Function] Stage F: Verified phone number extracted and normalized (suffix: ...' + normalizedPhone.slice(-4) + ')');

    // Create Supabase client using built-in env variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Find existing user
    const { data: users, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('phone', normalizedPhone)

    if (findError) {
      return errorResponse('STAGE_G', 'Database search failed: ' + findError.message, 500);
    }
    console.log('[Edge Function] Stage G: Supabase users query succeeded');

    let user = users && users.length > 0 ? users[0] : null

    if (user) {
      console.log('[Edge Function] Stage H: Existing user found (suffix: ...' + user.id.slice(-4) + ')');
      // Log the user in: update last_login
      const lastLogin = new Date().toISOString()
      const { error: updateError } = await supabase
        .from('users')
        .update({ last_login: lastLogin })
        .eq('id', user.id)

      if (updateError) {
        console.error('[Edge Function] Stage H Error: Failed to update last_login: ' + updateError.message);
      } else {
        user.last_login = lastLogin
        console.log('[Edge Function] Stage H: Existing user last_login updated');
      }

      console.log('[Edge Function] Stage J: Returning final success response for existing user');
      return new Response(JSON.stringify({ success: true, user: mapPostgresToDBUser(user), isNewUser: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } else {
      console.log('[Edge Function] Stage H: User not found. Starting new user registration...');
      // Create new user and profile
      const userId = 'u-' + Math.random().toString(36).substring(2, 11)
      const profileId = 'prof-' + Math.random().toString(36).substring(2, 11)

      const newUser = {
        id: userId,
        name: 'User ' + normalizedPhone.slice(-4),
        phone: normalizedPhone,
        email: '',
        password_hash: '',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        role: 'customer',
        status: 'active',
        created_date: new Date().toLocaleDateString(),
        last_login: new Date().toISOString(),
        device_info: 'Mobile OTP',
        notification_prefs: {
          bookingUpdates: true,
          trainerMessages: true,
          offers: false,
          membershipAlerts: true,
          workoutReminders: true,
          progressReports: true,
          promotions: false,
          emailNotifications: true,
          smsNotifications: true,
          pushNotifications: true
        }
      }

      const newProfile = {
        id: profileId,
        user_id: userId,
        age: 0,
        gender: '',
        height: '',
        weight: '',
        fitness_goal: '',
        preferred_workout: '',
        emergency_contact: {},
        medical_notes: '',
        membership_status: 'Standard',
        credits_balance: 0,
        trainer_preference: '',
        dob: '',
        fitness_level: '',
        preferred_language: 'English',
        city: '',
        member_since: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        selected_goals: []
      }

      console.log('[Edge Function] Stage I: Calling create_user_with_profile RPC...');
      const { error: signupError } = await supabase.rpc('create_user_with_profile', {
        user_row: newUser,
        profile_row: newProfile
      })

      if (signupError) {
        return errorResponse('STAGE_I', 'Database profile creation failed: ' + signupError.message, 500);
      }
      console.log('[Edge Function] Stage I: RPC create_user_with_profile succeeded');

      console.log('[Edge Function] Stage J: Returning final success response for new user');
      return new Response(JSON.stringify({ success: true, user: mapPostgresToDBUser(newUser), isNewUser: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  } catch (err: any) {
    return errorResponse('STAGE_UNHANDLED', err.message || 'Internal server error', 500);
  }
})
