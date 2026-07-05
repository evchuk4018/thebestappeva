import type { Request, Response } from 'express';
import {
  parseCreateAutomationRequest,
  parseReportAutomationRunRequest,
  parseUpdateAutomationRequest,
} from '../shared/automations-contract';
import { getRequestAuthContext } from './auth/request-context';
import { createPostgresAutomationsRepository } from './db/postgres-automations-repository';
import { getOwnerUuidFromRequestContext } from './db/postgres-repository-utils';
import { createPostgresSkillsRepository } from './db/postgres-skills-repository';
import { HttpError } from './http';
import { AutomationNameConflictError, createAutomationsService, LinkedSkillNotFoundError } from './automations-service';
import { createSkillsService } from './skills-service';

function sendJson(response: Response, payload: unknown) {
  response.status(200).json(payload);
}

function expectBody(request: Request) {
  if (!request.body) throw new HttpError(400, 'Missing request body.');
  return request.body as Record<string, unknown>;
}

function mapAutomationError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  if (error instanceof LinkedSkillNotFoundError) return new HttpError(400, message);
  if (error instanceof AutomationNameConflictError || /UNIQUE constraint/i.test(message)) return new HttpError(409, message);
  return new HttpError(400, message);
}

function createService(request: Request) {
  const ownerId = getOwnerUuidFromRequestContext(getRequestAuthContext(request).userId);
  return createAutomationsService(createPostgresAutomationsRepository(ownerId), createSkillsService(createPostgresSkillsRepository(ownerId)));
}

export async function handleListAutomations(request: Request, response: Response) {
  sendJson(response, { automations: await createService(request).listAutomations() });
}

export async function handleCreateAutomation(request: Request, response: Response) {
  try {
    sendJson(response, { automation: await createService(request).createAutomation(parseCreateAutomationRequest(expectBody(request))) });
  } catch (error) {
    throw mapAutomationError(error, 'Failed to create automation.');
  }
}

export async function handleGetAutomation(request: Request, response: Response) {
  const automation = await createService(request).getAutomation(request.params.automationId);
  if (!automation) throw new HttpError(404, `Automation "${request.params.automationId}" was not found.`);
  sendJson(response, { automation });
}

export async function handlePutAutomation(request: Request, response: Response) {
  try {
    const automation = await createService(request).updateAutomation(request.params.automationId, parseUpdateAutomationRequest(expectBody(request)));
    if (!automation) throw new HttpError(404, `Automation "${request.params.automationId}" was not found.`);
    sendJson(response, { automation });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw mapAutomationError(error, 'Failed to update automation.');
  }
}

export async function handleDeleteAutomation(request: Request, response: Response) {
  if (!await createService(request).deleteAutomation(request.params.automationId)) {
    throw new HttpError(404, `Automation "${request.params.automationId}" was not found.`);
  }
  sendJson(response, { ok: true });
}

export async function handleToggleAutomation(request: Request, response: Response) {
  const enabled = expectBody(request).enabled;
  if (typeof enabled !== 'boolean') throw new HttpError(400, 'Body field "enabled" must be a boolean.');
  const automation = await createService(request).setAutomationEnabled(request.params.automationId, enabled);
  if (!automation) throw new HttpError(404, `Automation "${request.params.automationId}" was not found.`);
  sendJson(response, { automation });
}

export async function handleClaimDueAutomations(request: Request, response: Response) {
  sendJson(response, await createService(request).claimDue());
}

export async function handleReportAutomationRun(request: Request, response: Response) {
  const automation = await createService(request).reportRun(request.params.automationId, parseReportAutomationRunRequest(expectBody(request)));
  if (!automation) throw new HttpError(404, `Automation "${request.params.automationId}" was not found.`);
  sendJson(response, { automation });
}
