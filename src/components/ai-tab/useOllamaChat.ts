import { useEffect, useRef, useState } from 'react';
import {
  appendMessage,
  createAssistantCancelledMessage,
  createAssistantErrorMessage,
  createAssistantMessage,
  createNewChat,
  createUserMessage,
  upsertMessage,
} from './helpers';
import { TurnAbortedError, isAbortError } from './abort-utils';
import { buildTurnCancelledMessage, buildTurnFailureMessage, normalizeTurnError, replaceChat, updateChatMode } from './chat-helpers';
import { sendFlashTurn } from './flash-turn';
import { LiveChatState, resolveActiveChat, shouldShowTypingIndicator } from './live-turn';
import { BranchDirection, editUserMessageBranch, regenerateAssistantBranch, switchUserMessageBranch } from './message-branches';
import { SystemPromptContext } from './system-prompt';
import { AiAttachmentReference, Chat, ChatMode } from './types';
import { collectLongPdfAttachments, createPdfReaderTool } from './tools/pdf-reader-tool';
import { getToolRegistryEntries } from './tools/registry';
import { ToolRegistryEntry } from './tools/types';
import { useOllamaModelState } from './useOllamaModelState';
import { useAiWorkspacePersistence } from './useAiWorkspacePersistence';
import { resolveThinkingTurn, ResolvedTurn } from './thinking-turn';

const DEFAULT_ATTACHMENT_PROMPT = 'Please analyze the attached documents.';

