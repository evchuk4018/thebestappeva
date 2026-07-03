import { createClient } from '@supabase/supabase-js';
import { readServerAuthConfig, type ServerAuthConfig } from './config';

export interface AuthenticatedTokenUser {
  email: string | null;
  userId: string;
}

export interface AccessTokenValidator {
  getUser(accessToken: string): Promise<AuthenticatedTokenUser | null>;
}

export function createSupabaseTokenValidator(config: ServerAuthConfig = readServerAuthConfig()): AccessTokenValidator {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error('Supabase authentication is not configured.');
  }

  const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return {
    async getUser(accessToken: string) {
      const { data, error } = await supabase.auth.getUser(accessToken);
      if (error || !data.user) {
        return null;
      }

      return {
        email: data.user.email?.trim() || null,
        userId: data.user.id,
      };
    },
  };
}
