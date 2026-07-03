import assert from 'node:assert/strict';
import test from 'node:test';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { ApiError } from '../lib/api';
import { createAuthController, type AuthClientLike } from './auth-controller';

function createSession(email: string, accessToken = 'token-1') {
  return {
    access_token: accessToken,
    refresh_token: `${accessToken}-refresh`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: 9999999999,
    user: {
      id: `${email}-id`,
      email,
    },
  } as Session;
}

class FakeAuthClient implements AuthClientLike {
  getSessionCalls = 0;
  signInCalls: Array<{ email: string; password: string }> = [];
  signOutCalls = 0;
  session: Session | null;
  signInSession: Session | null;
  signInError: string | null = null;
  signInFailure: Error | null = null;
  getSessionWait: Promise<void> | null = null;
  refreshSessionValue: Session | null = null;
  private listener: ((event: AuthChangeEvent, session: Session | null) => void) | null = null;

  constructor(session: Session | null = null) {
    this.session = session;
    this.signInSession = session;
    this.refreshSessionValue = session;
  }

  emit(event: AuthChangeEvent, session: Session | null = this.session) {
    this.listener?.(event, session);
  }

  auth = {
    getSession: async () => {
      this.getSessionCalls += 1;
      if (this.getSessionWait) await this.getSessionWait;
      return { data: { session: this.session }, error: null };
    },
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      this.signInCalls.push({ email, password });
      if (this.signInFailure) throw this.signInFailure;
      if (this.signInError) {
        return { data: { session: null }, error: { message: this.signInError } };
      }
      this.session = this.signInSession;
      return { data: { session: this.signInSession }, error: null };
    },
    signOut: async () => {
      this.signOutCalls += 1;
      this.session = null;
      this.emit('SIGNED_OUT', null);
      return { error: null };
    },
    refreshSession: async () => {
      this.session = this.refreshSessionValue;
      return { data: { session: this.refreshSessionValue }, error: null };
    },
    onAuthStateChange: (listener: (event: AuthChangeEvent, session: Session | null) => void) => {
      this.listener = listener;
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              if (this.listener === listener) {
                this.listener = null;
              }
            },
          },
        },
      };
    },
  };
}

test('restores and confirms an existing owner session on startup', async () => {
  const client = new FakeAuthClient(createSession('owner@example.com'));
  const confirmations: string[] = [];
  const controller = createAuthController({
    client,
    confirmOwnerSession: async (accessToken) => {
      confirmations.push(accessToken);
      return { email: 'owner@example.com' };
    },
  });

  await controller.start();

  assert.deepEqual(confirmations, ['token-1']);
  assert.equal(controller.getSnapshot().status, 'authenticated');
  assert.equal(controller.getSnapshot().ownerConfirmed, true);
  controller.destroy();
});

test('leaves loading when startup owner confirmation fails unexpectedly', async () => {
  const client = new FakeAuthClient(createSession('owner@example.com'));
  const controller = createAuthController({
    client,
    confirmOwnerSession: async () => {
      throw new Error('Confirmation timed out.');
    },
  });

  await controller.start();

  assert.equal(controller.getSnapshot().status, 'unauthenticated');
  assert.equal(controller.getSnapshot().error, 'Confirmation timed out.');
  controller.destroy();
});

test('reuses the in-flight startup confirmation across controller re-creation', async () => {
  const client = new FakeAuthClient(createSession('owner@example.com'));
  let releaseConfirmation: (() => void) | null = null;
  let confirmations = 0;
  const confirmOwnerSession = async () => {
    confirmations += 1;
    await new Promise<void>((resolve) => {
      releaseConfirmation = resolve;
    });
    return { email: 'owner@example.com' };
  };

  const first = createAuthController({ client, confirmOwnerSession });
  const second = createAuthController({ client, confirmOwnerSession });
  const firstStart = first.start();
  const secondStart = second.start();
  await Promise.resolve();
  releaseConfirmation?.();
  await Promise.all([firstStart, secondStart]);

  assert.equal(confirmations, 1);
  assert.equal(first.getSnapshot().status, 'authenticated');
  assert.equal(second.getSnapshot().status, 'authenticated');
  first.destroy();
  second.destroy();
});

test('restarts after strict mode cleanup during startup', async () => {
  const client = new FakeAuthClient(null);
  let releaseGetSession: (() => void) | null = null;
  client.getSessionWait = new Promise<void>((resolve) => {
    releaseGetSession = resolve;
  });
  const controller = createAuthController({
    client,
    confirmOwnerSession: async () => ({ email: 'owner@example.com' }),
  });

  const firstStart = controller.start();
  await Promise.resolve();
  controller.destroy();
  const secondStart = controller.start();
  releaseGetSession?.();
  await Promise.all([firstStart, secondStart]);

  assert.equal(client.getSessionCalls, 1);
  assert.equal(controller.getSnapshot().status, 'unauthenticated');
  controller.destroy();
});

