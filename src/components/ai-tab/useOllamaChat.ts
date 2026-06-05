import { useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  appendMessage,
  createAssistantCancelledMessage,
  createAssistantErrorMessage,
  createAssistantMessage,
  createNewChat,
  createUserMessage,
} from './helpers';
import { TurnAbortedError, isAbortError } from './abort-utils';
import { chatWithModel, listModels } from './ollama-client';
import { buildTurnCancelledMessage, buildTurnFailureMessage, normalizeTurnError, replaceChat, updateChatMode } from './chat-helpers';
import { BranchDirection, editUserMessageBranch, switchUserMessageBranch } from './message-branches';
import {
  loadStoredChats,
  loadStoredCustomSystemPrompt,
  loadStoredEnabledTools,
  loadStoredSelectedModel,
  saveStoredChats,
  saveStoredCustomSystemPrompt,
  saveStoredEnabledTools,
  saveStoredSelectedModel,
} from './storage';
import { SystemPromptContext } from './system-prompt';
import { Chat, ChatMode, OllamaAvailability, OllamaModel } from './types';
import { buildPlainModelMessages } from './tools/prompting';
import { getToolRegistryEntries } from './tools/registry';
import { resolveThinkingTurn, ResolvedTurn } from './thinking-turn';

export function useOllamaChat() {
  const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);
  const [availability, setAvailability] = useState<OllamaAvailability>('connecting');
  const [chats, setChats] = useState<Chat[]>(loadStoredChats);
  const [currentModel, setCurrentModel] = useState<string | null>(loadStoredSelectedModel);
  const [customSystemPrompt, setCustomSystemPrompt] = useState(loadStoredCustomSystemPrompt);
  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>(loadStoredEnabledTools);
  const [draftMode, setDraftMode] = useState<ChatMode>('thinking');
  const [isTyping, setIsTyping] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const activeTurnControllerRef = useRef<AbortController | null>(null);

  const toolRegistryEntries = getToolRegistryEntries();
  const tools = toolRegistryEntries.map(({ definition }) => ({
    ...definition,
    enabled: enabledTools[definition.id] ?? definition.enabledByDefault,
  }));
  const activeToolEntries = toolRegistryEntries.filter(({ definition }) => enabledTools[definition.id] ?? definition.enabledByDefault);
  const selectedChat = chats.find((chat) => chat.id === selectedChatId) ?? null;
  const chatMode = selectedChat?.mode ?? draftMode;
  const systemPromptContext: SystemPromptContext = {
    customPrompt: customSystemPrompt,
    mode: chatMode,
    tools: activeToolEntries.map(({ definition }) => definition),
  };

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
    saveStoredCustomSystemPrompt(customSystemPrompt);
  }, [customSystemPrompt]);

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

  useEffect(() => () => activeTurnControllerRef.current?.abort(new TurnAbortedError()), []);

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

  async function sendFlashReply(chat: Chat, model: string, promptContext: SystemPromptContext, signal?: AbortSignal): Promise<ResolvedTurn> {
    try {
      const reply = await chatWithModel(model, buildPlainModelMessages(chat.messages, promptContext), { think: false, signal });
      return {
        chat: appendMessage(chat, createAssistantMessage(reply.content, reply.model)),
        availability: 'ready',
        lastError: null,
      };
    } catch (error) {
      if (isAbortError(error)) {
        return {
          chat: appendMessage(chat, createAssistantCancelledMessage(buildTurnCancelledMessage(), model)),
          availability: 'ready',
          lastError: null,
        };
      }

      const clientError = normalizeTurnError(error);
      return {
        chat: appendMessage(chat, createAssistantErrorMessage(buildTurnFailureMessage(clientError), model)),
        availability: clientError.kind === 'connection' ? 'unavailable' : 'ready',
        lastError: clientError.message,
      };
    }
  }

  async function sendThinkingReply(chat: Chat, model: string, promptContext: SystemPromptContext, signal?: AbortSignal): Promise<ResolvedTurn> {
    return resolveThinkingTurn({
      chat,
      model,
      activeToolEntries,
      onProgress: (nextChat) => setChats((currentChats) => replaceChat(currentChats, nextChat)),
      promptContext,
      resolveToolId,
      signal,
    });
  }

  async function runModelTurn(baseChat: Chat, nextChatMode: ChatMode) {
    if (!currentModel || activeTurnControllerRef.current) {
      return;
    }

    setChats((currentChats) => replaceChat(currentChats, baseChat));
    setIsTyping(true);
    setLastError(null);
    const controller = new AbortController();
    activeTurnControllerRef.current = controller;

    try {
      const promptContext = {
        customPrompt: customSystemPrompt,
        mode: nextChatMode,
        tools: nextChatMode === 'thinking' ? activeToolEntries.map(({ definition }) => definition) : [],
      } satisfies SystemPromptContext;
      const resolvedTurn =
        nextChatMode === 'flash'
          ? await sendFlashReply(baseChat, currentModel, promptContext, controller.signal)
          : await sendThinkingReply(baseChat, currentModel, promptContext, controller.signal);
      setChats((currentChats) => replaceChat(currentChats, resolvedTurn.chat));
      setAvailability(resolvedTurn.availability);
      setLastError(resolvedTurn.lastError);
    } finally {
      if (activeTurnControllerRef.current === controller) {
        activeTurnControllerRef.current = null;
      }

      setIsTyping(false);
    }
  }

  async function sendMessage(content: string) {
    if (!currentModel || activeTurnControllerRef.current || !content.trim()) {
      return;
    }

    const userMessage = createUserMessage(content);
    const nextChatMode = chatMode;
    const baseChat = selectedChat ? appendMessage(selectedChat, userMessage) : createNewChat(userMessage, nextChatMode);

    if (!selectedChat) {
      setSelectedChatId(baseChat.id);
      setDraftMode('thinking');
    }

    await runModelTurn(baseChat, nextChatMode);
  }

  async function editAndResendMessage(messageId: string, nextContent: string) {
    if (!selectedChat || !currentModel || activeTurnControllerRef.current) return;

    const baseChat = editUserMessageBranch(selectedChat, messageId, nextContent);
    if (!baseChat) return;

    await runModelTurn(baseChat, selectedChat.mode);
  }

  function switchUserMessageVersion(messageId: string, direction: BranchDirection) {
    if (!selectedChatId || activeTurnControllerRef.current) {
      return;
    }

    setChats((currentChats) => {
      const chat = currentChats.find((candidate) => candidate.id === selectedChatId);
      return chat ? replaceChat(currentChats, switchUserMessageBranch(chat, messageId, direction)) : currentChats;
    });
  }

  function stopMessage() {
    activeTurnControllerRef.current?.abort(new TurnAbortedError());
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
    customSystemPrompt,
    deleteChat,
    editAndResendMessage,
    isTyping,
    lastError,
    refreshModels,
    setCustomSystemPrompt,
    selectChat,
    selectedChatId,
    sendMessage,
    systemPromptContext,
    setCurrentModel,
    stopMessage,
    toggleChatMode,
    toggleTool,
    switchUserMessageVersion,
    tools,
  };
}
