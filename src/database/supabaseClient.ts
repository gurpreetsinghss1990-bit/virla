import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ferowbqvgsbbovnwqkae.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qAKxXPFGSpMxz-7jZyHm0A_dIJfpVll';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