export function useOllamaChat() {
  const [draftMode, setDraftMode] = useState<ChatMode>('thinking');
  const [isTyping, setIsTyping] = useState(false);
  const [liveChat, setLiveChat] = useState<LiveChatState | null>(null);
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
  const persistedSelectedChat = chats.find((chat) => chat.id === selectedChatId) ?? null;
  const selectedLiveChat = liveChat?.chatId === selectedChatId ? liveChat : null;
  const selectedChat = resolveActiveChat(persistedSelectedChat, selectedLiveChat);
  const selectedPdfAttachments = persistedSelectedChat ? collectLongPdfAttachments(persistedSelectedChat.messages) : [];
  const selectedPdfTool = createPdfReaderTool(selectedPdfAttachments);
  const tools = toolRegistryEntries.map(({ definition }) => ({
    ...definition,
    enabled: enabledTools[definition.id] ?? definition.enabledByDefault,
  })).concat([{ ...selectedPdfTool.definition, enabled: selectedPdfAttachments.length > 0 }]);
  const activeToolEntries = getActiveToolEntries(persistedSelectedChat);
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

  function getActiveToolEntries(chat: Chat | null) {
    const enabledEntries = toolRegistryEntries.filter(
      ({ definition }) => enabledTools[definition.id] ?? definition.enabledByDefault,
    );
    const pdfAttachments = chat ? collectLongPdfAttachments(chat.messages) : [];
    return pdfAttachments.length ? [...enabledEntries, createPdfReaderTool(pdfAttachments)] : enabledEntries;
  }

  function resolveToolId(functionName: string, entries: ToolRegistryEntry[]) {
    const entry = entries.find(({ definition }) => definition.functions.some((candidate) => candidate.name === functionName));
    return entry?.definition.id ?? functionName;
  }

  function findLatestAssistantMessageId(chat: Chat) {
    return [...chat.messages].reverse().find((message) => message.kind === 'assistant')?.id ?? null;
  }

  async function sendThinkingReply(
    chat: Chat,
    model: string,
    promptContext: SystemPromptContext,
    entries: ToolRegistryEntry[],
    onProgress: (nextChat: Chat, assistantMessageId: string | null) => void,
    signal?: AbortSignal,
  ): Promise<ResolvedTurn> {
    return resolveThinkingTurn({
      chat,
      model,
      activeToolEntries: entries,
      onProgress: (nextChat) => onProgress(nextChat, findLatestAssistantMessageId(nextChat)),
      promptContext,
      resolveToolId: (functionName) => resolveToolId(functionName, entries),
      signal,
    });
  }

  async function runModelTurn(baseChat: Chat, nextChatMode: ChatMode) {
    if (!currentModel || activeTurnControllerRef.current) {
      return;
    }

    const effectiveMode = collectLongPdfAttachments(baseChat.messages).length ? 'thinking' : nextChatMode;
    const turnChat = effectiveMode === baseChat.mode ? baseChat : { ...baseChat, mode: effectiveMode };
    setChats((currentChats) => replaceChat(currentChats, turnChat));
    setLiveChat({ chatId: turnChat.id, chat: turnChat, assistantMessageId: null });
    setIsTyping(true);
    setLastError(null);
    const controller = new AbortController();
    activeTurnControllerRef.current = controller;

    try {
      const turnToolEntries = effectiveMode === 'thinking' ? getActiveToolEntries(turnChat) : [];
      const promptContext = {
        customPrompt: customSystemPrompt,
        mode: effectiveMode,
        tools: turnToolEntries.map(({ definition }) => definition),
      } satisfies SystemPromptContext;
      const resolvedTurn =
        effectiveMode === 'flash'
          ? await sendFlashTurn({
              chat: turnChat,
              model: currentModel,
              promptContext,
              onProgress: (nextChat, assistantMessageId) => setLiveChat({ chatId: nextChat.id, chat: nextChat, assistantMessageId }),
              signal: controller.signal,
            })
          : await sendThinkingReply(
              turnChat,
              currentModel,
              promptContext,
              turnToolEntries,
              (nextChat, assistantMessageId) => setLiveChat({ chatId: nextChat.id, chat: nextChat, assistantMessageId }),
              controller.signal,
            );
      setChats((currentChats) => replaceChat(currentChats, resolvedTurn.chat));
      setAvailability(resolvedTurn.availability);
      setLastError(resolvedTurn.lastError);
    } finally {
      if (activeTurnControllerRef.current === controller) {
        activeTurnControllerRef.current = null;
      }

      setLiveChat(null);
      setIsTyping(false);
    }
  }

  async function sendMessage(content: string, attachments: AiAttachmentReference[] = []) {
    const normalizedContent = content.trim() || (attachments.length ? DEFAULT_ATTACHMENT_PROMPT : '');
    if (!currentModel || activeTurnControllerRef.current || !normalizedContent) {
      return;
    }

    const userMessage = createUserMessage(normalizedContent, attachments);
    const appendedChat = persistedSelectedChat ? appendMessage(persistedSelectedChat, userMessage) : createNewChat(userMessage, chatMode);
    const nextChatMode = collectLongPdfAttachments(appendedChat.messages).length ? 'thinking' : chatMode;
    const baseChat = { ...appendedChat, mode: nextChatMode };

    if (!selectedChat) {
      setSelectedChatId(baseChat.id);
      setDraftMode('thinking');
    }

    await runModelTurn(baseChat, nextChatMode);
  }

  async function editAndResendMessage(messageId: string, nextContent: string) {
    if (!persistedSelectedChat || !currentModel || activeTurnControllerRef.current) return;

    const baseChat = editUserMessageBranch(persistedSelectedChat, messageId, nextContent);
    if (!baseChat) return;

    await runModelTurn(baseChat, selectedChat.mode);
  }

  async function regenerateAssistantMessage(messageId: string) {
    if (!persistedSelectedChat || !currentModel || activeTurnControllerRef.current) {
      return;
    }

    const baseChat = regenerateAssistantBranch(persistedSelectedChat, messageId);
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
    if (liveChat?.chatId === chatId) {
      setLiveChat(null);
    }
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
    activeChat: selectedChat,
    deleteChat,
    editAndResendMessage,
    hydrationStatus,
    isTyping,
    lastError,
    liveAssistantMessageId: selectedLiveChat?.assistantMessageId ?? null,
    persistenceError,
    regenerateAssistantMessage,
    refreshModels,
    setCustomSystemPrompt,
    selectChat,
    selectedChatId,
    showTypingIndicator: shouldShowTypingIndicator(isTyping, selectedLiveChat),
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