test('logs in the owner with email and password', async () => {
  const client = new FakeAuthClient(null);
  client.signInSession = createSession('owner@example.com', 'token-login');
  const controller = createAuthController({
    client,
    confirmOwnerSession: async () => ({ email: 'owner@example.com' }),
  });

  await controller.login('owner@example.com', 'secret');

  assert.deepEqual(client.signInCalls, [{ email: 'owner@example.com', password: 'secret' }]);
  assert.equal(controller.getSnapshot().status, 'authenticated');
  controller.destroy();
});

test('surfaces Supabase sign-in errors', async () => {
  const client = new FakeAuthClient(null);
  client.signInError = 'Email not confirmed';
  const controller = createAuthController({
    client,
    confirmOwnerSession: async () => ({ email: 'owner@example.com' }),
  });

  await controller.login('owner@example.com', 'secret');

  assert.equal(controller.getSnapshot().status, 'unauthenticated');
  assert.equal(controller.getSnapshot().error, 'Email not confirmed');
  controller.destroy();
});

test('returns to login when Supabase Auth cannot be reached', async () => {
  const client = new FakeAuthClient(null);
  client.signInFailure = new TypeError('fetch failed');
  const controller = createAuthController({ client, confirmOwnerSession: async () => ({ email: 'owner@example.com' }) });
  await controller.login('owner@example.com', 'secret');

  assert.equal(controller.getSnapshot().status, 'unauthenticated');
  assert.equal(controller.getSnapshot().error, 'Unable to reach Supabase Auth. Check VITE_SUPABASE_URL and your network connection.');
  controller.destroy();
});

test('leaves loading when login owner confirmation fails unexpectedly', async () => {
  const client = new FakeAuthClient(null);
  client.signInSession = createSession('owner@example.com', 'token-login');
  const controller = createAuthController({
    client,
    confirmOwnerSession: async () => {
      throw new Error('Confirmation timed out.');
    },
  });

  await controller.login('owner@example.com', 'secret');

  assert.equal(client.signOutCalls, 1);
  assert.equal(controller.getSnapshot().status, 'unauthenticated');
  assert.equal(controller.getSnapshot().error, 'Confirmation timed out.');
  controller.destroy();
});

test('signs out and shows a clear error for unauthorized accounts', async () => {
  const client = new FakeAuthClient(null);
  client.signInSession = createSession('intruder@example.com', 'token-intruder');
  const controller = createAuthController({
    client,
    confirmOwnerSession: async () => {
      throw new ApiError('Forbidden.', { status: 403 });
    },
  });

  await controller.login('intruder@example.com', 'secret');

  assert.equal(client.signOutCalls, 1);
  assert.equal(controller.getSnapshot().status, 'unauthenticated');
  assert.equal(controller.getSnapshot().error, 'This account is not permitted to access this app.');
  controller.destroy();
});

test('marks the session expired when Supabase signs the user out unexpectedly', async () => {
  const client = new FakeAuthClient(createSession('owner@example.com'));
  const controller = createAuthController({
    client,
    confirmOwnerSession: async () => ({ email: 'owner@example.com' }),
  });
  await controller.start();

  client.emit('SIGNED_OUT', null);

  assert.equal(controller.getSnapshot().status, 'unauthenticated');
  assert.equal(controller.getSnapshot().error, 'Your session expired. Please sign in again.');
  controller.destroy();
});

test('logs out without leaving an error banner behind', async () => {
  const client = new FakeAuthClient(createSession('owner@example.com'));
  const controller = createAuthController({
    client,
    confirmOwnerSession: async () => ({ email: 'owner@example.com' }),
  });
  await controller.start();

  await controller.logout();

  assert.equal(client.signOutCalls, 1);
  assert.equal(controller.getSnapshot().status, 'unauthenticated');
  assert.equal(controller.getSnapshot().error, null);
  controller.destroy();
});

test('restores the persisted session across controller re-creation', async () => {
  const client = new FakeAuthClient(createSession('owner@example.com', 'token-persisted'));
  const first = createAuthController({
    client,
    confirmOwnerSession: async () => ({ email: 'owner@example.com' }),
  });
  await first.start();
  first.destroy();

  const second = createAuthController({
    client,
    confirmOwnerSession: async () => ({ email: 'owner@example.com' }),
  });
  await second.start();

  assert.equal(second.getSnapshot().session?.access_token, 'token-persisted');
  assert.equal(second.getSnapshot().status, 'authenticated');
  second.destroy();
});
