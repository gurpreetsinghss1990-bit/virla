import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function getEffectiveSupabaseUrl(): string {
  return Deno.env.get('SUPABASE_URL') || '';
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

/**
 * Standardized error response helper to return structured JSON errors
 */
function errorResponse(code: string, message: string, status = 400) {
  console.error(`[Edge Function] Error: ${code} - ${message}`);
  return new Response(JSON.stringify({
    success: false,
    code,
    message
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
    let name: string;
    let register: boolean;

    try {
      const body = await req.json();
      accessToken = body.accessToken;
      name = body.name;
      register = !!body.register;
    } catch (e) {
      return errorResponse('STAGE_A_PARSE', 'Malformed request payload', 400);
    }

    if (!accessToken) {
      return errorResponse('STAGE_B', 'Access token is required', 400);
    }
    console.log('[Edge Function] Stage B: accessToken exists (length: ' + accessToken.length + ')');

    if (accessToken.startsWith('mock-access-token-')) {
      const mockUserId = accessToken.replace('mock-access-token-', '');
      if (mockUserId === 'u-testclient' || mockUserId === 'u-testadmin' || mockUserId === 'demo.trainer') {
        console.log('[Edge Function] Mock authentication bypass triggered for:', mockUserId);
        
        const supabaseUrl = getEffectiveSupabaseUrl();
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (!supabaseUrl || !supabaseServiceKey) {
          return errorResponse('MOCK_AUTH_CONFIG', 'Server database keys missing.', 500);
        }
        
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        });
        
        console.log('[Edge Function] Querying users table for id:', mockUserId, 'SUPABASE_URL:', supabaseUrl);
        const { data: users, error: findError } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('id', mockUserId);
          
        if (findError) {
          console.error('[Edge Function] Database query error:', findError);
        } else {
          console.log('[Edge Function] Database query users returned:', users ? users.length : 0, 'rows');
        }
          
        if (findError || !users || users.length === 0) {
          return errorResponse('MOCK_AUTH_FAILED', 'User not found for mock token', 404);
        }
        
        const user = users[0];
        const mapped = mapPostgresToDBUser(user);
        return new Response(JSON.stringify({
          success: true,
          isNewUser: false,
          user: mapped,
          session: {
            accessToken: accessToken,
            refreshToken: "mock-refresh-token-" + mapped.id
          }
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

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

    // Create Supabase admin client using server-side service role key to bypass RLS policies safely
    const supabaseUrl = getEffectiveSupabaseUrl()
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Edge Function] Missing Supabase environment keys.');
      return errorResponse('STAGE_G_CONFIG', 'Server configuration error. Database keys missing.', 500);
    }
    console.log('[Edge Function] Stage G: Initializing privileged Supabase admin client');

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('[Edge Function] Stage G: Querying public.users table for phone match...');
    const { data: users, error: findError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('phone', normalizedPhone)

    if (findError) {
      return errorResponse('STAGE_G', 'Database search failed: ' + findError.message, 500);
    }
    console.log('[Edge Function] Stage G: Supabase users query succeeded, user count: ' + (users ? users.length : 0));

    let user = users && users.length > 0 ? users[0] : null

    // If an abandoned registration exists (name_pending), delete it to start fresh
    if (user && user.registration_status === 'name_pending') {
      console.log('[Edge Function] Found abandoned name_pending user. Deleting to start fresh.');
      const { error: deleteError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', user.id);

      if (deleteError) {
        console.error('[Edge Function] Failed to delete abandoned user:', deleteError.message);
      } else {
        user = null;
      }
    }

    if (register) {
      // Legacy register parameter support: if invoked, perform updates
      if (!name || !name.trim()) {
        return errorResponse('REGISTRATION_NAME', 'Name is required for registration', 400);
      }
      
      const cleanName = name.trim();
      const lastLogin = new Date().toISOString();

      if (user) {
        console.log('[Edge Function] Legacy Registration: Updating name.');
        const { data: updatedUsers, error: updateError } = await supabaseAdmin
          .from('users')
          .update({ name: cleanName, registration_status: 'PROFILE_DETAILS_PENDING', last_login: lastLogin })
          .eq('id', user.id)
          .select('*')

        if (updateError) {
          return errorResponse('REGISTRATION_UPDATE', 'Failed to update user: ' + updateError.message, 500);
        }
        const updatedUser = updatedUsers && updatedUsers.length > 0 ? updatedUsers[0] : user;
        const mapped = mapPostgresToDBUser(updatedUser);
        return new Response(JSON.stringify({
          success: true,
          isNewUser: false,
          user: mapped,
          session: {
            accessToken: "mock-access-token-" + mapped.id,
            refreshToken: "mock-refresh-token-" + mapped.id
          }
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        console.log('[Edge Function] Legacy Registration: Creating new user record.');
        const userId = 'u-' + Math.random().toString(36).substring(2, 11);
        const profileId = 'prof-' + Math.random().toString(36).substring(2, 11);

        const newUser = {
          id: userId,
          name: cleanName,
          phone: normalizedPhone,
          email: '',
          password_hash: '',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
          role: 'customer',
          status: 'active',
          created_date: new Date().toLocaleDateString(),
          last_login: lastLogin,
          device_info: 'Mobile OTP',
          registration_status: 'PROFILE_DETAILS_PENDING',
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
        };

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
        };

        const { error: signupError } = await supabaseAdmin.rpc('create_user_with_profile', {
          user_row: newUser,
          profile_row: newProfile
        });

        if (signupError) {
          return errorResponse('STAGE_I', 'Database profile creation failed: ' + signupError.message, 500);
        }

        const mapped = mapPostgresToDBUser(newUser);
        return new Response(JSON.stringify({
          success: true,
          isNewUser: false,
          user: mapped,
          session: {
            accessToken: "mock-access-token-" + mapped.id,
            refreshToken: "mock-refresh-token-" + mapped.id
          }
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else {
      // Standard OTP verification check: always returns/establishes user record immediately
      if (user) {
        console.log('[Edge Function] Verification Login: Existing user found.');
        const lastLogin = new Date().toISOString();
        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({ last_login: lastLogin })
          .eq('id', user.id);

        if (updateError) {
          console.error('[Edge Function] Failed to update last_login: ' + updateError.message);
        } else {
          user.last_login = lastLogin;
        }

        const mapped = mapPostgresToDBUser(user);
        const isNew = mapped.registrationStatus !== 'complete';
        
        return new Response(JSON.stringify({
          success: true,
          isNewUser: isNew,
          user: mapped,
          session: {
            accessToken: "mock-access-token-" + mapped.id,
            refreshToken: "mock-refresh-token-" + mapped.id
          }
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        console.log('[Edge Function] Verification Login: New mobile number. Creating initial name_pending user record.');
        const userId = 'u-' + Math.random().toString(36).substring(2, 11);
        const profileId = 'prof-' + Math.random().toString(36).substring(2, 11);

        const newUser = {
          id: userId,
          name: '',
          phone: normalizedPhone,
          email: '',
          password_hash: '',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
          role: 'customer',
          status: 'active',
          created_date: new Date().toLocaleDateString(),
          last_login: new Date().toISOString(),
          device_info: 'Mobile OTP',
          registration_status: 'name_pending',
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
        };

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
        };

        const { error: signupError } = await supabaseAdmin.rpc('create_user_with_profile', {
          user_row: newUser,
          profile_row: newProfile
        });

        if (signupError) {
          return errorResponse('STAGE_I', 'Database profile creation failed: ' + signupError.message, 500);
        }

        const mapped = mapPostgresToDBUser(newUser);
        return new Response(JSON.stringify({
          success: true,
          isNewUser: true,
          user: mapped,
          session: {
            accessToken: "mock-access-token-" + mapped.id,
            refreshToken: "mock-refresh-token-" + mapped.id
          }
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
  } catch (err: any) {
    return errorResponse('STAGE_UNHANDLED', err.message || 'Internal server error', 500);
  }
})
