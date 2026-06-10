import { useEffect, useRef, useState } from 'react';
import { appendMessage, createNewChat, createUserMessage } from './helpers';
import { TurnAbortedError } from './abort-utils';
import { replaceChat, updateChatMode } from './chat-helpers';
import { sendFlashTurn } from './flash-turn';
import { LiveChatState, resolveActiveChat, shouldShowTypingIndicator } from './live-turn';
import { BranchDirection, editUserMessageBranch, regenerateAssistantBranch, switchUserMessageBranch } from './message-branches';
import { SystemPromptContext } from './system-prompt';
import { buildArtifactContext } from '../../lib/ai-artifact-context';
import { findPendingAskUserState, updateAskUserStepInChat } from './ask-user';
import { buildVisibleTools, getActiveToolEntriesForChat, setChatActiveArtifactState, setChatIncludedArtifactState } from './artifact-chat-helpers';
import type { AiAttachmentReference, AskUserResponse, Chat, ChatMode, ModelProvider } from './types';
import { collectLongPdfAttachments } from './tools/pdf-reader-tool';
import { getToolRegistryEntries } from './tools/registry';
import type { ToolRegistryEntry } from './tools/types';
import { useOllamaModelState } from './useOllamaModelState';
import { useAiWorkspacePersistence } from './useAiWorkspacePersistence';
import { resolveThinkingTurn, ResolvedTurn } from './thinking-turn';

const DEFAULT_ATTACHMENT_PROMPT = 'Please analyze the attached documents.';

