import type { AiMemoryRefreshResponse } from '../shared/ai-memory-contract';
import type { AssistantMessage, Chat, ModelChatMessage, UserMessage } from '../shared/ai-workspace-contract';
import { HttpError } from './http';
import { createAiWorkspaceRepository } from './db/ai-workspace-repository';
import { createOllamaProvider } from './model-providers/ollama';
import type { ModelProviderDefinition } from './model-providers/types';

const backgroundModel = 'qwen3.5:9b';

interface LatestExchange {
  userMessage: UserMessage;
  assistantMessage: AssistantMessage;
}

interface MemoryRepository {
  findChatById: (chatId: string) => Chat | null;
  loadGeneratedUserMemory: () => string;
  saveGeneratedUserMemory: (value: string) => void;
  updateChatSummary: (chatId: string, summary: string, summaryUpdatedAt: string | null) => Chat | null;
}

type MemoryModelProvider = Pick<ModelProviderDefinition, 'getStatus' | 'callChatStream'>;

function normalizeParagraphBoundedText(value: string, maxParagraphs: number) {
  const paragraphs = value
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .slice(0, maxParagraphs);
  return paragraphs.join('\n\n');
}

function buildExchangeBlock(exchange: LatestExchange) {
  return [
    `User (${exchange.userMessage.createdAt}):`,
    exchange.userMessage.content.trim() || '[No text content]',
    '',
    `Assistant (${exchange.assistantMessage.createdAt}):`,
    exchange.assistantMessage.content.trim() || '[No text content]',
  ].join('\n');
}

function buildMemoryMessages(priorMemory: string, exchange: LatestExchange): ModelChatMessage[] {
  return [
    {
      role: 'system',
      content: [
        'You maintain a hidden long-term user memory note for future chats.',
        'Rewrite the note using only durable user preferences, life facts, and ongoing projects.',
        'Exclude one-off task details, transient requests, and ephemeral troubleshooting steps.',
        'Return plain text only, at most 2 short paragraphs.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [`Existing memory:`, priorMemory || '[Empty]', '', `Latest completed exchange:`, buildExchangeBlock(exchange)].join('\n'),
    },
  ];
}

function buildSummaryMessages(priorSummary: string, exchange: LatestExchange): ModelChatMessage[] {
  return [
    {
      role: 'system',
      content: [
        'You maintain a rolling summary for one chat.',
        'Update the summary using the prior summary and the latest completed exchange.',
        'Preserve relevant decisions, user goals, ongoing threads, and unresolved follow-ups.',
        'Return plain text only, at most 3 short paragraphs.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [`Existing summary:`, priorSummary || '[Empty]', '', `Latest completed exchange:`, buildExchangeBlock(exchange)].join('\n'),
    },
  ];
}

async function isBackgroundModelAvailable(provider: MemoryModelProvider) {
  const status = await provider.getStatus();
  return status.option.status === 'ready' && status.models.some((model) => model.name === backgroundModel);
}

function isMeaningfulGeneratedText(value: string) {
  const trimmed = value.trim();
  return Boolean(trimmed) && trimmed !== 'The selected model returned an empty response.';
}

async function rewriteBoundedNote(
  provider: MemoryModelProvider,
  messages: ModelChatMessage[],
  maxParagraphs: number,
) {
  const reply = await provider.callChatStream({
    model: backgroundModel,
    messages,
    think: true,
  });
  const normalized = normalizeParagraphBoundedText(reply.content, maxParagraphs);
  return isMeaningfulGeneratedText(normalized) ? normalized : null;
}

export function extractLatestCompletedExchange(chat: Chat): LatestExchange | null {
  for (let index = chat.messages.length - 1; index >= 0; index -= 1) {
    const message = chat.messages[index];
    if (message.kind !== 'assistant' || message.status !== 'complete') {
      continue;
    }

    for (let priorIndex = index - 1; priorIndex >= 0; priorIndex -= 1) {
      const priorMessage = chat.messages[priorIndex];
      if (priorMessage.kind === 'user') {
        return { userMessage: priorMessage, assistantMessage: message };
      }
    }
  }

  return null;
}

export function createAiMemoryService(
  repository: MemoryRepository = createAiWorkspaceRepository(),
  provider: MemoryModelProvider = createOllamaProvider(),
  now: () => string = () => new Date().toISOString(),
) {
  return {
    async refreshChatMemory(chatId: string): Promise<AiMemoryRefreshResponse> {
      const chat = repository.findChatById(chatId);
      if (!chat) {
        throw new HttpError(404, `Chat "${chatId}" was not found.`);
      }

      const generatedUserMemory = repository.loadGeneratedUserMemory();
      const exchange = extractLatestCompletedExchange(chat);
      const priorSummary = chat.summary ?? '';
      const priorSummaryUpdatedAt = chat.summaryUpdatedAt ?? null;
      if (!exchange) {
        return {
          chatId,
          generatedUserMemory,
          summary: priorSummary,
          summaryUpdatedAt: priorSummaryUpdatedAt,
          memoryUpdated: false,
          summaryUpdated: false,
          memoryError: 'No completed exchange was available to learn from.',
          summaryError: 'No completed exchange was available to summarize.',
        };
      }

      if (!(await isBackgroundModelAvailable(provider))) {
        return {
          chatId,
          generatedUserMemory,
          summary: priorSummary,
          summaryUpdatedAt: priorSummaryUpdatedAt,
          memoryUpdated: false,
          summaryUpdated: false,
          memoryError: `${backgroundModel} is unavailable in local Ollama.`,
          summaryError: `${backgroundModel} is unavailable in local Ollama.`,
        };
      }

      let nextMemory = generatedUserMemory;
      let nextSummary = priorSummary;
      let nextSummaryUpdatedAt = priorSummaryUpdatedAt;
      let memoryUpdated = false;
      let summaryUpdated = false;
      let memoryError: string | undefined;
      let summaryError: string | undefined;

      try {
        const rewrittenMemory = await rewriteBoundedNote(provider, buildMemoryMessages(generatedUserMemory, exchange), 2);
        if (!rewrittenMemory) {
          memoryError = 'The background model returned no usable memory update.';
        } else if (rewrittenMemory !== generatedUserMemory) {
          repository.saveGeneratedUserMemory(rewrittenMemory);
          nextMemory = rewrittenMemory;
          memoryUpdated = true;
        }
      } catch (error) {
        memoryError = error instanceof Error ? error.message : 'Unable to refresh generated user memory.';
      }

      try {
        const rewrittenSummary = await rewriteBoundedNote(provider, buildSummaryMessages(priorSummary, exchange), 3);
        if (!rewrittenSummary) {
          summaryError = 'The background model returned no usable chat summary.';
        } else if (rewrittenSummary !== priorSummary) {
          nextSummaryUpdatedAt = now();
          repository.updateChatSummary(chatId, rewrittenSummary, nextSummaryUpdatedAt);
          nextSummary = rewrittenSummary;
          summaryUpdated = true;
        }
      } catch (error) {
        summaryError = error instanceof Error ? error.message : 'Unable to refresh the chat summary.';
      }

      return {
        chatId,
        generatedUserMemory: nextMemory,
        summary: nextSummary,
        summaryUpdatedAt: nextSummaryUpdatedAt,
        memoryUpdated,
        summaryUpdated,
        memoryError,
        summaryError,
      };
    },
  };
}
