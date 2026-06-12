import type { Chat, ModelProvider } from './types';
import type { SystemPromptContext } from './system-prompt';
import type { ToolRegistryEntry } from './tools/types';
import { resolveThinkingTurn, type ResolvedTurn } from './thinking-turn';

function resolveToolId(functionName: string, entries: ToolRegistryEntry[]) {
  return entries.find(({ definition }) => definition.functions.some((candidate) => candidate.name === functionName))?.definition.id ?? functionName;
}

function findLatestAssistantMessageId(chat: Chat) {
  return [...chat.messages].reverse().find((message) => message.kind === 'assistant')?.id ?? null;
}

export async function sendThinkingReply(
  chat: Chat,
  provider: ModelProvider,
  model: string,
  promptContext: SystemPromptContext,
  entries: ToolRegistryEntry[],
  onProgress: (nextChat: Chat, assistantMessageId: string | null) => void,
  assistantMessageId?: string | null,
  signal?: AbortSignal,
): Promise<ResolvedTurn> {
  return resolveThinkingTurn({
    assistantMessageId,
    chat,
    model,
    provider,
    activeToolEntries: entries,
    onProgress: (nextChat) => onProgress(nextChat, findLatestAssistantMessageId(nextChat)),
    promptContext,
    resolveToolId: (functionName) => resolveToolId(functionName, entries),
    signal,
  });
}
