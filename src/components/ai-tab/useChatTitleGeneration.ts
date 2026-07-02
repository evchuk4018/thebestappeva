import { Dispatch, SetStateAction, useEffect, useRef } from 'react';
import type { Chat, RuntimeProviderOption } from './types';
import {
  finalizeChatTitleGeneration,
  getChatTitleGenerationCandidate,
  resolveChatTitleGenerationModel,
  requestGeneratedChatTitle,
} from './chat-title-generation';

interface UseChatTitleGenerationOptions {
  providerOptions: RuntimeProviderOption[];
  chats: Chat[];
  setChats: Dispatch<SetStateAction<Chat[]>>;
}

export function useChatTitleGeneration({ providerOptions, chats, setChats }: UseChatTitleGenerationOptions) {
  const inFlightChatIdsRef = useRef(new Set<string>());

  useEffect(() => {
    const candidates = chats
      .map((chat) => getChatTitleGenerationCandidate(chat))
      .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
      .filter((candidate) => !inFlightChatIdsRef.current.has(candidate.chatId));

    if (!candidates.length) {
      return;
    }

    const model = resolveChatTitleGenerationModel(providerOptions);
    if (!model) {
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
      void requestGeneratedChatTitle(candidate, model)
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
  }, [chats, providerOptions, setChats]);
}
