import { useEffect, useEffectEvent, useState } from 'react';
import {
  appendMessage,
  createAssistantErrorMessage,
  createAssistantMessage,
  createNewChat,
  createToolCallMessage,
  createToolResultMessage,
  createUserMessage,
} from './helpers';
import { chatWithModel, listModels, OllamaClientError } from './ollama-client';
import { loadStoredChats, loadStoredEnabledTools, loadStoredSelectedModel, saveStoredChats, saveStoredEnabledTools, saveStoredSelectedModel } from './storage';
import { Chat, ChatMode, OllamaAvailability, OllamaModel } from './types';
import { MAX_TOOL_CALL_DEPTH, executeToolInvocation } from './tools/executor';
import { parseToolCall } from './tools/parser';
import { buildModelMessages, buildPlainModelMessages } from './tools/prompting';
import { getToolRegistryEntries } from './tools/registry';

function replaceChat(currentChats: Chat[], nextChat: Chat) {
  const hasChat = currentChats.some((chat) => chat.id === nextChat.id);
  if (!hasChat) {
    return [nextChat, ...currentChats];
  }

  return currentChats.map((chat) => (chat.id === nextChat.id ? nextChat : chat));
}

function updateChatMode(currentChats: Chat[], chatId: string, mode: ChatMode) {
  return currentChats.map((chat) => (chat.id === chatId ? { ...chat, mode } : chat));
}

interface ResolvedTurn {
  chat: Chat;
  availability: OllamaAvailability;
  lastError: string | null;
}

function buildTurnFailureMessage(error: OllamaClientError) {
  if (error.kind === 'connection') {
    return 'I could not reach the local Ollama runtime for this turn. Check that Ollama is still running, then try again.';
  }

  return `I hit a local runtime error before I could finish this reply.\n\n${error.message}`;
}

function normalizeTurnError(error: unknown) {
  if (error instanceof OllamaClientError) {
    return error;
  }

  if (error instanceof Error) {
    return new OllamaClientError(error.message, 'response');
  }

  return new OllamaClientError('Unable to complete this reply.', 'response');
}

