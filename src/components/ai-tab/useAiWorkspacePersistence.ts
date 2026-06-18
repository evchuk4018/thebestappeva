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
  visionMode: AiWorkspaceSnapshot['visionMode'];
  customSystemPrompt: string;
  enabledTools: Record<string, boolean>;
  hydrationStatus: HydrationStatus;
  persistenceError: string | null;
  setChats: Dispatch<SetStateAction<Chat[]>>;
  setGeneratedUserMemory: Dispatch<SetStateAction<string>>;
  setCurrentProvider: Dispatch<SetStateAction<AiWorkspaceSnapshot['selectedProvider']>>;
  setCurrentModel: Dispatch<SetStateAction<string | null>>;
  setVisionMode: Dispatch<SetStateAction<AiWorkspaceSnapshot['visionMode']>>;
  setCustomSystemPrompt: Dispatch<SetStateAction<string>>;
  setEnabledTools: Dispatch<SetStateAction<Record<string, boolean>>>;
  getChats: () => Chat[];
  getGeneratedUserMemory: () => string;
  getWorkspaceSnapshot: (overrides?: Partial<AiWorkspaceSnapshot>) => AiWorkspaceSnapshot;
  flushWorkspace: (options?: FlushWorkspaceOptions) => Promise<void>;
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function buildSnapshot(
  chats: Chat[],
  generatedUserMemory: string,
  currentProvider: AiWorkspaceSnapshot['selectedProvider'],
  currentModel: string | null,
  visionMode: AiWorkspaceSnapshot['visionMode'],
  enabledTools: Record<string, boolean>,
  customSystemPrompt: string,
): AiWorkspaceSnapshot {
  return {
    chats,
    generatedUserMemory,
    selectedProvider: currentProvider,
    selectedModel: currentModel,
    visionMode,
    enabledTools,
    customSystemPrompt,
  };
}

export function useAiWorkspacePersistence(): AiWorkspacePersistenceState {
  const [chats, setChatsState] = useState<Chat[]>([]);
  const [generatedUserMemory, setGeneratedUserMemoryState] = useState('');
  const [currentProvider, setCurrentProvider] = useState<AiWorkspaceSnapshot['selectedProvider']>('ollama');
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [visionMode, setVisionMode] = useState<AiWorkspaceSnapshot['visionMode']>('offline');
  const [customSystemPrompt, setCustomSystemPrompt] = useState('');
  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>({});
  const [hydrationStatus, setHydrationStatus] = useState<HydrationStatus>('loading');
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const hydratedRef = useRef(false);
  const lastSavedSnapshotRef = useRef(JSON.stringify(createEmptyAiWorkspaceSnapshot()));
  const chatsRef = useRef<Chat[]>([]);
  const generatedUserMemoryRef = useRef('');
  const currentProviderRef = useRef<AiWorkspaceSnapshot['selectedProvider']>('ollama');
  const currentModelRef = useRef<string | null>(null);
  const visionModeRef = useRef<AiWorkspaceSnapshot['visionMode']>('offline');
  const customSystemPromptRef = useRef('');
  const enabledToolsRef = useRef<Record<string, boolean>>({});

  const setChats = useEffectEvent((next: SetStateAction<Chat[]>) => {
    setChatsState((current) => {
      const resolved = typeof next === 'function' ? next(current) : next;
      chatsRef.current = resolved;
      return resolved;
    });
  });

  const setGeneratedUserMemory = useEffectEvent((next: SetStateAction<string>) => {
    setGeneratedUserMemoryState((current) => {
      const resolved = typeof next === 'function' ? next(current) : next;
      generatedUserMemoryRef.current = resolved;
      return resolved;
    });
  });

  const getChats = useEffectEvent(() => chatsRef.current);
  const getGeneratedUserMemory = useEffectEvent(() => generatedUserMemoryRef.current);
  const getWorkspaceSnapshot = useEffectEvent((overrides: Partial<AiWorkspaceSnapshot> = {}) =>
    buildSnapshot(
      overrides.chats ?? chatsRef.current,
      overrides.generatedUserMemory ?? generatedUserMemoryRef.current,
      overrides.selectedProvider ?? currentProviderRef.current,
      overrides.selectedModel ?? currentModelRef.current,
      overrides.visionMode ?? visionModeRef.current,
      overrides.enabledTools ?? enabledToolsRef.current,
      overrides.customSystemPrompt ?? customSystemPromptRef.current,
    ));

  useEffect(() => {
    chatsRef.current = chats;
    generatedUserMemoryRef.current = generatedUserMemory;
    currentProviderRef.current = currentProvider;
    currentModelRef.current = currentModel;
    visionModeRef.current = visionMode;
    customSystemPromptRef.current = customSystemPrompt;
    enabledToolsRef.current = enabledTools;
  }, [chats, generatedUserMemory, currentProvider, currentModel, visionMode, customSystemPrompt, enabledTools]);

  const snapshot = useMemo<AiWorkspaceSnapshot>(() => buildSnapshot(
    chats,
    generatedUserMemory,
    currentProvider,
    currentModel,
    visionMode,
    enabledTools,
    customSystemPrompt,
  ), [chats, generatedUserMemory, currentProvider, currentModel, visionMode, enabledTools, customSystemPrompt]);
  const serializedSnapshot = useMemo(() => JSON.stringify(snapshot), [snapshot]);

  const flushWorkspace = useEffectEvent(async (options: FlushWorkspaceOptions = {}) => {
    const nextSnapshot = options.snapshot ?? getWorkspaceSnapshot();
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
        chatsRef.current = nextSnapshot.chats;
        generatedUserMemoryRef.current = nextSnapshot.generatedUserMemory;
        currentProviderRef.current = nextSnapshot.selectedProvider;
        currentModelRef.current = nextSnapshot.selectedModel;
        visionModeRef.current = nextSnapshot.visionMode;
        enabledToolsRef.current = nextSnapshot.enabledTools;
        customSystemPromptRef.current = nextSnapshot.customSystemPrompt;
        setChatsState(nextSnapshot.chats);
        setGeneratedUserMemoryState(nextSnapshot.generatedUserMemory);
        setCurrentProvider(nextSnapshot.selectedProvider);
        setCurrentModel(nextSnapshot.selectedModel);
        setVisionMode(nextSnapshot.visionMode);
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
        visionMode,
      });
    } catch (error) {
      setPersistenceError(toErrorMessage(error, 'Unable to save the local AI preferences.'));
    }
  }, [currentModel, currentProvider, hydrationStatus, visionMode]);

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
    visionMode,
    customSystemPrompt,
    enabledTools,
    hydrationStatus,
    persistenceError,
    setChats,
    setGeneratedUserMemory,
    setCurrentProvider,
    setCurrentModel,
    setVisionMode,
    setCustomSystemPrompt,
    setEnabledTools,
    getChats,
    getGeneratedUserMemory,
    getWorkspaceSnapshot,
    flushWorkspace,
  };
}
