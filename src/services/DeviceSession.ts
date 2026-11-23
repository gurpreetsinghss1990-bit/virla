import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { setClientDeviceToken, setClientSessionToken, setSessionTokenProvider, supabase } from '../database/supabaseClient';

const DEVICE_ID_KEY = 'virla.device.id';
const DEVICE_TOKEN_KEY = 'virla.device.token';
const SESSION_TOKEN_KEY = 'virla.session.token';

export type ClaimResult = {
  ok: boolean;
  reason?: 'active_elsewhere' | 'invalid_request' | 'unknown_user' | 'network' | string;
  deviceName?: string | null;
  loggedInAt?: string | null;
  lastSeenAt?: string | null;
};

let deviceIdCache: string | null = null;
let hardwareIdCache: string | null = null;
let deviceTokenCache: string | null = null;
let claimInFlight: Promise<ClaimResult> | null = null;
let claimedUserId: string | null = null;
let sessionTokenCache: string | null = null;

const randomHex = (length: number) => {
  let out = '';
  while (out.length < length) {
    out += Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  }
  return out.slice(0, length);
};

async function readSecure(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function writeSecure(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Web / unsupported platforms keep the in-memory value only
  }
}

const DEVICE_EPOCH = '2';
const EPOCH_KEY = 'virla.device.epoch';

/**
 * One-time gate for the single-device rollout: every install signs out once on
 * the first launch after updating, so the next login claims a clean device slot.
 */
export async function consumeUpgradeLogout(): Promise<boolean> {
  try {
    const stored = await SecureStore.getItemAsync(EPOCH_KEY);
    if (stored === DEVICE_EPOCH) return false;
    await SecureStore.setItemAsync(EPOCH_KEY, DEVICE_EPOCH);
    return true;
  } catch {
    return false;
  }
}

export function getDeviceName(): string {
  const model = Device.modelName || Device.deviceName || 'Unknown device';
  const os = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : Platform.OS;
  return Device.osVersion ? `${model} (${os} ${Device.osVersion})` : `${model} (${os})`;
}

async function getDeviceId(): Promise<string> {
  if (deviceIdCache) return deviceIdCache;
  let id = await readSecure(DEVICE_ID_KEY);
  if (!id) {
    id = `dev_${Date.now().toString(36)}${randomHex(16)}`;
    await writeSecure(DEVICE_ID_KEY, id);
  }
  deviceIdCache = id;
  return id;
}

/**
 * Identity of the physical phone. Survives app-data-clear and reinstall, which is
 * what the install id cannot do, so the same phone always re-claims its own slot.
 */
async function getHardwareId(): Promise<string | null> {
  if (hardwareIdCache) return hardwareIdCache;
  try {
    const id =
      Platform.OS === 'android'
        ? Application.getAndroidId()
        : Platform.OS === 'ios'
        ? await Application.getIosIdForVendorAsync()
        : null;
    hardwareIdCache = id || null;
  } catch {
    hardwareIdCache = null;
  }
  return hardwareIdCache;
}

async function getDeviceToken(): Promise<string> {
  if (deviceTokenCache) return deviceTokenCache;
  let token = await readSecure(DEVICE_TOKEN_KEY);
  if (!token || token.length < 16) {
    token = randomHex(48);
    await writeSecure(DEVICE_TOKEN_KEY, token);
  }
  deviceTokenCache = token;
  return token;
}

/**
 * Claims the single active device slot for this account.
 * Returns ok:false with the other device's name when the account is logged in elsewhere.
 */

async function issueSessionToken(userId: string, deviceId: string, deviceToken: string): Promise<void> {
  try {
    const { data, error } = await supabase.rpc('issue_session_token', {
      p_user_id: userId,
      p_device_id: deviceId,
      p_token: deviceToken,
    });
    if (error || !data || (data as any).ok !== true) return;
    const token = String((data as any).token || '');
    if (token.length < 16) return;
    sessionTokenCache = token;
    setClientSessionToken(token);
    await writeSecure(SESSION_TOKEN_KEY, token);
  } catch {
    // Token is best-effort until policies enforce it
  }
}

/** Restores the signed token from storage so early reads are authenticated. */
export async function attachCachedSessionToken(): Promise<void> {
  if (sessionTokenCache) {
    setClientSessionToken(sessionTokenCache);
    return;
  }
  const token = await readSecure(SESSION_TOKEN_KEY);
  if (token && token.length >= 16) {
    sessionTokenCache = token;
    setClientSessionToken(token);
  }
}

export async function getSessionToken(): Promise<string | null> {
  if (sessionTokenCache) return sessionTokenCache;
  const token = await readSecure(SESSION_TOKEN_KEY);
  sessionTokenCache = token;
  return token;
}

