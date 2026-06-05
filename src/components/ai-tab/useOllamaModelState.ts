import { Dispatch, SetStateAction, useEffect, useEffectEvent, useRef, useState } from 'react';
import { listModels } from './ollama-client';
import { OllamaAvailability, OllamaModel } from './types';

interface UseOllamaModelStateOptions {
  currentModel: string | null;
  hydrationStatus: 'loading' | 'ready' | 'error';
  setCurrentModel: Dispatch<SetStateAction<string | null>>;
}

export function useOllamaModelState({ currentModel, hydrationStatus, setCurrentModel }: UseOllamaModelStateOptions) {
  const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);
  const [availability, setAvailability] = useState<OllamaAvailability>('connecting');
  const [lastError, setLastError] = useState<string | null>(null);
  const currentModelRef = useRef<string | null>(currentModel);

  useEffect(() => {
    currentModelRef.current = currentModel;
  }, [currentModel]);

  async function refreshModels(preferredModel?: string | null) {
    try {
      const discoveredModels = await listModels();
      setAvailableModels(discoveredModels);

      if (discoveredModels.length === 0) {
        setAvailability('no-models');
        setCurrentModel(null);
        setLastError(null);
        return discoveredModels;
      }

      const preferred = preferredModel ?? currentModelRef.current;
      const nextModel = discoveredModels.some((model) => model.name === preferred) ? preferred : discoveredModels[0].name;
      setAvailability('ready');
      setCurrentModel(nextModel);
      setLastError(null);
      return discoveredModels;
    } catch (error) {
      setAvailability('unavailable');
      setLastError(error instanceof Error ? error.message : 'Unable to reach local Ollama.');
      return [] as OllamaModel[];
    }
  }

  const refreshModelsOnEffect = useEffectEvent((preferredModel?: string | null) => {
    void refreshModels(preferredModel);
  });

  useEffect(() => {
    void refreshModels();
  }, []);

  useEffect(() => {
    const onFocus = () => refreshModelsOnEffect();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshModelsOnEffect]);

  useEffect(() => {
    if (availability === 'ready') {
      return;
    }

    const intervalId = window.setInterval(() => refreshModelsOnEffect(), 10000);
    return () => window.clearInterval(intervalId);
  }, [availability, refreshModelsOnEffect]);

  useEffect(() => {
    if (hydrationStatus !== 'ready') {
      return;
    }

    if (availableModels.length === 0) {
      if (currentModel !== null) {
        setCurrentModel(null);
      }
      return;
    }

    if (!currentModel || !availableModels.some((model) => model.name === currentModel)) {
      setCurrentModel(availableModels[0].name);
    }
  }, [availableModels, currentModel, hydrationStatus, setCurrentModel]);

  return {
    availableModels,
    availability,
    lastError,
    refreshModels,
    setAvailability,
    setLastError,
  };
}
