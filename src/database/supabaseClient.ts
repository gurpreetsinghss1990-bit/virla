import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ferowbqvgsbbovnwqkae.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qAKxXPFGSpMxz-7jZyHm0A_dIJfpVll';

let clientUserId: string | null = null;

export function setClientUserId(userId: string | null) {
  clientUserId = userId;
  console.log(`[Supabase Client] Set x-user-id header cache: ${userId}`);
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
      return fetch(url, { ...options, headers });
    }
  }
});
