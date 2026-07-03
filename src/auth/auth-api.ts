import { requestJson } from '../lib/api';

export interface ConfirmedOwnerSession {
  email: string;
}

const ownerSessionTimeoutMs = 10000;

function createTimeoutSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    cleanup: () => globalThis.clearTimeout(timeoutId),
  };
}

export async function confirmOwnerSession(accessToken: string): Promise<ConfirmedOwnerSession> {
  const timeout = createTimeoutSignal(ownerSessionTimeoutMs);
  let payload: { ok: boolean; user: { email: string } };

  try {
    payload = await requestJson<{ ok: boolean; user: { email: string } }>('/auth/session', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: timeout.signal,
    });
  } catch (error) {
    if (timeout.signal.aborted) {
      throw new Error('Unable to confirm your session. Check Supabase and API auth configuration, then try again.');
    }
    throw error;
  } finally {
    timeout.cleanup();
  }

  return {
    email: payload.user.email,
  };
}
