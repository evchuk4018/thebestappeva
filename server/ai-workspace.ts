import { Request, Response } from 'express';
import { parseSaveAiWorkspaceRequest } from '../shared/ai-workspace-contract';
import { getRequestAuthContext } from './auth/request-context';
import { createPostgresAiWorkspaceRepository } from './db/postgres-ai-workspace-repository';
import { getOwnerUuidFromRequestContext } from './db/postgres-repository-utils';
import { HttpError } from './http';

function sendJson(response: Response, payload: unknown) {
  response.status(200).json(payload);
}

function createRepository(request: Request) {
  return createPostgresAiWorkspaceRepository(getOwnerUuidFromRequestContext(getRequestAuthContext(request).userId));
}

export async function handleGetAiWorkspace(request: Request, response: Response) {
  sendJson(response, await createRepository(request).loadAiWorkspace());
}

export async function handlePutAiWorkspace(request: Request, response: Response) {
  if (!request.body) {
    throw new HttpError(400, 'Missing AI workspace request body.');
  }

  const payload = parseSaveAiWorkspaceRequest(request.body);
  sendJson(response, await createRepository(request).saveAiWorkspace(payload.workspace, payload.revision));
}

export async function handleGetAiPreferences(request: Request, response: Response) {
  sendJson(response, await createRepository(request).loadAiPreferences());
}
