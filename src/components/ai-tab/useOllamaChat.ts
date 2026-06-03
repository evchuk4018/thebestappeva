import { useEffect, useEffectEvent, useState } from 'react';
import {
  appendMessage,
  createAssistantErrorMessage,
  createAssistantMessage,
  createNewChat,
  createUserMessage,
} from './helpers';
import { chatWithModel, listModels } from './ollama-client';
import { buildTurnFailureMessage, normalizeTurnError, replaceChat, updateChatMode } from './chat-helpers';
import { loadStoredChats, loadStoredEnabledTools, loadStoredSelectedModel, saveStoredChats, saveStoredEnabledTools, saveStoredSelectedModel } from './storage';
import { Chat, ChatMode, OllamaAvailability, OllamaModel } from './types';
import { buildPlainModelMessages } from './tools/prompting';
import { getToolRegistryEntries } from './tools/registry';
import { resolveThinkingTurn, ResolvedTurn } from './thinking-turn';

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

  function resolveToolId(functionName: string) {
    const entry = activeToolEntries.find(({ definition }) => definition.functions.some((candidate) => candidate.name === functionName));
    return entry?.definition.id ?? functionName;
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
    return resolveThinkingTurn({
      chat,
      model,
      activeToolEntries,
      onProgress: (nextChat) => setChats((currentChats) => replaceChat(currentChats, nextChat)),
      resolveToolId,
    });
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
