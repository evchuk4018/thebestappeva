import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { createApp } from '../app';
import type { AccessTokenValidator, AuthenticatedTokenUser } from './supabase';

function createTokenValidator(users: Record<string, AuthenticatedTokenUser | null>): AccessTokenValidator {
  return {
    async getUser(accessToken: string) {
      return Object.prototype.hasOwnProperty.call(users, accessToken) ? users[accessToken] ?? null : null;
    },
  };
}

async function withApp<T>(
  tokenValidator: AccessTokenValidator,
  run: (baseUrl: string) => Promise<T>,
  options: { ownerEmail?: string; environment?: string; authConfig?: Record<string, string> } = {},
) {
  const app = await createApp('preview', {
    attachFrontend: false,
    authConfig: {
      ownerEmail: options.authConfig?.APP_OWNER_EMAIL ?? 'owner@example.com',
      supabaseUrl: options.authConfig?.SUPABASE_URL ?? 'https://supabase.test',
      supabaseAnonKey: options.authConfig?.SUPABASE_ANON_KEY ?? 'anon-key',
    },
    environment: options.environment,
    ownerEmail: options.ownerEmail,
    tokenValidator,
  });
  const server = await new Promise<import('node:http').Server>((resolve) => {
    const next = app.listen(0, '127.0.0.1', () => resolve(next));
  });
  const { port } = server.address() as AddressInfo;

  try {
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

test('rejects a missing authorization header', async () => {
  await withApp(createTokenValidator({}), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/session`);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { ok: false, error: 'Authentication required.' });
  });
});

test('rejects a malformed bearer header', async () => {
  await withApp(createTokenValidator({}), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Authorization: 'Basic abc123' },
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { ok: false, error: 'Authentication required.' });
  });
});

test('rejects an invalid token', async () => {
  await withApp(createTokenValidator({ invalid: null }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Authorization: 'Bearer invalid' },
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { ok: false, error: 'Authentication required.' });
  });
});

test('rejects an expired token', async () => {
  await withApp(createTokenValidator({ expired: null }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Authorization: 'Bearer expired' },
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { ok: false, error: 'Authentication required.' });
  });
});

test('rejects a valid token with no email', async () => {
  await withApp(createTokenValidator({ missingEmail: { userId: 'user-1', email: null } }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Authorization: 'Bearer missingEmail' },
    });
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { ok: false, error: 'Forbidden.' });
  });
});

test('rejects a valid non-owner token', async () => {
  await withApp(createTokenValidator({ intruder: { userId: 'user-2', email: 'intruder@example.com' } }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Authorization: 'Bearer intruder' },
    });
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { ok: false, error: 'Forbidden.' });
  });
});

test('matches the owner email case-insensitively', async () => {
  await withApp(createTokenValidator({ owner: { userId: 'owner-1', email: ' OWNER@Example.COM ' } }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Authorization: 'Bearer owner' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { ok: true, user: { email: 'owner@example.com' } });
  }, { ownerEmail: ' owner@example.com ' });
});

test('allows a valid owner request', async () => {
  await withApp(createTokenValidator({ owner: { userId: 'owner-1', email: 'owner@example.com' } }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Authorization: 'Bearer owner' },
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.deepEqual(payload, { ok: true, user: { email: 'owner@example.com' } });
    assert.equal('userId' in payload.user, false);
  });
});

test('protects streaming, upload, download, url-fetch, and python-exec routes', async () => {
  await withApp(createTokenValidator({}), async (baseUrl) => {
    const responses = await Promise.all([
      fetch(`${baseUrl}/api/ai/chat/stream`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"messages":[]}' }),
      fetch(`${baseUrl}/api/ai/attachments/parse`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'not-json' }),
      fetch(`${baseUrl}/api/ai/chats/chat-1/python-exec/files/chart.png`),
      fetch(`${baseUrl}/api/fetch-url?url=https://example.com`),
      fetch(`${baseUrl}/api/python-exec`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"code":"print(1)"}' }),
    ]);

    for (const response of responses) {
      assert.equal(response.status, 401);
      assert.match(response.headers.get('content-type') ?? '', /application\/json/);
      assert.deepEqual(await response.json(), { ok: false, error: 'Authentication required.' });
    }
  });
});

test('fails production startup when auth config is missing', async () => {
  await assert.rejects(
    () => createApp('preview', {
      attachFrontend: false,
      authConfig: {
        ownerEmail: '',
        supabaseUrl: '',
        supabaseAnonKey: '',
      },
      environment: 'production',
      tokenValidator: createTokenValidator({}),
    }),
    /Missing required authentication configuration: SUPABASE_URL, SUPABASE_ANON_KEY, APP_OWNER_EMAIL\./,
  );
});
