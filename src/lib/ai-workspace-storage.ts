import { AiPreferences, AiWorkspaceSnapshot, parseAiPreferences, parseAiWorkspaceSnapshot } from '../../shared/ai-workspace-contract';
import { loadAiPreferencesWithStorage } from './ai-preferences-storage';

interface SaveWorkspaceOptions {
  keepalive?: boolean;
  signal?: AbortSignal;
}

async function readJsonResponse(response: Response) {
  const payload = await response.json().catch(() => ({ ok: false, error: 'The local server returned invalid JSON.' }));
  if (!response.ok) {
    const message = payload && typeof payload.error === 'string' ? payload.error : `The local server failed with ${response.status}.`;
    throw new Error(message);
  }

  return payload;
}

async function fetchAiPreferencesFromServer(): Promise<AiPreferences> {
  const response = await fetch('/api/ai/preferences');
  return parseAiPreferences(await readJsonResponse(response));
}

export async function loadAiWorkspace() {
  const response = await fetch('/api/ai/workspace');
  const workspace = parseAiWorkspaceSnapshot(await readJsonResponse(response));
  const preferences = await loadAiPreferences();
  return {
    ...workspace,
    selectedProvider: preferences.selectedProvider,
    selectedModel: preferences.selectedModel,
    visionMode: preferences.visionMode,
  };
}

export async function saveAiWorkspace(snapshot: AiWorkspaceSnapshot, options: SaveWorkspaceOptions = {}) {
  const response = await fetch('/api/ai/workspace', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot),
    keepalive: options.keepalive,
    signal: options.signal,
  });

  return parseAiWorkspaceSnapshot(await readJsonResponse(response));
}

export async function loadAiPreferences(): Promise<AiPreferences> {
  return loadAiPreferencesWithStorage(fetchAiPreferencesFromServer);
}
