import { refreshAiChatMemory } from '../../../lib/ai-memory-storage';
import type { Chat } from '../types';
import { flushWorkspaceSnapshot, syncMemoryRefreshIntoWorkspace, type WorkspaceMemorySyncContext } from '../workspace-memory-sync';
import type { ToolRegistryEntry, ToolResult } from './types';

const RECENT_CHAT_LIMIT = 10;
const DEFAULT_SEARCH_LIMIT = 5;

interface ChatContextToolOptions extends WorkspaceMemorySyncContext {
  activeChatId: string | null;
}

interface RecentChatRecord {
  chatId: string;
  title: string;
  updatedAt: string;
  hasSummary: boolean;
  summaryUpdatedAt: string | null;
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeLimit(value: unknown, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.min(RECENT_CHAT_LIMIT, Math.round(value)));
}

function requireString(value: unknown, message: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(message);
  }

  return value.trim();
}

function toRecentChatRecord(chat: Chat): RecentChatRecord {
  return {
    chatId: chat.id,
    title: chat.title,
    updatedAt: chat.updatedAt,
    hasSummary: Boolean(chat.summary?.trim()),
    summaryUpdatedAt: chat.summaryUpdatedAt ?? null,
  };
}

function buildRecentChatPool(chats: Chat[], activeChatId: string | null) {
  return chats
    .filter((chat) => chat.id !== activeChatId)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, RECENT_CHAT_LIMIT);
}

function buildError(toolId: string, functionName: string, message: string, data?: Record<string, unknown>): ToolResult {
  return {
    toolId,
    functionName,
    ok: false,
    summary: message,
    error: message,
    data,
  };
}

function createRecentChatsTool(options: ChatContextToolOptions): ToolRegistryEntry {
  return {
    definition: {
      id: 'recent-chats',
      label: 'Recent Chats',
      alias: '/recent-chats',
      description: 'Lists the 10 most recent past chats by title so the model can reuse prior context.',
      enabledByDefault: true,
      functions: [
        {
          name: 'list_recent_chats',
          description: 'List up to 10 recent past chats by title, newest first.',
          parameters: [{ name: 'limit', type: 'number', description: 'Optional maximum result count, from 1 to 10.' }],
        },
      ],
    },
    async execute(invocation) {
      const limit = normalizeLimit(invocation.args.limit, RECENT_CHAT_LIMIT);
      const chats = buildRecentChatPool(options.getChats(), options.activeChatId).slice(0, limit).map(toRecentChatRecord);
      return {
        toolId: invocation.toolId,
        functionName: invocation.functionName,
        ok: true,
        summary: `Loaded ${chats.length} recent past chat${chats.length === 1 ? '' : 's'}.`,
        data: { chats, limit, resultCount: chats.length },
      };
    },
  };
}

function createChatTitleSearchTool(options: ChatContextToolOptions): ToolRegistryEntry {
  return {
    definition: {
      id: 'chat-title-search',
      label: 'Chat Title Search',
      alias: '/chat-title-search',
      description: 'Searches recent past chat titles by name inside the recent-chat pool.',
      enabledByDefault: true,
      functions: [
        {
          name: 'search_chat_titles',
          description: 'Search recent past chat titles by case-insensitive name match.',
          parameters: [
            { name: 'query', type: 'string', description: 'Title text to search for.', required: true },
            { name: 'limit', type: 'number', description: 'Optional maximum result count, from 1 to 10.' },
          ],
        },
      ],
    },
    async execute(invocation) {
      try {
        const query = requireString(invocation.args.query, 'search_chat_titles requires a non-empty `query` argument.');
        const limit = normalizeLimit(invocation.args.limit, DEFAULT_SEARCH_LIMIT);
        const normalizedQuery = normalizeText(query);
        const chats = buildRecentChatPool(options.getChats(), options.activeChatId)
          .filter((chat) => normalizeText(chat.title).includes(normalizedQuery))
          .slice(0, limit)
          .map(toRecentChatRecord);

        return {
          toolId: invocation.toolId,
          functionName: invocation.functionName,
          ok: true,
          summary: chats.length
            ? `Found ${chats.length} recent chat${chats.length === 1 ? '' : 's'} matching "${query}".`
            : `No recent chat titles matched "${query}".`,
          data: { chats, limit, query, resultCount: chats.length },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Chat title search failed.';
        return buildError(invocation.toolId, invocation.functionName, message);
      }
    },
  };
}

function createChatSummaryTool(options: ChatContextToolOptions): ToolRegistryEntry {
  return {
    definition: {
      id: 'chat-summary',
      label: 'Chat Summary',
      alias: '/chat-summary',
      description: 'Loads one saved chat summary, generating it through the background memory-refresh flow when needed.',
      enabledByDefault: true,
      functions: [
        {
          name: 'get_chat_summary',
          description: 'Return the summary for a selected chat id.',
          parameters: [{ name: 'chatId', type: 'string', description: 'Chat id to load.', required: true }],
        },
      ],
    },
    async execute(invocation) {
      try {
        const chatId = requireString(invocation.args.chatId, 'get_chat_summary requires a non-empty `chatId` argument.');
        const chat = options.getChats().find((candidate) => candidate.id === chatId);
        if (!chat) {
          return buildError(invocation.toolId, invocation.functionName, `Chat "${chatId}" was not found.`);
        }

        if (chat.summary?.trim()) {
          return {
            toolId: invocation.toolId,
            functionName: invocation.functionName,
            ok: true,
            summary: `Loaded saved summary for "${chat.title}".`,
            data: {
              chatId: chat.id,
              title: chat.title,
              summary: chat.summary,
              summaryUpdatedAt: chat.summaryUpdatedAt ?? null,
              source: 'stored',
            },
          };
        }

        await flushWorkspaceSnapshot(options);
        const payload = await refreshAiChatMemory(chat.id);
        const nextChats = await syncMemoryRefreshIntoWorkspace(options, payload);
        const refreshedChat = nextChats.find((candidate) => candidate.id === chat.id);

        if (payload.summary.trim()) {
          return {
            toolId: invocation.toolId,
            functionName: invocation.functionName,
            ok: true,
            summary: `Generated summary for "${chat.title}".`,
            data: {
              chatId: chat.id,
              title: chat.title,
              summary: payload.summary,
              summaryUpdatedAt: payload.summaryUpdatedAt,
              source: 'generated',
              generatedUserMemory: payload.generatedUserMemory,
              hasPersistedSummary: Boolean(refreshedChat?.summary?.trim()),
            },
          };
        }

        return buildError(
          invocation.toolId,
          invocation.functionName,
          payload.summaryError || `No summary is available for "${chat.title}".`,
          {
            chatId: chat.id,
            title: chat.title,
            summaryUpdatedAt: payload.summaryUpdatedAt,
            generatedUserMemory: payload.generatedUserMemory,
          },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Chat summary lookup failed.';
        return buildError(invocation.toolId, invocation.functionName, message);
      }
    },
  };
}

export function createChatContextToolEntries(options: ChatContextToolOptions) {
  return [
    createRecentChatsTool(options),
    createChatTitleSearchTool(options),
    createChatSummaryTool(options),
  ];
}
