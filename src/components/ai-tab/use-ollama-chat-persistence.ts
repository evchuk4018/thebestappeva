import type { AiWorkspaceSnapshot, Chat, ModelProvider } from './types';
import type { ResolvedTurn } from './thinking-turn';
import { mergeMemoryRefreshIntoChats, shouldRefreshMemoryAfterTurn } from './memory-refresh';
import { refreshAiChatMemory } from '../../lib/ai-memory-storage';

function buildWorkspaceSnapshot(
  chats: Chat[],
  generatedUserMemory: string,
  currentProvider: ModelProvider,
  currentModel: string | null,
  enabledTools: Record<string, boolean>,
  customSystemPrompt: string,
): AiWorkspaceSnapshot {
  return {
    chats,
    generatedUserMemory,
    selectedProvider: currentProvider,
    selectedModel: currentModel,
    enabledTools,
    customSystemPrompt,
  };
}

interface RefreshCompletedTurnMemoryOptions {
  resolvedTurn: ResolvedTurn;
  chats: Chat[];
  generatedUserMemory: string;
  currentProvider: ModelProvider;
  currentModel: string | null;
  enabledTools: Record<string, boolean>;
  customSystemPrompt: string;
  flushWorkspace: (options: { snapshot: AiWorkspaceSnapshot }) => Promise<void>;
  setGeneratedUserMemory: (value: string) => void;
  setChats: (chats: Chat[]) => void;
}

export async function refreshCompletedTurnMemory(options: RefreshCompletedTurnMemoryOptions) {
  if (!shouldRefreshMemoryAfterTurn(options.resolvedTurn)) {
    return options.chats;
  }

  await options.flushWorkspace({
    snapshot: buildWorkspaceSnapshot(
      options.chats,
      options.generatedUserMemory,
      options.currentProvider,
      options.currentModel,
      options.enabledTools,
      options.customSystemPrompt,
    ),
  });

  try {
    const refreshed = await refreshAiChatMemory(options.resolvedTurn.chat.id);
    const nextChats = mergeMemoryRefreshIntoChats(options.chats, refreshed);
    options.setGeneratedUserMemory(refreshed.generatedUserMemory);
    options.setChats(nextChats);
    await options.flushWorkspace({
      snapshot: buildWorkspaceSnapshot(
        nextChats,
        refreshed.generatedUserMemory,
        options.currentProvider,
        options.currentModel,
        options.enabledTools,
        options.customSystemPrompt,
      ),
    });
    return nextChats;
  } catch {
    return options.chats;
  }
}
