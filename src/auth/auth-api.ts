import { requestJson } from '../lib/api';

export interface ConfirmedOwnerSession {
  email: string;
}

export async function confirmOwnerSession(accessToken: string): Promise<ConfirmedOwnerSession> {
  const payload = await requestJson<{ ok: boolean; user: { email: string } }>('/auth/session', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return {
    email: payload.user.email,
  };
}
