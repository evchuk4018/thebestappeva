import type { Dispatch, SetStateAction, KeyboardEvent, MouseEvent } from 'react';
import { getSuggestionPrompt } from './helpers';
import type { AiAttachmentReference, Chat, ModelProvider, PullProgress, AiRuntimeConfig } from './types';

interface SelectModelOptions {
  runtimeConfig: AiRuntimeConfig | null;
  setCurrentModel: Dispatch<SetStateAction<string | null>>;
  setModelDropdownOpen: Dispatch<SetStateAction<boolean>>;
  setProvider: (provider: ModelProvider, preferredModel?: string | null) => void;
}

interface CopyMessageOptions {
  activeChat: Chat | null;
  copyTextToClipboard: (text: string) => Promise<void>;
}

interface DeleteChatOptions {
  deleteChat: (chatId: string) => void;
}

interface EditMessageOptions {
  editAndResendMessage: (messageId: string, nextContent: string) => Promise<void>;
  setInputValue: Dispatch<SetStateAction<string>>;
}

interface NewChatOptions {
  isMobile: boolean;
  selectChat: (chatId: string | null) => void;
  setActivePanel: Dispatch<SetStateAction<'chats' | 'tools'>>;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
}

interface SendOptions {
  clearReadyAttachments: () => void;
  currentModel: string | null;
  inputValue: string;
  isTyping: boolean;
  readyAttachmentRefs: AiAttachmentReference[];
  sendMessage: (content: string, attachments?: AiAttachmentReference[]) => Promise<void>;
  setInputValue: Dispatch<SetStateAction<string>>;
}

interface PullModelOptions {
  currentProvider: ModelProvider;
  pullModel: (modelName: string, onProgress: (progress: PullProgress) => void) => Promise<void>;
  refreshModels: (preferredProvider: ModelProvider, preferredModel?: string | null) => Promise<AiRuntimeConfig | null>;
  setCurrentModel: Dispatch<SetStateAction<string | null>>;
  setIsPullingModel: Dispatch<SetStateAction<boolean>>;
  setPullProgress: Dispatch<SetStateAction<PullProgress | null>>;
}

export function createHandleSelectModel({ runtimeConfig, setCurrentModel, setModelDropdownOpen, setProvider }: SelectModelOptions) {
  return (model: string) => {
    const selectedModel = runtimeConfig?.modelOptions.find((candidate) => candidate.name === model) ?? null;
    if (selectedModel) {
      setProvider(selectedModel.provider, selectedModel.name);
    } else {
      setCurrentModel(model);
    }
    setModelDropdownOpen(false);
  };
}

export function createHandleCopyMessage({ activeChat, copyTextToClipboard }: CopyMessageOptions) {
  return async (messageId: string, kind: 'assistant' | 'user') => {
    const message = activeChat?.messages.find((candidate) => candidate.id === messageId);
    if (!message || message.kind !== kind) return;
    await copyTextToClipboard(message.content);
  };
}

export function createHandleDeleteChat({ deleteChat }: DeleteChatOptions) {
  return (chatId: string, event: MouseEvent) => {
    event.stopPropagation();
    deleteChat(chatId);
  };
}

export function createHandleEditUserMessage({ editAndResendMessage, setInputValue }: EditMessageOptions) {
  return async (messageId: string, nextContent: string) => {
    setInputValue('');
    await editAndResendMessage(messageId, nextContent);
  };
}

export function createHandleNewChat({ isMobile, selectChat, setActivePanel, setSidebarOpen }: NewChatOptions) {
  return () => {
    setActivePanel('chats');
    selectChat(null);
    if (isMobile) setSidebarOpen(false);
  };
}

export function createHandleSend({ clearReadyAttachments, currentModel, inputValue, isTyping, readyAttachmentRefs, sendMessage, setInputValue }: SendOptions) {
  return async () => {
    const nextMessage = inputValue.trim();
    if ((!nextMessage && !readyAttachmentRefs.length) || isTyping || !currentModel) return;
    setInputValue('');
    await sendMessage(nextMessage, readyAttachmentRefs);
    clearReadyAttachments();
  };
}

export function createHandlePullModel({ currentProvider, pullModel, refreshModels, setCurrentModel, setIsPullingModel, setPullProgress }: PullModelOptions) {
  return async (modelName: string) => {
    setIsPullingModel(true);
    setPullProgress({
      model: modelName,
      status: 'Preparing local download...',
      done: false,
    });

    try {
      await pullModel(modelName, (progress) => setPullProgress(progress));
      await refreshModels(currentProvider, modelName);
      setCurrentModel(modelName);
      setPullProgress({
        model: modelName,
        status: 'Model installed successfully.',
        done: true,
      });
    } catch (error) {
      setPullProgress({
        model: modelName,
        status: error instanceof Error ? error.message : 'Model download failed.',
        done: true,
        error: error instanceof Error ? error.message : 'Model download failed.',
      });
    } finally {
      setIsPullingModel(false);
    }
  };
}

export function createHandleKeyDown(handleSend: () => Promise<void>) {
  return (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };
}

export function createSuggestionHandler(setInputValue: Dispatch<SetStateAction<string>>) {
  return (label: string) => setInputValue(getSuggestionPrompt(label));
}
