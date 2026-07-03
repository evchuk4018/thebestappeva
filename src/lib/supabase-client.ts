import { createClient, type SupabaseClient } from '@supabase/supabase-js';

interface SupabaseEnv {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
}

function readSupabaseEnv(): SupabaseEnv {
  const env = (import.meta as ImportMeta & { env?: Record<string, unknown> }).env;
  const url = typeof env?.VITE_SUPABASE_URL === 'string' ? env.VITE_SUPABASE_URL.trim() : '';
  const anonKey = typeof env?.VITE_SUPABASE_ANON_KEY === 'string' ? env.VITE_SUPABASE_ANON_KEY.trim() : '';
  if (!url || !anonKey) {
    throw new Error('Supabase browser authentication is not configured.');
  }

  return {
    VITE_SUPABASE_URL: url,
    VITE_SUPABASE_ANON_KEY: anonKey,
  };
}

let browserSupabaseClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  if (browserSupabaseClient) {
    return browserSupabaseClient;
  }

  const env = readSupabaseEnv();
  browserSupabaseClient = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return browserSupabaseClient;
}
