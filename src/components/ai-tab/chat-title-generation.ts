import { createChatTitle } from './helpers';
import { streamChatWithModel } from './ollama-client';
import type { Chat, RuntimeProviderOption } from './types';

export const CHAT_TITLE_MAX_CHARS = 48;
export const CHAT_TITLE_MAX_OUTPUT_TOKENS = 24;

const TITLE_PROMPT_MAX_CHARS = 600;
const TITLE_SYSTEM_PROMPT = [
  'Create a concise title for this chat based on the first user prompt and first assistant reply.',
  `Return only the title, with no quotes, no markdown, and no more than ${CHAT_TITLE_MAX_CHARS} characters.`,
].join(' ');

export interface ChatTitleGenerationCandidate {
  chatId: string;
  fingerprint: string;
  fallbackTitle: string;
  prompt: string;
}

function buildFingerprint(chat: Chat) {
  const [firstUserMessage, firstAssistantMessage] = chat.messages;
  return [
    chat.id,
    firstUserMessage?.id ?? '',
    firstUserMessage?.content ?? '',
    firstAssistantMessage?.id ?? '',
    firstAssistantMessage?.content ?? '',
  ].join('::');
}

function normalizePromptExcerpt(value: string) {
  const compact = value.trim().replace(/\s+/g, ' ');
  if (compact.length <= TITLE_PROMPT_MAX_CHARS) {
    return compact;
  }

  return `${compact.slice(0, TITLE_PROMPT_MAX_CHARS - 1).trim()}...`;
}

function stripWrappingQuotes(value: string) {
  let normalized = value.trim();
  const quotePairs: Array<[string, string]> = [['"', '"'], ["'", "'"], ['“', '”'], ['‘', '’']];

  for (const [start, end] of quotePairs) {
    while (normalized.startsWith(start) && normalized.endsWith(end) && normalized.length > start.length + end.length) {
      normalized = normalized.slice(start.length, normalized.length - end.length).trim();
    }
  }

  return normalized;
}

function stripTrailingNoise(value: string) {
  return value.replace(/[\s"'`’”.,!?;:]+$/g, '').trim();
}

function trimToLength(value: string, maxChars: number) {
  if (value.length <= maxChars) {
    return value;
  }

  return stripTrailingNoise(value.slice(0, maxChars).trim());
}

export function buildChatTitlePrompt(chat: Chat) {
  const [firstUserMessage, firstAssistantMessage] = chat.messages;
  return [
    `User: ${normalizePromptExcerpt(firstUserMessage?.content || '')}`,
    `Assistant: ${normalizePromptExcerpt(firstAssistantMessage?.content || 'No reply text.')}`,
  ].join('\n');
}

export function normalizeGeneratedChatTitle(rawTitle: string, maxChars = CHAT_TITLE_MAX_CHARS) {
  const strippedTitle = stripWrappingQuotes(rawTitle.trim());
  const withoutPrefix = strippedTitle.replace(/^title:\s*/i, '');
  const normalized = trimToLength(
    stripTrailingNoise(withoutPrefix.replace(/\s+/g, ' ')),
    maxChars,
  );
  return normalized || null;
}

export function getChatTitleGenerationCandidate(chat: Chat): ChatTitleGenerationCandidate | null {
  if (chat.titleStatus !== 'pending' || chat.messages.length !== 2) {
    return null;
  }

  const [firstUserMessage, firstAssistantMessage] = chat.messages;
  if (firstUserMessage?.kind !== 'user' || firstAssistantMessage?.kind !== 'assistant') {
    return null;
  }
  if (firstAssistantMessage.status !== 'complete') {
    return null;
  }

  return {
    chatId: chat.id,
    fingerprint: buildFingerprint(chat),
    fallbackTitle: chat.title || createChatTitle(firstUserMessage.content),
    prompt: buildChatTitlePrompt(chat),
  };
}

export function finalizeChatTitleGeneration(
  chat: Chat,
  candidate: ChatTitleGenerationCandidate,
  rawTitle: string | null,
): Chat {
  if (chat.id !== candidate.chatId || chat.titleStatus !== 'pending') {
    return chat;
  }

  if (buildFingerprint(chat) !== candidate.fingerprint) {
    return {
      ...chat,
      titleStatus: 'finalized',
    };
  }

  const generatedTitle = rawTitle ? normalizeGeneratedChatTitle(rawTitle) : null;
  if (!generatedTitle) {
    return {
      ...chat,
      title: candidate.fallbackTitle,
      titleStatus: 'finalized',
    };
  }

  return {
    ...chat,
    title: generatedTitle,
    titleStatus: 'generated',
  };
}

export function resolveChatTitleGenerationModel(providerOptions: RuntimeProviderOption[]) {
  return providerOptions.find((option) => option.value === 'deepseek')?.defaultModel ?? null;
}

export async function requestGeneratedChatTitle(candidate: ChatTitleGenerationCandidate, model: string) {
  try {
    const reply = await streamChatWithModel(
      model,
      [
        { role: 'system', content: TITLE_SYSTEM_PROMPT },
        { role: 'user', content: candidate.prompt },
      ],
      {
        provider: 'deepseek',
        think: false,
        runtimeOptions: {
          maxOutputTokens: CHAT_TITLE_MAX_OUTPUT_TOKENS,
          temperature: 0.2,
        },
      },
    );
    return normalizeGeneratedChatTitle(reply.content);
  } catch {
    return null;
  }
}
