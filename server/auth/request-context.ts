import type { Request } from 'express';

export interface AuthenticatedRequestContext {
  email: string;
  userId: string;
}

declare global {
  namespace Express {
    interface Request {
      authContext?: AuthenticatedRequestContext;
    }
  }
}

export function getRequestAuthContext(request: Request) {
  if (!request.authContext) {
    throw new Error('Missing authenticated request context.');
  }

  return request.authContext;
}

export function setRequestAuthContext(request: Request, context: AuthenticatedRequestContext) {
  request.authContext = context;
}

export {};
