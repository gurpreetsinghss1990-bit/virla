import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { setClientDeviceToken, supabase } from '../database/supabaseClient';

const DEVICE_ID_KEY = 'virla.device.id';
const DEVICE_TOKEN_KEY = 'virla.device.token';

export type ClaimResult = {
  ok: boolean;
  reason?: 'active_elsewhere' | 'invalid_request' | 'unknown_user' | 'network' | string;
  deviceName?: string | null;
  loggedInAt?: string | null;
  lastSeenAt?: string | null;
};

let deviceIdCache: string | null = null;
let deviceTokenCache: string | null = null;
let claimInFlight: Promise<ClaimResult> | null = null;

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
export function claimDeviceSession(userId: string): Promise<ClaimResult> {
  if (claimInFlight) return claimInFlight;

  claimInFlight = (async (): Promise<ClaimResult> => {
    try {
      const [deviceId, token] = await Promise.all([getDeviceId(), getDeviceToken()]);
      setClientDeviceToken(token);

      const { data, error } = await supabase.rpc('claim_device', {
        p_user_id: userId,
        p_device_id: deviceId,
        p_device_name: getDeviceName(),
        p_token: token,
      });

      if (error) {
        return { ok: false, reason: 'network' };
      }

      const row: any = data || {};
      if (row.ok === false) {
        return {
          ok: false,
          reason: row.reason || 'active_elsewhere',
          deviceName: row.device_name ?? null,
          loggedInAt: row.logged_in_at ?? null,
          lastSeenAt: row.last_seen_at ?? null,
        };
      }
      return { ok: true };
    } catch {
      return { ok: false, reason: 'network' };
    } finally {
      claimInFlight = null;
    }
  })();

  return claimInFlight;
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
    return { ok: row.ok === true, revoked: row.revoked === true, deviceName: row.device_name ?? null };
  } catch {
    return { ok: false, revoked: false };
  }
}

export async function releaseDeviceSession(userId: string | null): Promise<void> {
  if (!userId) return;
  try {
    const token = await getDeviceToken();
    await supabase.rpc('release_device', { p_user_id: userId, p_token: token });
  } catch {
    // Logout must never be blocked by the network
  } finally {
    deviceTokenCache = null;
    setClientDeviceToken(null);
    try {
      await SecureStore.deleteItemAsync(DEVICE_TOKEN_KEY);
    } catch {
      // ignore
    }
  }
}
