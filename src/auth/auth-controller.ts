import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated';

export interface AuthSnapshot {
  status: AuthStatus;
  ownerConfirmed: boolean;
  session: Session | null;
  error: string | null;
}

interface AuthSessionResult {
  data: { session: Session | null };
  error: { message: string } | null;
}

interface AuthSubscription {
  data: { subscription: { unsubscribe(): void } };
}

export interface AuthClientLike {
  auth: {
    getSession(): Promise<AuthSessionResult>;
    signInWithPassword(credentials: { email: string; password: string }): Promise<AuthSessionResult>;
    signOut(): Promise<{ error: { message: string } | null }>;
    refreshSession(): Promise<AuthSessionResult>;
    onAuthStateChange(listener: (event: AuthChangeEvent, session: Session | null) => void): AuthSubscription;
  };
}

interface AuthControllerDependencies {
  client: AuthClientLike;
  confirmOwnerSession: (accessToken: string) => Promise<{ email: string }>;
}

interface AuthController {
  destroy(): void;
  getAccessToken(): Promise<string | null>;
  getSnapshot(): AuthSnapshot;
  handleInvalidSession(): Promise<void>;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  refreshAccessToken(): Promise<string | null>;
  start(): Promise<void>;
  subscribe(listener: () => void): () => void;
}

type BootstrapResult =
  | { kind: 'authenticated'; session: Session }
  | { kind: 'signed-out'; error: string | null };

const initialBootstrapPromises = new WeakMap<AuthClientLike, Promise<BootstrapResult>>();

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function toSignedOutSnapshot(error: string | null): AuthSnapshot {
  return {
    status: 'unauthenticated',
    ownerConfirmed: false,
    session: null,
    error,
  };
}

export function createAuthController({ client, confirmOwnerSession }: AuthControllerDependencies): AuthController {
  let destroyed = false;
  let currentSnapshot: AuthSnapshot = {
    status: 'loading',
    ownerConfirmed: false,
    session: null,
    error: null,
  };
  let suppressSignedOutEvent = false;
  const listeners = new Set<() => void>();
  const authSubscription = client.auth.onAuthStateChange((event, session) => {
    if (destroyed) {
      return;
    }

    if (event === 'SIGNED_OUT') {
      const nextError = suppressSignedOutEvent ? currentSnapshot.error : (currentSnapshot.session ? 'Your session expired. Please sign in again.' : currentSnapshot.error);
      suppressSignedOutEvent = false;
      updateSnapshot(toSignedOutSnapshot(nextError));
      return;
    }

    if (event === 'TOKEN_REFRESHED' && session && currentSnapshot.ownerConfirmed) {
      updateSnapshot({
        status: 'authenticated',
        ownerConfirmed: true,
        session,
        error: null,
      });
      return;
    }

    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session && currentSnapshot.ownerConfirmed) {
      updateSnapshot({
        status: 'authenticated',
        ownerConfirmed: true,
        session,
        error: null,
      });
    }
  });

  function emit() {
    listeners.forEach((listener) => listener());
  }

  function updateSnapshot(nextSnapshot: AuthSnapshot) {
    currentSnapshot = nextSnapshot;
    emit();
  }

  async function signOutWithSnapshot(error: string | null) {
    suppressSignedOutEvent = true;
    await client.auth.signOut().catch(() => undefined);
    updateSnapshot(toSignedOutSnapshot(error));
  }

  async function confirmSession(session: Session, forbiddenMessage: string) {
    try {
      await confirmOwnerSession(session.access_token);
      updateSnapshot({
        status: 'authenticated',
        ownerConfirmed: true,
        session,
        error: null,
      });
    } catch (error) {
      const status = error instanceof Error && 'status' in error && typeof error.status === 'number' ? error.status : null;
      if (status === 403) {
        await signOutWithSnapshot(forbiddenMessage);
        return;
      }
      if (status === 401) {
        await signOutWithSnapshot('Your session expired. Please sign in again.');
        return;
      }
      throw error;
    }
  }

  async function resolveInitialSession(): Promise<BootstrapResult> {
    const result = await client.auth.getSession();
    if (result.error) {
      throw new Error(result.error.message);
    }
    if (!result.data.session) {
      return { kind: 'signed-out', error: null };
    }

    try {
      await confirmOwnerSession(result.data.session.access_token);
      return { kind: 'authenticated', session: result.data.session };
    } catch (error) {
      const status = error instanceof Error && 'status' in error && typeof error.status === 'number' ? error.status : null;
      if (status === 403) {
        await client.auth.signOut().catch(() => undefined);
        return { kind: 'signed-out', error: 'This account is not permitted to access this app.' };
      }
      if (status === 401) {
        await client.auth.signOut().catch(() => undefined);
        return { kind: 'signed-out', error: 'Your session expired. Please sign in again.' };
      }
      throw error;
    }
  }

  return {
    destroy() {
      destroyed = true;
      authSubscription.data.subscription.unsubscribe();
      listeners.clear();
    },
    async getAccessToken() {
      if (currentSnapshot.session?.access_token) {
        return currentSnapshot.session.access_token;
      }

      const result = await client.auth.getSession();
      return result.data.session?.access_token ?? null;
    },
    getSnapshot() {
      return currentSnapshot;
    },
    async handleInvalidSession() {
      await signOutWithSnapshot('Your session expired. Please sign in again.');
    },
    async login(email: string, password: string) {
      updateSnapshot({
        status: 'loading',
        ownerConfirmed: false,
        session: null,
        error: null,
      });

      const result = await client.auth.signInWithPassword({ email, password });
      if (result.error) {
        updateSnapshot(toSignedOutSnapshot('Invalid email or password.'));
        return;
      }
      if (!result.data.session) {
        updateSnapshot(toSignedOutSnapshot('Unable to start a session.'));
        return;
      }

      updateSnapshot({
        status: 'loading',
        ownerConfirmed: false,
        session: result.data.session,
        error: null,
      });
      await confirmSession(result.data.session, 'This account is not permitted to access this app.');
    },
    async logout() {
      await signOutWithSnapshot(null);
    },
    async refreshAccessToken() {
      const result = await client.auth.refreshSession();
      if (result.error || !result.data.session) {
        return null;
      }

      if (currentSnapshot.ownerConfirmed) {
        updateSnapshot({
          status: 'authenticated',
          ownerConfirmed: true,
          session: result.data.session,
          error: null,
        });
      } else {
        updateSnapshot({
          status: 'loading',
          ownerConfirmed: false,
          session: result.data.session,
          error: null,
        });
      }

      return result.data.session.access_token;
    },
    async start() {
      let promise = initialBootstrapPromises.get(client);
      if (!promise) {
        promise = resolveInitialSession().catch((error) => ({
          kind: 'signed-out' as const,
          error: toErrorMessage(error, 'Unable to load your authentication session.'),
        })).finally(() => {
          initialBootstrapPromises.delete(client);
        });
        initialBootstrapPromises.set(client, promise);
      }

      const result = await promise;
      if (destroyed) {
        return;
      }

      if (result.kind === 'authenticated') {
        updateSnapshot({
          status: 'authenticated',
          ownerConfirmed: true,
          session: result.session,
          error: null,
        });
        return;
      }

      updateSnapshot(toSignedOutSnapshot(result.error));
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
