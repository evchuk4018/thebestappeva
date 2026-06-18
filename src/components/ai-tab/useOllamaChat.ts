import { useEffect, useRef, useState } from 'react';
import { appendMessage, createNewChat, createUserMessage } from './helpers';
import { TurnAbortedError } from './abort-utils';
import { replaceChat, updateChatMode } from './chat-helpers';
import { buildDefaultAttachmentPrompt, resolveTurnMode } from './attachment-behavior';
import { sendFlashTurn } from './flash-turn';
import { LiveChatState, resolveActiveChat, shouldShowTypingIndicator } from './live-turn';
import { BranchDirection, editUserMessageBranch, regenerateAssistantBranch, switchUserMessageBranch } from './message-branches';
import { SystemPromptContext } from './system-prompt';
import { buildArtifactContext } from '../../lib/ai-artifact-context';
import { findPendingAskUserState, updateAskUserStepInChat } from './ask-user';
import { buildVisibleTools, getActiveToolEntriesForChat, setChatActiveArtifactState, setChatIncludedArtifactState } from './artifact-chat-helpers';
import type { AiAttachmentReference, AskUserResponse, Chat, ChatMode, ModelProvider } from './types';
import { createChatContextToolEntries } from './tools/chat-context-tools';
import { getToolRegistryEntries } from './tools/registry';
import { useOllamaModelState } from './useOllamaModelState';
import { useAiWorkspacePersistence } from './useAiWorkspacePersistence';
import { useChatTitleGeneration } from './useChatTitleGeneration';
import { sendThinkingReply } from './chat-turn-helpers';
import { useAutoMemoryRefresh } from './use-auto-memory-refresh';
import { useSkills } from './skills/useSkills';
export function useOllamaChat() {
  const [draftMode, setDraftMode] = useState<ChatMode>('thinking');
  const [isTyping, setIsTyping] = useState(false);
  const [liveChat, setLiveChat] = useState<LiveChatState | null>(null);
  const [pendingAskUserTurn, setPendingAskUserTurn] = useState<ReturnType<typeof findPendingAskUserState>>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const activeTurnControllerRef = useRef<AbortController | null>(null);
  const {
    chats,
    generatedUserMemory,
    currentProvider,
    currentModel,
    visionMode,
    customSystemPrompt,
    enabledTools,
    hydrationStatus,
    persistenceError,
    setChats,
    setGeneratedUserMemory,
    setCurrentProvider,
    setCurrentModel,
    setVisionMode,
    setCustomSystemPrompt,
    setEnabledTools,
    getChats,
    getGeneratedUserMemory,
    getWorkspaceSnapshot,
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
useChatTitleGeneration({ availableModels, chats, setChats });
  const autoMemoryRefresh = useAutoMemoryRefresh({ getChats, getGeneratedUserMemory, getWorkspaceSnapshot, flushWorkspace, setGeneratedUserMemory, setChats });
  const skillsHook = useSkills();
  const skills = skillsHook.skills;
  const skillsRef = useRef(skills);
  skillsRef.current = skills;
  const toolRegistryEntries = [...getToolRegistryEntries(), ...createChatContextToolEntries({
    getChats, activeChatId: selectedChatId, getGeneratedUserMemory, getWorkspaceSnapshot, flushWorkspace, setGeneratedUserMemory, setChats,
  })];
  const persistedSelectedChat = chats.find((chat) => chat.id === selectedChatId) ?? null;
  const selectedLiveChat = liveChat?.chatId === selectedChatId ? liveChat : null;
  const selectedChat = resolveActiveChat(persistedSelectedChat, selectedLiveChat);
  const maxVisionCallsPerMessage = runtimeConfig?.visionMaxCallsPerMessage ?? 4;
  const tools = buildVisibleTools(toolRegistryEntries, enabledTools, selectedChatId, persistedSelectedChat, currentProvider, maxVisionCallsPerMessage);
  const activeToolEntries = getActiveToolEntriesForChat(persistedSelectedChat, toolRegistryEntries, enabledTools, currentProvider, maxVisionCallsPerMessage);
  const chatMode = selectedChat?.mode ?? draftMode;
  const isBusy = isTyping || Boolean(pendingAskUserTurn);
  const systemPromptContext: SystemPromptContext = { generatedUserMemory, customPrompt: customSystemPrompt, mode: chatMode, tools: activeToolEntries.map(({ definition }) => definition), artifactContext: undefined, skills };
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
  function selectChat(chatId: string | null) { setSelectedChatId(chatId); if (!chatId) setDraftMode('thinking'); }
  function setChatMode(mode: ChatMode) {
    if (selectedChatId) {
      setChats((currentChats) => updateChatMode(currentChats, selectedChatId, mode));
      return;
    }
    setDraftMode(mode);
  }
  function setProvider(provider: ModelProvider, preferredModel?: string | null) {
    setCurrentProvider(provider);
    void refreshModels(provider, preferredModel);
  }
  function toggleChatMode() { setChatMode(chatMode === 'thinking' ? 'flash' : 'thinking'); }
  async function runModelTurn(baseChat: Chat, nextChatMode: ChatMode, assistantMessageId?: string | null) {
    if (!currentModel || activeTurnControllerRef.current) return null;
    const effectiveMode = resolveTurnMode(baseChat, currentProvider, nextChatMode);
    const turnChat = effectiveMode === baseChat.mode ? baseChat : { ...baseChat, mode: effectiveMode };
    setChats((currentChats) => replaceChat(currentChats, turnChat));
    setLiveChat({ chatId: turnChat.id, chat: turnChat, assistantMessageId: null });
    setPendingAskUserTurn(null);
    setIsTyping(true);
    setLastError(null);
    const controller = new AbortController();
    activeTurnControllerRef.current = controller;
    try {
      const turnToolEntries = effectiveMode === 'thinking' ? getActiveToolEntriesForChat(turnChat, toolRegistryEntries, enabledTools, currentProvider, maxVisionCallsPerMessage) : [];
      const artifactContext = turnChat.includedArtifactIds.length ? await buildArtifactContext(turnChat) : undefined;
      const promptContext = {
        generatedUserMemory,
        customPrompt: customSystemPrompt,
        mode: effectiveMode,
        tools: turnToolEntries.map(({ definition }) => definition),
        artifactContext,
        skills: skillsRef.current,
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
      const nextChats = replaceChat(getChats(), resolvedTurn.chat);
      setChats(nextChats);
      setAvailability(resolvedTurn.availability);
      setLastError(resolvedTurn.lastError);
      setPendingAskUserTurn(resolvedTurn.status === 'paused' ? resolvedTurn.pendingAskUser : null);
      return resolvedTurn;
    } finally {
      if (activeTurnControllerRef.current === controller) {
        activeTurnControllerRef.current = null;
      }
      setLiveChat(null);
      setIsTyping(false);
    }
  }
  async function sendMessage(content: string, attachments: AiAttachmentReference[] = []) {
    const normalizedContent = content.trim() || (attachments.length ? buildDefaultAttachmentPrompt(attachments) : '');
    if (!currentModel || activeTurnControllerRef.current || pendingAskUserTurn || !normalizedContent) return;
    const hasImageAttachments = attachments.some((attachment) => attachment.kind === 'image');
    const userMessage = createUserMessage(normalizedContent, attachments);
    const appendedChat = persistedSelectedChat ? appendMessage(persistedSelectedChat, userMessage) : createNewChat(userMessage, chatMode);
    const nextChatMode = resolveTurnMode(appendedChat, currentProvider, chatMode);
    const baseChat = { ...appendedChat, mode: nextChatMode };
    if (!selectedChat) {
      setSelectedChatId(baseChat.id);
      setDraftMode('thinking');
    }
    autoMemoryRefresh.startForegroundTurn(hasImageAttachments);
    try {
      autoMemoryRefresh.queueCompletedTurnRefresh(await runModelTurn(baseChat, nextChatMode));
    } finally {
      autoMemoryRefresh.finishForegroundTurn(hasImageAttachments);
    }
  }
  async function editAndResendMessage(messageId: string, nextContent: string) {
    if (!persistedSelectedChat || !currentModel || activeTurnControllerRef.current || pendingAskUserTurn) return;
    const baseChat = editUserMessageBranch(persistedSelectedChat, messageId, nextContent);
    if (!baseChat) return;
    autoMemoryRefresh.queueCompletedTurnRefresh(await runModelTurn(baseChat, selectedChat.mode));
  }
  async function regenerateAssistantMessage(messageId: string) {
    if (!persistedSelectedChat || !currentModel || activeTurnControllerRef.current || pendingAskUserTurn) return;
    const baseChat = regenerateAssistantBranch(persistedSelectedChat, messageId);
    if (!baseChat) return;
    autoMemoryRefresh.queueCompletedTurnRefresh(await runModelTurn(baseChat, selectedChat.mode));
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
  function stopMessage() { activeTurnControllerRef.current?.abort(new TurnAbortedError()); }
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
    if (!currentModel || activeTurnControllerRef.current || !pendingAskUserTurn) return;
    const targetChat = chats.find((chat) => chat.id === pendingAskUserTurn.chatId);
    if (!targetChat) {
      setPendingAskUserTurn(null);
      return;
    }
    const nextChat = updateAskUserStepInChat(targetChat, messageId, stepId, response);
    setChats((currentChats) => replaceChat(currentChats, nextChat));
    setLiveChat({ chatId: nextChat.id, chat: nextChat, assistantMessageId: messageId });
    autoMemoryRefresh.queueCompletedTurnRefresh(await runModelTurn(nextChat, nextChat.mode, messageId));
  }
return {
    activeProviderOption,
    availableModels,
    availability,
    chatMode,
    chats,
    generatedUserMemory,
    currentProvider,
    currentModel,
    visionMode,
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
    setVisionMode,
    selectChat,
    selectedChatId,
    activeArtifactId: selectedChat?.activeArtifactId ?? null,
    activeAskUserStepId: pendingAskUserTurn?.stepId ?? null,
    includedArtifactIds: selectedChat?.includedArtifactIds ?? [],
    showTypingIndicator: shouldShowTypingIndicator(isTyping, selectedLiveChat),
    skills,
    skillsControls: skillsHook,
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