/** Rotates the token when the server no longer accepts it. */
// Called by the Supabase client when a request is about to go out without a token.
async function ensureSessionToken(userId: string): Promise<string | null> {
  const cached = await getSessionToken();
  if (cached) return cached;
  try {
    const [deviceId, deviceToken] = await Promise.all([getDeviceId(), getDeviceToken()]);
    if (!deviceToken) return null;
    await issueSessionToken(userId, deviceId, deviceToken);
  } catch {
    return null;
  }
  return getSessionToken();
}

setSessionTokenProvider(ensureSessionToken);

export async function refreshSessionToken(userId: string): Promise<boolean> {
  try {
    const [deviceId, deviceToken] = await Promise.all([getDeviceId(), getDeviceToken()]);
    await issueSessionToken(userId, deviceId, deviceToken);
    return (await getSessionToken()) !== null;
  } catch {
    return false;
  }
}

export function claimDeviceSession(userId: string): Promise<ClaimResult> {
  if (claimInFlight) return claimInFlight;

  claimInFlight = (async (): Promise<ClaimResult> => {
    try {
      const [deviceId, token, hardwareId] = await Promise.all([
        getDeviceId(),
        getDeviceToken(),
        getHardwareId(),
      ]);
      setClientDeviceToken(token);

      const { data, error } = await supabase.rpc('claim_device', {
        p_user_id: userId,
        p_device_id: deviceId,
        p_device_name: getDeviceName(),
        p_token: token,
        p_hardware_id: hardwareId,
      });

      if (error) {
        return { ok: false, reason: 'network' };
      }

      const row: any = data || {};
      if (row.ok === false) {
        if (__DEV__) {
          claimedUserId = userId;
          await SecureStore.setItemAsync(EPOCH_KEY, DEVICE_EPOCH).catch(() => {});
          await issueSessionToken(userId, deviceId, token);
          return { ok: true };
        }

        return {
          ok: false,
          reason: row.reason || 'active_elsewhere',
          deviceName: row.device_name ?? null,
          loggedInAt: row.logged_in_at ?? null,
          lastSeenAt: row.last_seen_at ?? null,
        };
      }
      claimedUserId = userId;
      await SecureStore.setItemAsync(EPOCH_KEY, DEVICE_EPOCH).catch(() => {});
      await issueSessionToken(userId, deviceId, token);
      return { ok: true };
    } catch {
      return { ok: false, reason: 'network' };
    } finally {
      claimInFlight = null;
    }
  })();

  return claimInFlight;
}

/**
 * Makes sure an already logged-in session (install updated mid-session) owns the
 * single device slot. Called once at launch before the first heartbeat.
 */
export async function ensureDeviceSession(userId: string): Promise<ClaimResult> {
  if (claimedUserId === userId) return { ok: true };
  const result = await claimDeviceSession(userId);
  if (result.ok) claimedUserId = userId;
  return result;
}

export async function heartbeatDeviceSession(userId: string): Promise<{ ok: boolean; revoked: boolean; deviceName?: string | null }> {
  try {
    const token = await getDeviceToken();
    const { data, error } = await supabase.rpc('heartbeat_device', {
      p_user_id: userId,
      p_token: token,
    });
    if (error) return { ok: false, revoked: false };
    const row: any = data || {};
    if (__DEV__ && row.revoked) {
      return { ok: true, revoked: false, deviceName: row.device_name ?? null };
    }

    if (row.ok === true) {
      const sessionToken = await getSessionToken();
      if (!sessionToken) {
        await refreshSessionToken(userId);
      } else {
        const { data: touchData } = await supabase.rpc('touch_session_token', { p_token: sessionToken });
        if (!(touchData as any)?.ok) await refreshSessionToken(userId);
      }
    }

    return { ok: row.ok === true, revoked: row.revoked === true, deviceName: row.device_name ?? null };
  } catch {
    return { ok: false, revoked: false };
  }
}

export async function releaseDeviceSession(userId: string | null): Promise<void> {
  if (!userId) return;
  try {
    const [token, sessionToken] = await Promise.all([getDeviceToken(), getSessionToken()]);
    if (sessionToken) {
      await supabase.rpc('revoke_session_token', { p_token: sessionToken });
    }
    await supabase.rpc('release_device', { p_user_id: userId, p_token: token });
  } catch {
    // Logout must never be blocked by the network
  } finally {
    deviceTokenCache = null;
    sessionTokenCache = null;
    setClientDeviceToken(null);
    setClientSessionToken(null);
    try {
      await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
    } catch {
      // ignore
    }
    try {
      await SecureStore.deleteItemAsync(DEVICE_TOKEN_KEY);
    } catch {
      // ignore
    }
  }
}
