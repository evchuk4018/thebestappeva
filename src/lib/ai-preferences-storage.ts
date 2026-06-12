import { AiPreferences, parseAiPreferences } from '../../shared/ai-workspace-contract';

const STORAGE_KEY = 'thebestappeva.ai.preferences.v1';
const defaultAiPreferences: AiPreferences = {
  selectedProvider: 'ollama',
  selectedModel: null,
};

function canUseLocalStorage() {
  return typeof window !== 'undefined' && 'localStorage' in window;
}

export function readAiPreferencesFromLocalStorage(): AiPreferences | null {
  if (!canUseLocalStorage()) {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return parseAiPreferences(JSON.parse(raw), 'AI preferences localStorage payload');
  } catch {
    return null;
  }
}

export function saveAiPreferencesToLocalStorage(preferences: AiPreferences) {
  const normalized = parseAiPreferences(preferences, 'AI preferences localStorage write');
  if (canUseLocalStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

export async function loadAiPreferencesWithStorage(fetchPreferences: () => Promise<AiPreferences>) {
  const stored = readAiPreferencesFromLocalStorage();
  if (stored) {
    return stored;
  }

  const migrated = await fetchPreferences().catch(() => defaultAiPreferences);
  return saveAiPreferencesToLocalStorage(migrated);
}

export { STORAGE_KEY as aiPreferencesStorageKey };
