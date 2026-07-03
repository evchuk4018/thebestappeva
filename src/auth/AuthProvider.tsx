import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { registerApiAuthBridge } from '../lib/api-auth';
import { getSupabaseBrowserClient } from '../lib/supabase-client';
import { confirmOwnerSession } from './auth-api';
import { createAuthController, type AuthSnapshot } from './auth-controller';

interface AuthContextValue extends AuthSnapshot {
  getAccessToken: () => Promise<string | null>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const controller = useMemo(() => createAuthController({
    client: getSupabaseBrowserClient(),
    confirmOwnerSession,
  }), []);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);

  useEffect(() => {
    registerApiAuthBridge({
      getAccessToken: controller.getAccessToken,
      refreshAccessToken: controller.refreshAccessToken,
      onAuthFailure: controller.handleInvalidSession,
    });
    void controller.start();

    return () => {
      registerApiAuthBridge(null);
      controller.destroy();
    };
  }, [controller]);

  const value = useMemo<AuthContextValue>(() => ({
    ...snapshot,
    getAccessToken: controller.getAccessToken,
    login: controller.login,
    logout: controller.logout,
  }), [controller, snapshot]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider.');
  }

  return value;
}
