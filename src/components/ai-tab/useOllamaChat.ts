import { useEffect, useEffectEvent, useState } from 'react';
import { appendMessage, createAssistantMessage, createNewChat, createToolCallMessage, createToolResultMessage, createUserMessage } from './helpers';
import { chatWithModel, listModels } from './ollama-client';
import { loadStoredChats, loadStoredEnabledTools, loadStoredSelectedModel, saveStoredChats, saveStoredEnabledTools, saveStoredSelectedModel } from './storage';
import { Chat, OllamaAvailability, OllamaModel } from './types';
import { MAX_TOOL_CALL_DEPTH, executeToolInvocation } from './tools/executor';
import { parseToolCall } from './tools/parser';
import { buildModelMessages } from './tools/prompting';
import { getToolRegistryEntries } from './tools/registry';

function replaceChat(currentChats: Chat[], nextChat: Chat) {
  const hasChat = currentChats.some((chat) => chat.id === nextChat.id);
  if (!hasChat) {
    return [nextChat, ...currentChats];
  }

  return currentChats.map((chat) => (chat.id === nextChat.id ? nextChat : chat));
}

export function useOllamaChat() {
  const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);
  const [availability, setAvailability] = useState<OllamaAvailability>('connecting');
  const [chats, setChats] = useState<Chat[]>(loadStoredChats);
  const [currentModel, setCurrentModel] = useState<string | null>(loadStoredSelectedModel);
  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>(loadStoredEnabledTools);
  const [isTyping, setIsTyping] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const toolRegistryEntries = getToolRegistryEntries();
  const tools = toolRegistryEntries.map(({ definition }) => ({
    ...definition,
    enabled: enabledTools[definition.id] ?? definition.enabledByDefault,
  }));
  const activeToolEntries = toolRegistryEntries.filter(({ definition }) => enabledTools[definition.id] ?? definition.enabledByDefault);

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

  async function sendMessage(content: string) {
    if (!currentModel || isTyping || !content.trim()) {
      return;
    }

    const userMessage = createUserMessage(content);
    let workingChat: Chat | null = null;
    let nextChatId = selectedChatId;

    if (!selectedChatId) {
      workingChat = createNewChat(userMessage);
      nextChatId = workingChat.id;
      setChats((currentChats) => replaceChat(currentChats, workingChat as Chat));
      setSelectedChatId(workingChat.id);
    } else {
      const activeChat = chats.find((chat) => chat.id === selectedChatId);
      if (!activeChat) {
        return;
      }

      workingChat = appendMessage(activeChat, userMessage);
      setChats((currentChats) => replaceChat(currentChats, workingChat as Chat));
    }

    setIsTyping(true);
    setLastError(null);

    try {
      let toolCallCount = 0;

      while (workingChat) {
        const reply = await chatWithModel(currentModel, buildModelMessages(workingChat.messages, activeToolEntries));
        const parsedToolCall = parseToolCall(reply.content);

        if (!parsedToolCall) {
          const assistantMessage = createAssistantMessage(reply.content, reply.model);
          workingChat = appendMessage(workingChat, assistantMessage);
          setChats((currentChats) => replaceChat(currentChats, workingChat as Chat));
          setAvailability('ready');
          break;
        }

        if (toolCallCount >= MAX_TOOL_CALL_DEPTH) {
          const assistantMessage = createAssistantMessage(
            'I hit the local tool-call limit for this turn. Please narrow the request or ask a follow-up.',
            reply.model,
          );
          workingChat = appendMessage(workingChat, assistantMessage);
          setChats((currentChats) => replaceChat(currentChats, workingChat as Chat));
          break;
        }

        const invocation = {
          toolId: parsedToolCall.tool,
          functionName: parsedToolCall.function,
          args: parsedToolCall.arguments ?? {},
          createdAt: new Date().toISOString(),
        };

        workingChat = appendMessage(workingChat, createToolCallMessage(invocation));
        setChats((currentChats) => replaceChat(currentChats, workingChat as Chat));

        const result = await executeToolInvocation(invocation, activeToolEntries);
        workingChat = appendMessage(workingChat, createToolResultMessage(result));
        setChats((currentChats) => replaceChat(currentChats, workingChat as Chat));
        toolCallCount += 1;
      }

      if (nextChatId) {
        setSelectedChatId(nextChatId);
      }
      setAvailability('ready');
    } catch (error) {
      setAvailability('unavailable');
      setLastError(error instanceof Error ? error.message : 'Unable to reach local Ollama.');
    } finally {
      setIsTyping(false);
    }
  }

  function deleteChat(chatId: string) {
    setChats((currentChats) => currentChats.filter((chat) => chat.id !== chatId));
    if (selectedChatId === chatId) {
      setSelectedChatId(null);
    }
  }

  function toggleTool(toolId: string, enabled: boolean) {
    setEnabledTools((current) => ({ ...current, [toolId]: enabled }));
  }

  return {
    availableModels,
    availability,
    chats,
    currentModel,
    deleteChat,
    isTyping,
    lastError,
    refreshModels,
    selectedChatId,
    sendMessage,
    setCurrentModel,
    setSelectedChatId,
    toggleTool,
    tools,
  };
}
