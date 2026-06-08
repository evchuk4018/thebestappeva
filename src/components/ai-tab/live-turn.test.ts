import assert from 'node:assert/strict';
import test from 'node:test';
import { createAssistantMessage, createNewChat, createUserMessage } from './helpers';
import { resolveActiveChat, shouldShowTypingIndicator } from './live-turn';

test('prefers the live overlay for the active chat', () => {
  const persistedChat = createNewChat(createUserMessage('hello'), 'thinking');
  const liveAssistant = createAssistantMessage('streaming', 'qwen');
  const liveChat = {
    chatId: persistedChat.id,
    chat: { ...persistedChat, messages: [...persistedChat.messages, liveAssistant] },
    assistantMessageId: liveAssistant.id,
  };

  assert.equal(resolveActiveChat(persistedChat, liveChat), liveChat.chat);
});

test('keeps the typing indicator only until a live assistant bubble exists', () => {
  assert.equal(shouldShowTypingIndicator(true, null), true);
  assert.equal(
    shouldShowTypingIndicator(true, {
      chatId: 'chat-1',
      chat: createNewChat(createUserMessage('hello'), 'flash'),
      assistantMessageId: 'msg-1',
    }),
    false,
  );
});
