import type { Request, Response } from 'express';
import {
  parseCreateAutomationRequest,
  parseReportAutomationRunRequest,
  parseUpdateAutomationRequest,
} from '../shared/automations-contract';
import type { ServerRequestDependencies } from './composition-root';
import { HttpError } from './http';
import { AutomationNameConflictError, LinkedSkillNotFoundError } from './automations-service';

type AutomationsRouteDependencies = Pick<ServerRequestDependencies, 'automationsService'>;

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

function service(dependencies: AutomationsRouteDependencies) {
  return dependencies.automationsService;
}

export async function handleListAutomations(_request: Request, response: Response, dependencies: AutomationsRouteDependencies) {
  sendJson(response, { automations: await service(dependencies).listAutomations() });
}

export async function handleCreateAutomation(request: Request, response: Response, dependencies: AutomationsRouteDependencies) {
  try {
    sendJson(response, { automation: await service(dependencies).createAutomation(parseCreateAutomationRequest(expectBody(request))) });
  } catch (error) {
    throw mapAutomationError(error, 'Failed to create automation.');
  }
}

export async function handleGetAutomation(request: Request, response: Response, dependencies: AutomationsRouteDependencies) {
  const automation = await service(dependencies).getAutomation(request.params.automationId);
  if (!automation) throw new HttpError(404, `Automation "${request.params.automationId}" was not found.`);
  sendJson(response, { automation });
}

export async function handlePutAutomation(request: Request, response: Response, dependencies: AutomationsRouteDependencies) {
  try {
    const automation = await service(dependencies).updateAutomation(request.params.automationId, parseUpdateAutomationRequest(expectBody(request)));
    if (!automation) throw new HttpError(404, `Automation "${request.params.automationId}" was not found.`);
    sendJson(response, { automation });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw mapAutomationError(error, 'Failed to update automation.');
  }
}

export async function handleDeleteAutomation(request: Request, response: Response, dependencies: AutomationsRouteDependencies) {
  if (!await service(dependencies).deleteAutomation(request.params.automationId)) {
    throw new HttpError(404, `Automation "${request.params.automationId}" was not found.`);
  }
  sendJson(response, { ok: true });
}

export async function handleToggleAutomation(request: Request, response: Response, dependencies: AutomationsRouteDependencies) {
  const enabled = expectBody(request).enabled;
  if (typeof enabled !== 'boolean') throw new HttpError(400, 'Body field "enabled" must be a boolean.');
  const automation = await service(dependencies).setAutomationEnabled(request.params.automationId, enabled);
  if (!automation) throw new HttpError(404, `Automation "${request.params.automationId}" was not found.`);
  sendJson(response, { automation });
}

export async function handleClaimDueAutomations(_request: Request, response: Response, dependencies: AutomationsRouteDependencies) {
  sendJson(response, await service(dependencies).claimDue());
}

export async function handleReportAutomationRun(request: Request, response: Response, dependencies: AutomationsRouteDependencies) {
  const automation = await service(dependencies).reportRun(request.params.automationId, parseReportAutomationRunRequest(expectBody(request)));
  if (!automation) throw new HttpError(404, `Automation "${request.params.automationId}" was not found.`);
  sendJson(response, { automation });
}