export function useOllamaChat() {
  const [draftMode, setDraftMode] = useState<ChatMode>('thinking');
  const [isTyping, setIsTyping] = useState(false);
  const [liveChat, setLiveChat] = useState<LiveChatState | null>(null);
  const [pendingAskUserTurn, setPendingAskUserTurn] = useState<ReturnType<typeof findPendingAskUserState>>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const activeTurnControllerRef = useRef<AbortController | null>(null);
  const {
    chats,
    currentProvider,
    currentModel,
    customSystemPrompt,
    enabledTools,
    hydrationStatus,
    persistenceError,
    setChats,
    setCurrentProvider,
    setCurrentModel,
    setCustomSystemPrompt,
    setEnabledTools,
    flushWorkspace,
  } = useAiWorkspacePersistence();
  const {
    activeProviderOption,
    availableModels,
    availability,
    lastError,
    refreshModels,
    runtimeConfig,
    setAvailability,
    setLastError,
  } = useOllamaModelState({ currentModel, currentProvider, hydrationStatus, setCurrentModel, setCurrentProvider });

  const toolRegistryEntries = getToolRegistryEntries();
  const persistedSelectedChat = chats.find((chat) => chat.id === selectedChatId) ?? null;
  const selectedLiveChat = liveChat?.chatId === selectedChatId ? liveChat : null;
  const selectedChat = resolveActiveChat(persistedSelectedChat, selectedLiveChat);
  const tools = buildVisibleTools(toolRegistryEntries, enabledTools, selectedChatId, persistedSelectedChat);
  const activeToolEntries = getActiveToolEntriesForChat(persistedSelectedChat, toolRegistryEntries, enabledTools);
  const chatMode = selectedChat?.mode ?? draftMode;
  const isBusy = isTyping || Boolean(pendingAskUserTurn);
  const systemPromptContext: SystemPromptContext = {
    customPrompt: customSystemPrompt,
    mode: chatMode,
    tools: activeToolEntries.map(({ definition }) => definition),
    artifactContext: undefined,
  };

  useEffect(() => () => activeTurnControllerRef.current?.abort(new TurnAbortedError()), []);
  useEffect(() => {
    if (!isTyping) {
      void flushWorkspace();
    }
  }, [flushWorkspace, isTyping]);
  useEffect(() => {
    if (pendingAskUserTurn || !persistedSelectedChat) {
      return;
    }

    const pendingPrompt = selectedChat ? findPendingAskUserState(selectedChat) : null;
    if (pendingPrompt) {
      setPendingAskUserTurn(pendingPrompt);
    }
  }, [pendingAskUserTurn, persistedSelectedChat, selectedChat]);

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

  function setProvider(provider: ModelProvider) {
    setCurrentProvider(provider);
    void refreshModels(provider);
  }

  function toggleChatMode() {
    setChatMode(chatMode === 'thinking' ? 'flash' : 'thinking');
  }

  function resolveToolId(functionName: string, entries: ToolRegistryEntry[]) {
    return entries.find(({ definition }) => definition.functions.some((candidate) => candidate.name === functionName))?.definition.id ?? functionName;
  }

  function findLatestAssistantMessageId(chat: Chat) {
    return [...chat.messages].reverse().find((message) => message.kind === 'assistant')?.id ?? null;
  }

  async function sendThinkingReply(
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

  async function runModelTurn(baseChat: Chat, nextChatMode: ChatMode, assistantMessageId?: string | null) {
    if (!currentModel || activeTurnControllerRef.current) return;
    const effectiveMode = collectLongPdfAttachments(baseChat.messages).length ? 'thinking' : nextChatMode;
    const turnChat = effectiveMode === baseChat.mode ? baseChat : { ...baseChat, mode: effectiveMode };
    setChats((currentChats) => replaceChat(currentChats, turnChat));
    setLiveChat({ chatId: turnChat.id, chat: turnChat, assistantMessageId: null });
    setPendingAskUserTurn(null);
    setIsTyping(true);
    setLastError(null);
    const controller = new AbortController();
    activeTurnControllerRef.current = controller;

    try {
      const turnToolEntries = effectiveMode === 'thinking' ? getActiveToolEntriesForChat(turnChat, toolRegistryEntries, enabledTools) : [];
      const artifactContext = turnChat.includedArtifactIds.length ? await buildArtifactContext(turnChat) : undefined;
      const promptContext = {
        customPrompt: customSystemPrompt,
        mode: effectiveMode,
        tools: turnToolEntries.map(({ definition }) => definition),
        artifactContext,
      } satisfies SystemPromptContext;
      const resolvedTurn =
        effectiveMode === 'flash'
          ? await sendFlashTurn({
              chat: turnChat,
              model: currentModel,
              provider: currentProvider,
              promptContext,
              onProgress: (nextChat, nextAssistantMessageId) => setLiveChat({ chatId: nextChat.id, chat: nextChat, assistantMessageId: nextAssistantMessageId }),
              signal: controller.signal,
            })
          : await sendThinkingReply(
              turnChat,
              currentProvider,
              currentModel,
              promptContext,
              turnToolEntries,
              (nextChat, nextAssistantMessageId) => setLiveChat({ chatId: nextChat.id, chat: nextChat, assistantMessageId: nextAssistantMessageId }),
              assistantMessageId,
              controller.signal,
            );
      setChats((currentChats) => replaceChat(currentChats, resolvedTurn.chat));
      setAvailability(resolvedTurn.availability);
      setLastError(resolvedTurn.lastError);
      setPendingAskUserTurn(resolvedTurn.status === 'paused' ? resolvedTurn.pendingAskUser : null);
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
    if (!currentModel || activeTurnControllerRef.current || pendingAskUserTurn || !normalizedContent) return;
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
    if (!persistedSelectedChat || !currentModel || activeTurnControllerRef.current || pendingAskUserTurn) return;
    const baseChat = editUserMessageBranch(persistedSelectedChat, messageId, nextContent);
    if (!baseChat) return;
    await runModelTurn(baseChat, selectedChat.mode);
  }

  async function regenerateAssistantMessage(messageId: string) {
    if (!persistedSelectedChat || !currentModel || activeTurnControllerRef.current || pendingAskUserTurn) return;
    const baseChat = regenerateAssistantBranch(persistedSelectedChat, messageId);
    if (!baseChat) return;
    await runModelTurn(baseChat, selectedChat.mode);
  }

  function switchUserMessageVersion(messageId: string, direction: BranchDirection) {
    if (!selectedChatId || activeTurnControllerRef.current || pendingAskUserTurn) {
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
    if (pendingAskUserTurn?.chatId === chatId) {
      setPendingAskUserTurn(null);
    }
    if (selectedChatId === chatId) {
      selectChat(null);
    }
  }

  function toggleTool(toolId: string, enabled: boolean) {
    setEnabledTools((current) => ({ ...current, [toolId]: enabled }));
  }

  function setActiveArtifact(artifactId: string | null) {
    if (!selectedChatId) return;
    setChats((currentChats) => currentChats.map((chat) => chat.id === selectedChatId ? setChatActiveArtifactState(chat, artifactId) : chat));
  }

  function setArtifactIncluded(artifactId: string, included: boolean) {
    if (!selectedChatId) return;
    setChats((currentChats) => currentChats.map((chat) => chat.id === selectedChatId ? setChatIncludedArtifactState(chat, artifactId, included) : chat));
  }

  async function submitAskUserResponse(messageId: string, stepId: string, response: AskUserResponse) {
    if (!currentModel || activeTurnControllerRef.current || !pendingAskUserTurn) {
      return;
    }

    const targetChat = chats.find((chat) => chat.id === pendingAskUserTurn.chatId);
    if (!targetChat) {
      setPendingAskUserTurn(null);
      return;
    }
    const nextChat = updateAskUserStepInChat(targetChat, messageId, stepId, response);
    setChats((currentChats) => replaceChat(currentChats, nextChat));
    setLiveChat({ chatId: nextChat.id, chat: nextChat, assistantMessageId: messageId });
    await runModelTurn(nextChat, nextChat.mode, messageId);
  }

  return {
    activeProviderOption,
    availableModels,
    availability,
    chatMode,
    chats,
    currentProvider,
    currentModel,
    customSystemPrompt,
    activeChat: selectedChat,
    deleteChat,
    editAndResendMessage,
    hydrationStatus,
    isBusy,
    isTyping,
    lastError,
    liveAssistantMessageId: selectedLiveChat?.assistantMessageId ?? null,
    persistenceError,
    regenerateAssistantMessage,
    refreshModels,
    runtimeConfig,
    setCurrentModel,
    setCustomSystemPrompt,
    setProvider,
    selectChat,
    selectedChatId,
    activeArtifactId: selectedChat?.activeArtifactId ?? null,
    activeAskUserStepId: pendingAskUserTurn?.stepId ?? null,
    includedArtifactIds: selectedChat?.includedArtifactIds ?? [],
    showTypingIndicator: shouldShowTypingIndicator(isTyping, selectedLiveChat),
    sendMessage,
    setActiveArtifact,
    setArtifactIncluded,
    systemPromptContext,
    submitAskUserResponse,
    stopMessage,
    toggleChatMode,
    toggleTool,
    switchUserMessageVersion,
    tools,
  };
}
