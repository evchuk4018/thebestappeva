import {
  parseAutomationListResponse,
  parseAutomationResponse,
  parseClaimDueAutomationsResponse,
  parseCreateAutomationRequest,
  parseReportAutomationRunRequest,
  parseUpdateAutomationRequest,
  type AutomationRecord,
  type AutomationSummary,
  type ClaimDueAutomationsResponse,
  type CreateAutomationRequest,
  type ReportAutomationRunRequest,
  type UpdateAutomationRequest,
} from '../../../../shared/automations-contract';
import { readJsonResponse, requestApi, requestJson } from '../../../lib/api';

export async function fetchAutomations(): Promise<AutomationSummary[]> {
  return parseAutomationListResponse(await requestJson('/automations')).automations;
}

export async function fetchAutomation(id: string): Promise<AutomationRecord | null> {
  const response = await requestApi(`/automations/${id}`);
  if (response.status === 404) return null;
  return parseAutomationResponse(await readJsonResponse(response)).automation;
}

export async function createAutomation(request: CreateAutomationRequest): Promise<AutomationRecord> {
  return parseAutomationResponse(await requestJson('/automations', {
    method: 'POST',
    json: parseCreateAutomationRequest(request),
  })).automation;
}

export async function updateAutomation(id: string, request: UpdateAutomationRequest): Promise<AutomationRecord> {
  return parseAutomationResponse(await requestJson(`/automations/${id}`, {
    method: 'PUT',
    json: parseUpdateAutomationRequest(request),
  })).automation;
}

export async function toggleAutomation(id: string, enabled: boolean): Promise<AutomationRecord> {
  return parseAutomationResponse(await requestJson(`/automations/${id}/toggle`, {
    method: 'POST',
    json: { enabled },
  })).automation;
}

export async function deleteAutomation(id: string): Promise<void> {
  await requestJson(`/automations/${id}`, { method: 'DELETE' });
}

export async function claimDueAutomations(): Promise<ClaimDueAutomationsResponse> {
  return parseClaimDueAutomationsResponse(await requestJson('/automations/claim-due', { method: 'POST' }));
}

export async function reportAutomationRun(id: string, request: ReportAutomationRunRequest): Promise<AutomationRecord> {
  return parseAutomationResponse(await requestJson(`/automations/${id}/report-run`, {
    method: 'POST',
    json: parseReportAutomationRunRequest(request),
  })).automation;
}
