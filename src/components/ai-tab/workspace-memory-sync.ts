import type { AiMemoryRefreshResponse } from '../../../shared/ai-memory-contract';
import type { AiWorkspaceSnapshot, Chat, ModelProvider } from './types';
import { mergeMemoryRefreshIntoChats } from './memory-refresh';

export interface WorkspaceMemorySyncContext {
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

export function buildWorkspaceSnapshot(
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

export async function flushWorkspaceSnapshot(
  context: WorkspaceMemorySyncContext,
  chats = context.chats,
  generatedUserMemory = context.generatedUserMemory,
) {
  await context.flushWorkspace({
    snapshot: buildWorkspaceSnapshot(
      chats,
      generatedUserMemory,
      context.currentProvider,
      context.currentModel,
      context.enabledTools,
      context.customSystemPrompt,
    ),
  });
}

export async function syncMemoryRefreshIntoWorkspace(
  context: WorkspaceMemorySyncContext,
  payload: AiMemoryRefreshResponse,
) {
  const nextChats = mergeMemoryRefreshIntoChats(context.chats, payload);
  context.setGeneratedUserMemory(payload.generatedUserMemory);
  context.setChats(nextChats);
  await flushWorkspaceSnapshot(context, nextChats, payload.generatedUserMemory);
  return nextChats;
}
