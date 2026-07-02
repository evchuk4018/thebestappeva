import { AiPreferences, AiWorkspaceSnapshot, parseAiPreferences, parseAiWorkspaceSnapshot } from '../../shared/ai-workspace-contract';
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
  const workspace = parseAiWorkspaceSnapshot(await requestJson('/ai/workspace'));
  const preferences = await loadAiPreferences();
  return {
    ...workspace,
    selectedProvider: preferences.selectedProvider,
    selectedModel: preferences.selectedModel,
    visionMode: preferences.visionMode,
  };
}

export async function saveAiWorkspace(snapshot: AiWorkspaceSnapshot, options: SaveWorkspaceOptions = {}) {
  return parseAiWorkspaceSnapshot(await requestJson('/ai/workspace', {
    method: 'PUT',
    json: snapshot,
    keepalive: options.keepalive,
    signal: options.signal,
  }));
}

export async function loadAiPreferences(): Promise<AiPreferences> {
  return loadAiPreferencesWithStorage(fetchAiPreferencesFromServer);
}
