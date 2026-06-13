import { Dispatch, SetStateAction, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { createEmptyAiWorkspaceSnapshot } from '../../../shared/ai-workspace-contract';
import { saveAiPreferencesToLocalStorage } from '../../lib/ai-preferences-storage';
import { loadAiWorkspace, saveAiWorkspace } from '../../lib/ai-workspace-storage';
import { normalizePendingAskUserChats } from './ask-user';
import type { AiWorkspaceSnapshot, Chat } from './types';

type HydrationStatus = 'loading' | 'ready' | 'error';

interface FlushWorkspaceOptions {
  keepalive?: boolean;
  snapshot?: AiWorkspaceSnapshot;
}

interface AiWorkspacePersistenceState {
  chats: Chat[];
  generatedUserMemory: string;
  currentProvider: AiWorkspaceSnapshot['selectedProvider'];
  currentModel: string | null;
  customSystemPrompt: string;
  enabledTools: Record<string, boolean>;
  hydrationStatus: HydrationStatus;
  persistenceError: string | null;
  setChats: Dispatch<SetStateAction<Chat[]>>;
  setGeneratedUserMemory: Dispatch<SetStateAction<string>>;
  setCurrentProvider: Dispatch<SetStateAction<AiWorkspaceSnapshot['selectedProvider']>>;
  setCurrentModel: Dispatch<SetStateAction<string | null>>;
  setCustomSystemPrompt: Dispatch<SetStateAction<string>>;
  setEnabledTools: Dispatch<SetStateAction<Record<string, boolean>>>;
  flushWorkspace: (options?: FlushWorkspaceOptions) => Promise<void>;
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function useAiWorkspacePersistence(): AiWorkspacePersistenceState {
  const [chats, setChats] = useState<Chat[]>([]);
  const [generatedUserMemory, setGeneratedUserMemory] = useState('');
  const [currentProvider, setCurrentProvider] = useState<AiWorkspaceSnapshot['selectedProvider']>('ollama');
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [customSystemPrompt, setCustomSystemPrompt] = useState('');
  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>({});
  const [hydrationStatus, setHydrationStatus] = useState<HydrationStatus>('loading');
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const hydratedRef = useRef(false);
  const lastSavedSnapshotRef = useRef(JSON.stringify(createEmptyAiWorkspaceSnapshot()));

  const snapshot = useMemo<AiWorkspaceSnapshot>(() => ({
    chats,
    generatedUserMemory,
    selectedProvider: currentProvider,
    selectedModel: currentModel,
    enabledTools,
    customSystemPrompt,
  }), [chats, generatedUserMemory, currentProvider, currentModel, enabledTools, customSystemPrompt]);
  const serializedSnapshot = useMemo(() => JSON.stringify(snapshot), [snapshot]);

  const flushWorkspace = useEffectEvent(async (options: FlushWorkspaceOptions = {}) => {
    const nextSnapshot = options.snapshot ?? snapshot;
    const nextSerializedSnapshot = JSON.stringify(nextSnapshot);
    if (!hydratedRef.current || nextSerializedSnapshot === lastSavedSnapshotRef.current) {
      return;
    }

    try {
      const savedSnapshot = await saveAiWorkspace(nextSnapshot, { keepalive: options.keepalive });
      lastSavedSnapshotRef.current = JSON.stringify(savedSnapshot);
      setPersistenceError(null);
    } catch (error) {
      setPersistenceError(toErrorMessage(error, 'Unable to save the local AI workspace.'));
    }
  });

  useEffect(() => {
    let cancelled = false;

    async function hydrateWorkspace() {
      try {
        const loadedSnapshot = await loadAiWorkspace();
        if (cancelled) {
          return;
        }

        const normalizedChats = normalizePendingAskUserChats(loadedSnapshot.chats);
        const nextSnapshot = normalizedChats.changed ? { ...loadedSnapshot, chats: normalizedChats.chats } : loadedSnapshot;

        hydratedRef.current = true;
        lastSavedSnapshotRef.current = JSON.stringify(loadedSnapshot);
        setChats(nextSnapshot.chats);
        setGeneratedUserMemory(nextSnapshot.generatedUserMemory);
        setCurrentProvider(nextSnapshot.selectedProvider);
        setCurrentModel(nextSnapshot.selectedModel);
        setEnabledTools(nextSnapshot.enabledTools);
        setCustomSystemPrompt(nextSnapshot.customSystemPrompt);
        setPersistenceError(null);
        setHydrationStatus('ready');
      } catch (error) {
        if (cancelled) {
          return;
        }

        setPersistenceError(toErrorMessage(error, 'Unable to load the local AI workspace.'));
        setHydrationStatus('error');
      }
    }

    void hydrateWorkspace();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hydrationStatus !== 'ready' || serializedSnapshot === lastSavedSnapshotRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void flushWorkspace();
    }, 500);
    return () => window.clearTimeout(timeoutId);
  }, [flushWorkspace, hydrationStatus, serializedSnapshot]);

  useEffect(() => {
    if (hydrationStatus !== 'ready') {
      return;
    }

    try {
      saveAiPreferencesToLocalStorage({
        selectedProvider: currentProvider,
        selectedModel: currentModel,
      });
    } catch (error) {
      setPersistenceError(toErrorMessage(error, 'Unable to save the local AI preferences.'));
    }
  }, [currentModel, currentProvider, hydrationStatus]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      void flushWorkspace({ keepalive: true });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [flushWorkspace]);

  return {
    chats,
    generatedUserMemory,
    currentProvider,
    currentModel,
    customSystemPrompt,
    enabledTools,
    hydrationStatus,
    persistenceError,
    setChats,
    setGeneratedUserMemory,
    setCurrentProvider,
    setCurrentModel,
    setCustomSystemPrompt,
    setEnabledTools,
    flushWorkspace,
  };
}
