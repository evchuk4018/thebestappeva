import { Request, Response } from 'express';
import { parseSaveAiWorkspaceRequest } from '../shared/ai-workspace-contract';
import type { ServerRequestDependencies } from './composition-root';
import { HttpError } from './http';

type AiWorkspaceRouteDependencies = Pick<ServerRequestDependencies, 'aiWorkspaceRepository'>;

function sendJson(response: Response, payload: unknown) {
  response.status(200).json(payload);
}

function repository(dependencies: AiWorkspaceRouteDependencies) {
  return dependencies.aiWorkspaceRepository;
}

export async function handleGetAiWorkspace(_request: Request, response: Response, dependencies: AiWorkspaceRouteDependencies) {
  sendJson(response, await repository(dependencies).loadAiWorkspace());
}

export async function handlePutAiWorkspace(request: Request, response: Response, dependencies: AiWorkspaceRouteDependencies) {
  if (!request.body) {
    throw new HttpError(400, 'Missing AI workspace request body.');
  }

  const payload = parseSaveAiWorkspaceRequest(request.body);
  sendJson(response, await repository(dependencies).saveAiWorkspace(payload.workspace, payload.revision));
}

export async function handleGetAiPreferences(_request: Request, response: Response, dependencies: AiWorkspaceRouteDependencies) {
  sendJson(response, await repository(dependencies).loadAiPreferences());
}
