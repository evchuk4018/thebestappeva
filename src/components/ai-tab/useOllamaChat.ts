import { useEffect, useEffectEvent, useState } from 'react';
import { appendMessage, createNewChat } from './helpers';
import { chatWithModel, listModels } from './ollama-client';
import { loadStoredChats, loadStoredSelectedModel, saveStoredChats, saveStoredSelectedModel } from './storage';
import { Chat, Message, OllamaAvailability, OllamaModel } from './types';

function createMessage(role: Message['role'], content: string, model?: string): Message {
  return {
    role,
    content,
    model,
    createdAt: new Date().toISOString(),
  };
}

export function useOllamaChat() {
  const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);
  const [availability, setAvailability] = useState<OllamaAvailability>('connecting');
  const [chats, setChats] = useState<Chat[]>(loadStoredChats);
  const [currentModel, setCurrentModel] = useState<string | null>(loadStoredSelectedModel);
  const [isTyping, setIsTyping] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

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

    const userMessage = createMessage('user', content.trim());
    let nextChatId = selectedChatId;
    let outgoingMessages = [userMessage];

    if (!selectedChatId) {
      const newChat = createNewChat(userMessage);
      nextChatId = newChat.id;
      outgoingMessages = newChat.messages;
      setChats((currentChats) => [newChat, ...currentChats]);
      setSelectedChatId(newChat.id);
    } else {
      const activeChat = chats.find((chat) => chat.id === selectedChatId);
      if (!activeChat) {
        return;
      }

      const updatedChat = appendMessage(activeChat, userMessage);
      outgoingMessages = updatedChat.messages;
      setChats((currentChats) => currentChats.map((chat) => (chat.id === selectedChatId ? updatedChat : chat)));
    }

    setIsTyping(true);
    setLastError(null);

    try {
      const reply = await chatWithModel(currentModel, outgoingMessages);
      const assistantMessage = createMessage('assistant', reply.content, reply.model);
      setChats((currentChats) => currentChats.map((chat) => (chat.id === nextChatId ? appendMessage(chat, assistantMessage) : chat)));
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
  };
}
