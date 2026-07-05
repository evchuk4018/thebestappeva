import { AiPreferences, AiWorkspaceSnapshot, parseAiPreferences, parseAiWorkspaceRevisionResponse } from '../../shared/ai-workspace-contract';
import { requestJson } from './api';
import { loadAiPreferencesWithStorage } from './ai-preferences-storage';

interface SaveWorkspaceOptions {
  keepalive?: boolean;
  signal?: AbortSignal;
}

async function fetchAiPreferencesFromServer(): Promise<AiPreferences> {
  return parseAiPreferences(await requestJson('/ai/preferences'));
}

export async function loadAiWorkspace() {
  const response = parseAiWorkspaceRevisionResponse(await requestJson('/ai/workspace'));
  const preferences = await loadAiPreferences();
  const workspace = response.workspace;
  return {
    revision: response.revision,
    workspace: {
      ...workspace,
      selectedProvider: preferences.selectedProvider,
      selectedModel: preferences.selectedModel,
      visionMode: preferences.visionMode,
    },
  };
}

export async function saveAiWorkspace(snapshot: AiWorkspaceSnapshot, revision: number, options: SaveWorkspaceOptions = {}) {
  return parseAiWorkspaceRevisionResponse(await requestJson('/ai/workspace', {
    method: 'PUT',
    json: { revision, workspace: snapshot },
    keepalive: options.keepalive,
    signal: options.signal,
  }));
}

export async function loadAiPreferences(): Promise<AiPreferences> {
  return loadAiPreferencesWithStorage(fetchAiPreferencesFromServer);
}
