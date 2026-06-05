import { Request, Response } from 'express';
import { parseAiWorkspaceSnapshot } from '../shared/ai-workspace-contract';
import { HttpError } from './http';
import { loadAiPreferences, loadAiWorkspace, saveAiWorkspace } from './db/ai-workspace-repository';

function sendJson(response: Response, payload: unknown) {
  response.status(200).json(payload);
}

export async function handleGetAiWorkspace(_request: Request, response: Response) {
  sendJson(response, loadAiWorkspace());
}

export async function handlePutAiWorkspace(request: Request, response: Response) {
  if (!request.body) {
    throw new HttpError(400, 'Missing AI workspace request body.');
  }

  const snapshot = parseAiWorkspaceSnapshot(request.body);
  saveAiWorkspace(snapshot);
  sendJson(response, snapshot);
}

export async function handleGetAiPreferences(_request: Request, response: Response) {
  sendJson(response, loadAiPreferences());
}