export function useOllamaChat() {
  const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);
  const [availability, setAvailability] = useState<OllamaAvailability>('connecting');
  const [chats, setChats] = useState<Chat[]>(loadStoredChats);
  const [currentModel, setCurrentModel] = useState<string | null>(loadStoredSelectedModel);
  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>(loadStoredEnabledTools);
  const [draftMode, setDraftMode] = useState<ChatMode>('thinking');
  const [isTyping, setIsTyping] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const toolRegistryEntries = getToolRegistryEntries();
  const tools = toolRegistryEntries.map(({ definition }) => ({
    ...definition,
    enabled: enabledTools[definition.id] ?? definition.enabledByDefault,
  }));
  const activeToolEntries = toolRegistryEntries.filter(({ definition }) => enabledTools[definition.id] ?? definition.enabledByDefault);
  const selectedChat = chats.find((chat) => chat.id === selectedChatId) ?? null;
  const chatMode = selectedChat?.mode ?? draftMode;

  async function refreshModels(preferredModel?: string | null) {
    try {
      const discoveredModels = await listModels();
      setAvailableModels(discoveredModels);

      if (discoveredModels.length === 0) {
        setAvailability('no-models');
        setCurrentModel(null);
        setLastError(null);
        return discoveredModels;
      }

      const preferred = preferredModel ?? currentModel;
      const nextModel = discoveredModels.some((model) => model.name === preferred) ? preferred : discoveredModels[0].name;

      setAvailability('ready');
      setCurrentModel(nextModel);
      setLastError(null);
      return discoveredModels;
    } catch (error) {
      setAvailability('unavailable');
      setLastError(error instanceof Error ? error.message : 'Unable to reach local Ollama.');
      return [] as OllamaModel[];
    }
  }

  const refreshModelsOnEffect = useEffectEvent((preferredModel?: string | null) => {
    void refreshModels(preferredModel);
  });

  useEffect(() => {
    void refreshModels();
  }, []);

  useEffect(() => {
    saveStoredChats(chats);
  }, [chats]);

  useEffect(() => {
    saveStoredSelectedModel(currentModel);
  }, [currentModel]);

  useEffect(() => {
    saveStoredEnabledTools(enabledTools);
  }, [enabledTools]);

  useEffect(() => {
    const onFocus = () => refreshModelsOnEffect();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshModelsOnEffect]);

  useEffect(() => {
    if (availability === 'ready') {
      return;
    }

    const intervalId = window.setInterval(() => refreshModelsOnEffect(), 10000);
    return () => window.clearInterval(intervalId);
  }, [availability, refreshModelsOnEffect]);

  function selectChat(chatId: string | null) {
    setSelectedChatId(chatId);
    if (!chatId) {
      setDraftMode('thinking');
    }
  }

  function setChatMode(mode: ChatMode) {
    if (selectedChatId) {
      setChats((currentChats) => updateChatMode(currentChats, selectedChatId, mode));
      return;
    }

    setDraftMode(mode);
  }

  function toggleChatMode() {
    setChatMode(chatMode === 'thinking' ? 'flash' : 'thinking');
  }

  async function sendFlashReply(chat: Chat, model: string): Promise<ResolvedTurn> {
    try {
      const reply = await chatWithModel(model, buildPlainModelMessages(chat.messages), { think: false });
      return {
        chat: appendMessage(chat, createAssistantMessage(reply.content, reply.model)),
        availability: 'ready',
        lastError: null,
      };
    } catch (error) {
      const clientError = normalizeTurnError(error);
      return {
        chat: appendMessage(chat, createAssistantErrorMessage(buildTurnFailureMessage(clientError), model)),
        availability: clientError.kind === 'connection' ? 'unavailable' : 'ready',
        lastError: clientError.message,
      };
    }
  }

  async function sendThinkingReply(chat: Chat, model: string): Promise<ResolvedTurn> {
    let workingChat = chat;
    let toolCallCount = 0;

    while (true) {
      let reply;
      try {
        reply = await chatWithModel(model, buildModelMessages(workingChat.messages, activeToolEntries), { think: true });
      } catch (error) {
        const clientError = normalizeTurnError(error);
        return {
          chat: appendMessage(workingChat, createAssistantErrorMessage(buildTurnFailureMessage(clientError), model)),
          availability: clientError.kind === 'connection' ? 'unavailable' : 'ready',
          lastError: clientError.message,
        };
      }

      const parsedToolCall = parseToolCall(reply.content);

      if (!parsedToolCall) {
        return {
          chat: appendMessage(workingChat, createAssistantMessage(reply.content, reply.model, reply.thinking)),
          availability: 'ready',
          lastError: null,
        };
      }

      if (toolCallCount >= MAX_TOOL_CALL_DEPTH) {
        return {
          chat: appendMessage(
            workingChat,
            createAssistantErrorMessage('I hit the local tool-call limit for this turn. Please narrow the request or ask a follow-up.', reply.model),
          ),
          availability: 'ready',
          lastError: 'Tool-call limit reached for this turn.',
        };
      }

      const invocation = {
        toolId: parsedToolCall.tool,
        functionName: parsedToolCall.function,
        args: parsedToolCall.arguments ?? {},
        createdAt: new Date().toISOString(),
      };

      workingChat = appendMessage(workingChat, createToolCallMessage(invocation));
      setChats((currentChats) => replaceChat(currentChats, workingChat));

      const result = await executeToolInvocation(invocation, activeToolEntries);
      workingChat = appendMessage(workingChat, createToolResultMessage(result));
      setChats((currentChats) => replaceChat(currentChats, workingChat));
      toolCallCount += 1;
    }
  }

  async function sendMessage(content: string) {
    if (!currentModel || isTyping || !content.trim()) {
      return;
    }

    const userMessage = createUserMessage(content);
    const nextChatMode = chatMode;
    const baseChat = selectedChat ? appendMessage(selectedChat, userMessage) : createNewChat(userMessage, nextChatMode);

    if (!selectedChat) {
      setSelectedChatId(baseChat.id);
      setDraftMode('thinking');
    }

    setChats((currentChats) => replaceChat(currentChats, baseChat));
    setIsTyping(true);
    setLastError(null);

    const resolvedTurn = nextChatMode === 'flash' ? await sendFlashReply(baseChat, currentModel) : await sendThinkingReply(baseChat, currentModel);
    setChats((currentChats) => replaceChat(currentChats, resolvedTurn.chat));
    setAvailability(resolvedTurn.availability);
    setLastError(resolvedTurn.lastError);
    setIsTyping(false);
  }

  function deleteChat(chatId: string) {
    setChats((currentChats) => currentChats.filter((chat) => chat.id !== chatId));
    if (selectedChatId === chatId) {
      selectChat(null);
    }
  }

  function toggleTool(toolId: string, enabled: boolean) {
    setEnabledTools((current) => ({ ...current, [toolId]: enabled }));
  }

  return {
    availableModels,
    availability,
    chatMode,
    chats,
    currentModel,
    deleteChat,
    isTyping,
    lastError,
    refreshModels,
    selectChat,
    selectedChatId,
    sendMessage,
    setCurrentModel,
    toggleChatMode,
    toggleTool,
    tools,
  };
}
