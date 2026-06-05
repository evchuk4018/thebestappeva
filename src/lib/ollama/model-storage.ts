import { loadAiPreferences } from '../ai-workspace-storage';

export async function loadStoredSelectedModel() {
  const preferences = await loadAiPreferences();
  return preferences.selectedModel;
}
