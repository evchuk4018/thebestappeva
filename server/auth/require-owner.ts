import type { NextFunction, Request, Response } from 'express';
import { normalizeEmail, readServerAuthConfig, type ServerAuthConfig } from './config';
import { setRequestAuthContext } from './request-context';
import type { AccessTokenValidator } from './supabase';

interface RequireOwnerDependencies {
  ownerEmail?: string;
  tokenValidator: AccessTokenValidator;
}

function sendAuthFailure(response: Response, statusCode: 401 | 403) {
  response.status(statusCode).json({
    ok: false,
    error: statusCode === 401 ? 'Authentication required.' : 'Forbidden.',
  });
}

function readBearerToken(request: Request) {
  const header = request.header('authorization');
  if (!header) {
    return null;
  }

  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

export function createRequireOwnerMiddleware(
  dependencies: RequireOwnerDependencies,
  authConfig: Pick<ServerAuthConfig, 'ownerEmail'> = readServerAuthConfig(),
) {
  const ownerEmail = normalizeEmail(dependencies.ownerEmail ?? authConfig.ownerEmail);

  return async function requireOwner(request: Request, response: Response, next: NextFunction) {
    try {
      if (!ownerEmail) {
        throw new Error('Owner authentication is not configured.');
      }

      const accessToken = readBearerToken(request);
      if (!accessToken) {
        sendAuthFailure(response, 401);
        return;
      }

      const user = await dependencies.tokenValidator.getUser(accessToken);
      if (!user) {
        sendAuthFailure(response, 401);
        return;
      }

      const email = normalizeEmail(user.email);
      if (!email || email !== ownerEmail) {
        sendAuthFailure(response, 403);
        return;
      }

      setRequestAuthContext(request, { email, userId: user.userId });
      next();
    } catch {
      response.status(500).json({ ok: false, error: 'Authentication is not configured.' });
    }
  };
}
