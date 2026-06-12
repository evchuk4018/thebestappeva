import { Dispatch, SetStateAction, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { loadRuntimeConfig } from '../../lib/ollama/runtime';
import type { AiRuntimeConfig, ModelProvider, OllamaAvailability, OllamaModel, RuntimeProviderOption } from './types';
import { resolveModelSelection } from './model-selection';

interface UseOllamaModelStateOptions {
  currentModel: string | null;
  currentProvider: ModelProvider;
  hydrationStatus: 'loading' | 'ready' | 'error';
  setCurrentModel: Dispatch<SetStateAction<string | null>>;
  setCurrentProvider: Dispatch<SetStateAction<ModelProvider>>;
}

function findProviderOption(config: AiRuntimeConfig | null, provider: ModelProvider) {
  return config?.providerOptions.find((option) => option.value === provider) ?? null;
}

function resolveAvailability(option: RuntimeProviderOption | null, models: OllamaModel[]) {
  if (!option) {
    return 'connecting' as OllamaAvailability;
  }
  if ((option.status === 'unavailable' || option.status === 'missing-env') && !models.length) {
    return 'unavailable' as OllamaAvailability;
  }
  if (models.length === 0) {
    return 'no-models' as OllamaAvailability;
  }
  return 'ready' as OllamaAvailability;
}

export function useOllamaModelState({
  currentModel,
  currentProvider,
  hydrationStatus,
  setCurrentModel,
  setCurrentProvider,
}: UseOllamaModelStateOptions) {
  const [runtimeConfig, setRuntimeConfig] = useState<AiRuntimeConfig | null>(null);
  const [availability, setAvailability] = useState<OllamaAvailability>('connecting');
  const [lastError, setLastError] = useState<string | null>(null);
  const currentModelRef = useRef<string | null>(currentModel);

  useEffect(() => {
    currentModelRef.current = currentModel;
  }, [currentModel]);

  const availableModels = useMemo(() => runtimeConfig?.modelOptions ?? [], [runtimeConfig]);
  const activeProviderOption = useMemo(() => findProviderOption(runtimeConfig, currentProvider), [currentProvider, runtimeConfig]);

  async function refreshModels(preferredProvider = currentProvider, preferredModel?: string | null) {
    try {
      const config = await loadRuntimeConfig();
      setRuntimeConfig(config);

      const nextProvider = config.providerOptions.some((option) => option.value === preferredProvider) ? preferredProvider : config.defaultProvider;
      const { provider: resolvedProvider, model: resolvedModel } = resolveModelSelection(
        config.modelOptions,
        nextProvider,
        preferredModel ?? currentModelRef.current,
      );
      const option = findProviderOption(config, resolvedProvider);
      setCurrentProvider(resolvedProvider);
      setAvailability(resolveAvailability(option, config.modelOptions));
      setLastError(option && option.status !== 'ready' ? option.detail : null);
      setCurrentModel(resolvedModel);
      return config;
    } catch (error) {
      setAvailability('unavailable');
      setLastError(error instanceof Error ? error.message : 'Unable to reach the local AI server.');
      return null;
    }
  }

  const refreshModelsOnEffect = useEffectEvent((preferredProvider?: ModelProvider, preferredModel?: string | null) => {
    void refreshModels(preferredProvider, preferredModel);
  });

  useEffect(() => {
    void refreshModels();
  }, []);

  useEffect(() => {
    const onFocus = () => refreshModelsOnEffect(currentProvider);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [currentProvider, refreshModelsOnEffect]);

  useEffect(() => {
    if (availability === 'ready') {
      return;
    }

    const intervalId = window.setInterval(() => refreshModelsOnEffect(currentProvider), 10000);
    return () => window.clearInterval(intervalId);
  }, [availability, currentProvider, refreshModelsOnEffect]);

  useEffect(() => {
    if (hydrationStatus !== 'ready' || !runtimeConfig) {
      return;
    }

    const nextSelection = resolveModelSelection(availableModels, currentProvider, currentModel);
    const option = findProviderOption(runtimeConfig, nextSelection.provider);
    setCurrentProvider(nextSelection.provider);
    setCurrentModel(nextSelection.model);
    setAvailability(resolveAvailability(option, availableModels));
    setLastError(option && option.status !== 'ready' ? option.detail : null);
  }, [availableModels, currentModel, currentProvider, hydrationStatus, runtimeConfig, setCurrentModel, setCurrentProvider]);

  return {
    activeProviderOption,
    availableModels,
    availability,
    lastError,
    refreshModels,
    runtimeConfig,
    setAvailability,
    setLastError,
  };
}
