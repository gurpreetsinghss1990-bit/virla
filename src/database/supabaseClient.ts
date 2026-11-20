import { createClient } from '@supabase/supabase-js';

const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

const SUPABASE_URL = 
  process.env.EXPO_PUBLIC_SUPABASE_URL || 
  (isDev ? 'http://127.0.0.1:54321' : 'https://ferowbqvgsbbovnwqkae.supabase.co');

const SUPABASE_ANON_KEY = 
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
  (isDev 
    ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' 
    : 'sb_publishable_qAKxXPFGSpMxz-7jZyHm0A_dIJfpVll');

let clientUserId: string | null = null;
let clientDeviceToken: string | null = null;
let clientSessionToken: string | null = null;

export function setClientUserId(userId: string | null) {
  if (clientUserId === userId) return;
  clientUserId = userId;
  console.log(`[Supabase Client] Set x-user-id header cache: ${userId}`);
}

export function setClientDeviceToken(token: string | null) {
  clientDeviceToken = token;
}

export function setClientSessionToken(token: string | null) {
  clientSessionToken = token;
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    fetch: async (url, options = {}) => {
      const headers = options.headers instanceof Headers
        ? new Headers(options.headers)
        : { ...(options.headers || {}) } as any;

      if (clientUserId) {
        if (headers instanceof Headers) {
          headers.set('x-user-id', clientUserId);
        } else {
          headers['x-user-id'] = clientUserId;
        }
      }

      if (clientSessionToken) {
        if (headers instanceof Headers) {
          headers.set('x-session-token', clientSessionToken);
        } else {
          headers['x-session-token'] = clientSessionToken;
        }
      }

      if (clientDeviceToken) {
        if (headers instanceof Headers) {
          headers.set('x-device-token', clientDeviceToken);
        } else {
          headers['x-device-token'] = clientDeviceToken;
        }
      }
      return fetch(url, { ...options, headers });
    }
  }
});
