import { Dispatch, SetStateAction, useEffect, useRef } from 'react';
import type { Chat, OllamaModel } from './types';
import {
  finalizeChatTitleGeneration,
  getChatTitleGenerationCandidate,
  hasChatTitleModel,
  requestGeneratedChatTitle,
} from './chat-title-generation';

interface UseChatTitleGenerationOptions {
  availableModels: OllamaModel[];
  chats: Chat[];
  setChats: Dispatch<SetStateAction<Chat[]>>;
}

export function useChatTitleGeneration({ availableModels, chats, setChats }: UseChatTitleGenerationOptions) {
  const inFlightChatIdsRef = useRef(new Set<string>());

  useEffect(() => {
    const candidates = chats
      .map((chat) => getChatTitleGenerationCandidate(chat))
      .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
      .filter((candidate) => !inFlightChatIdsRef.current.has(candidate.chatId));

    if (!candidates.length) {
      return;
    }

    const modelAvailable = hasChatTitleModel(availableModels);
    if (!modelAvailable) {
      setChats((currentChats) =>
        currentChats.map((chat) => {
          const candidate = candidates.find((currentCandidate) => currentCandidate.chatId === chat.id);
          return candidate ? finalizeChatTitleGeneration(chat, candidate, null) : chat;
        }),
      );
      return;
    }

    for (const candidate of candidates) {
      inFlightChatIdsRef.current.add(candidate.chatId);
      void requestGeneratedChatTitle(candidate)
        .then((generatedTitle) => {
          setChats((currentChats) =>
            currentChats.map((chat) =>
              chat.id === candidate.chatId ? finalizeChatTitleGeneration(chat, candidate, generatedTitle) : chat,
            ),
          );
        })
        .finally(() => {
          inFlightChatIdsRef.current.delete(candidate.chatId);
        });
    }
  }, [availableModels, chats, setChats]);
}
