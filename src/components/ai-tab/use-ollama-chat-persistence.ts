import type { AiWorkspaceSnapshot, Chat, ModelProvider } from './types';
import type { ResolvedTurn } from './thinking-turn';
import { shouldRefreshMemoryAfterTurn } from './memory-refresh';
import { refreshAiChatMemory } from '../../lib/ai-memory-storage';
import { flushWorkspaceSnapshot, syncMemoryRefreshIntoWorkspace } from './workspace-memory-sync';

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

  await flushWorkspaceSnapshot(options);

  try {
    const refreshed = await refreshAiChatMemory(options.resolvedTurn.chat.id);
    return syncMemoryRefreshIntoWorkspace(options, refreshed);
  } catch {
    return options.chats;
  }
}
