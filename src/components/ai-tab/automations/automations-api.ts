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

async function readJsonResponse(response: Response) {
  const payload = await response.json().catch(() => ({ error: 'The local server returned invalid JSON.' }));
  if (!response.ok) {
    const message = payload && typeof payload.error === 'string' ? payload.error : `The local server failed with ${response.status}.`;
    throw new Error(message);
  }
  return payload;
}

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  return readJsonResponse(response);
}

export async function fetchAutomations(): Promise<AutomationSummary[]> {
  return parseAutomationListResponse(await requestJson('/api/automations')).automations;
}

export async function fetchAutomation(id: string): Promise<AutomationRecord | null> {
  const response = await fetch(`/api/automations/${id}`);
  if (response.status === 404) return null;
  return parseAutomationResponse(await readJsonResponse(response)).automation;
}

export async function createAutomation(request: CreateAutomationRequest): Promise<AutomationRecord> {
  return parseAutomationResponse(await requestJson('/api/automations', {
    method: 'POST',
    body: JSON.stringify(parseCreateAutomationRequest(request)),
  })).automation;
}

export async function updateAutomation(id: string, request: UpdateAutomationRequest): Promise<AutomationRecord> {
  return parseAutomationResponse(await requestJson(`/api/automations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(parseUpdateAutomationRequest(request)),
  })).automation;
}

export async function toggleAutomation(id: string, enabled: boolean): Promise<AutomationRecord> {
  return parseAutomationResponse(await requestJson(`/api/automations/${id}/toggle`, {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  })).automation;
}

export async function deleteAutomation(id: string): Promise<void> {
  await requestJson(`/api/automations/${id}`, { method: 'DELETE' });
}

export async function claimDueAutomations(): Promise<ClaimDueAutomationsResponse> {
  return parseClaimDueAutomationsResponse(await requestJson('/api/automations/claim-due', { method: 'POST' }));
}

export async function reportAutomationRun(id: string, request: ReportAutomationRunRequest): Promise<AutomationRecord> {
  return parseAutomationResponse(await requestJson(`/api/automations/${id}/report-run`, {
    method: 'POST',
    body: JSON.stringify(parseReportAutomationRunRequest(request)),
  })).automation;
}
