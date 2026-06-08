import { useEffect, useRef, useState } from 'react';
import {
  appendMessage,
  createAssistantCancelledMessage,
  createAssistantErrorMessage,
  createAssistantMessage,
  createNewChat,
  createUserMessage,
} from './helpers';
import { TurnAbortedError, isAbortError } from './abort-utils';
import { chatWithModel } from './ollama-client';
import { buildTurnCancelledMessage, buildTurnFailureMessage, normalizeTurnError, replaceChat, updateChatMode } from './chat-helpers';
import { BranchDirection, editUserMessageBranch, regenerateAssistantBranch, switchUserMessageBranch } from './message-branches';
import { SystemPromptContext } from './system-prompt';
import { AiAttachmentReference, Chat, ChatMode } from './types';
import { buildPlainModelMessages } from './tools/prompting';
import { getToolRegistryEntries } from './tools/registry';
import { useOllamaModelState } from './useOllamaModelState';
import { useAiWorkspacePersistence } from './useAiWorkspacePersistence';
import { resolveThinkingTurn, ResolvedTurn } from './thinking-turn';

const DEFAULT_ATTACHMENT_PROMPT = 'Please analyze the attached documents.';

export function useOllamaChat() {
  const [draftMode, setDraftMode] = useState<ChatMode>('thinking');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const activeTurnControllerRef = useRef<AbortController | null>(null);
  const {
    chats,
    currentModel,
    customSystemPrompt,
    enabledTools,
    hydrationStatus,
    persistenceError,
    setChats,
    setCurrentModel,
    setCustomSystemPrompt,
    setEnabledTools,
    flushWorkspace,
  } = useAiWorkspacePersistence();
  const {
    availableModels,
    availability,
    lastError,
    refreshModels,
    setAvailability,
    setLastError,
  } = useOllamaModelState({ currentModel, hydrationStatus, setCurrentModel });

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

  useEffect(() => () => activeTurnControllerRef.current?.abort(new TurnAbortedError()), []);
  useEffect(() => {
    if (!isTyping) {
      void flushWorkspace();
    }
  }, [flushWorkspace, isTyping]);

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
      const reply = await chatWithModel(model, await buildPlainModelMessages(chat.messages, promptContext), { think: false, signal });
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

  async function sendMessage(content: string, attachments: AiAttachmentReference[] = []) {
    const normalizedContent = content.trim() || (attachments.length ? DEFAULT_ATTACHMENT_PROMPT : '');
    if (!currentModel || activeTurnControllerRef.current || !normalizedContent) {
      return;
    }

    const userMessage = createUserMessage(normalizedContent, attachments);
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

  async function regenerateAssistantMessage(messageId: string) {
    if (!selectedChat || !currentModel || activeTurnControllerRef.current) {
      return;
    }

    const baseChat = regenerateAssistantBranch(selectedChat, messageId);
    if (!baseChat) {
      return;
    }

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
    hydrationStatus,
    isTyping,
    lastError,
    persistenceError,
    regenerateAssistantMessage,
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
