import type { AiMemoryRefreshResponse } from '../../../shared/ai-memory-contract';
import type { AiWorkspaceSnapshot, Chat, ModelProvider } from './types';
import { mergeMemoryRefreshIntoChats } from './memory-refresh';
import type { AiVisionMode } from '../../../shared/ai-vision-contract';

export interface WorkspaceMemorySyncContext {
  getChats: () => Chat[];
  getGeneratedUserMemory: () => string;
  getWorkspaceSnapshot: (overrides?: Partial<AiWorkspaceSnapshot>) => AiWorkspaceSnapshot;
  flushWorkspace: (options: { snapshot: AiWorkspaceSnapshot }) => Promise<void>;
  setGeneratedUserMemory: (value: string | ((current: string) => string)) => void;
  setChats: (chats: Chat[] | ((current: Chat[]) => Chat[])) => void;
}

export function buildWorkspaceSnapshot(
  chats: Chat[],
  generatedUserMemory: string,
  currentProvider: ModelProvider,
  currentModel: string | null,
  visionMode: AiVisionMode,
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

export async function flushWorkspaceSnapshot(
  context: WorkspaceMemorySyncContext,
  chats = context.getChats(),
  generatedUserMemory = context.getGeneratedUserMemory(),
) {
  await context.flushWorkspace({
    snapshot: context.getWorkspaceSnapshot({ chats, generatedUserMemory }),
  });
}

export async function syncMemoryRefreshIntoWorkspace(
  context: WorkspaceMemorySyncContext,
  payload: AiMemoryRefreshResponse,
) {
  const nextChats = mergeMemoryRefreshIntoChats(context.getChats(), payload);
  context.setGeneratedUserMemory(payload.generatedUserMemory);
  context.setChats(nextChats);
  await flushWorkspaceSnapshot(context, nextChats, payload.generatedUserMemory);
  return nextChats;
}
