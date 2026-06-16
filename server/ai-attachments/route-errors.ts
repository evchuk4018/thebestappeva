import { Response } from 'express';
import { HttpError, toErrorMessage } from '../http';

export function sendAttachmentRouteError(response: Response, error: unknown, fallback: string) {
  const statusCode = error instanceof HttpError ? error.statusCode : 500;
  response.status(statusCode).json({ ok: false, error: toErrorMessage(error, fallback) });
}
