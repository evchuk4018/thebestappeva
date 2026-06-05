const selectedModelStorageKey = 'ai-tab.selected-model';

export function loadStoredSelectedModel() {
  return window.localStorage.getItem(selectedModelStorageKey);
}

export function saveStoredSelectedModel(model: string | null) {
  if (!model) {
    window.localStorage.removeItem(selectedModelStorageKey);
    return;
  }

  window.localStorage.setItem(selectedModelStorageKey, model);
}
