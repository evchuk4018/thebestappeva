import type { ModelProvider, OllamaModel } from './types';

const providerOrder: ModelProvider[] = ['ollama', 'deepseek'];

function compareModelNames(left: OllamaModel, right: OllamaModel) {
  return (left.label ?? left.name).localeCompare(right.label ?? right.name, undefined, { sensitivity: 'base' });
}

export function sortModelsForDisplay(models: OllamaModel[]) {
  return [...models].sort((left, right) => {
    const providerDelta = providerOrder.indexOf(left.provider) - providerOrder.indexOf(right.provider);
    return providerDelta !== 0 ? providerDelta : compareModelNames(left, right);
  });
}

export function groupModelsByProvider(models: OllamaModel[]) {
  return {
    ollama: models.filter((model) => model.provider === 'ollama'),
    deepseek: models.filter((model) => model.provider === 'deepseek'),
  } satisfies Record<ModelProvider, OllamaModel[]>;
}

export function resolveProviderForModel(models: OllamaModel[], modelName: string | null) {
  if (!modelName) {
    return null;
  }

  return models.find((model) => model.name === modelName)?.provider ?? null;
}

export function resolveModelSelection(models: OllamaModel[], preferredProvider: ModelProvider, preferredModel: string | null) {
  const preferredModelMatch = resolveProviderForModel(models, preferredModel);
  if (preferredModelMatch) {
    return {
      provider: preferredModelMatch,
      model: preferredModel,
    };
  }

  const preferredProviderModels = models.filter((model) => model.provider === preferredProvider);
  if (preferredProviderModels.length) {
    return {
      provider: preferredProvider,
      model: preferredProviderModels[0].name,
    };
  }

  if (models.length) {
    return {
      provider: models[0].provider,
      model: models[0].name,
    };
  }

  return {
    provider: preferredProvider,
    model: null,
  };
}
