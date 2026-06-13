import assert from 'node:assert/strict';
import test from 'node:test';
import { createAssistantMessage, createNewChat, createUserMessage } from './helpers';
import {
  CHAT_TITLE_MAX_CHARS,
  buildChatTitlePrompt,
  finalizeChatTitleGeneration,
  getChatTitleGenerationCandidate,
  hasChatTitleModel,
  normalizeGeneratedChatTitle,
} from './chat-title-generation';
import { appendMessage } from './helpers';
import { editUserMessageBranch } from './message-branches';

test('new chats start with a heuristic title and pending title generation', () => {
  const chat = createNewChat(createUserMessage('Plan a 4 day hypertrophy split with supersets'), 'thinking');

  assert.equal(chat.title, 'Plan a 4 day hypertrophy');
  assert.equal(chat.titleStatus, 'pending');
});

test('builds the title prompt from the first user prompt and first assistant reply', () => {
  const user = createUserMessage('Map out a clean bulking nutrition plan for weekdays.');
  const assistant = createAssistantMessage('Here is a weekday bulking plan with calories, macros, and meal timing.');
  const chat = appendMessage(createNewChat(user, 'thinking'), assistant);

  assert.equal(
    buildChatTitlePrompt(chat),
    'User: Map out a clean bulking nutrition plan for weekdays.\nAssistant: Here is a weekday bulking plan with calories, macros, and meal timing.',
  );
});

test('normalizes generated titles and enforces the character cap', () => {
  const rawTitle = '  "Title:   Weekday bulking calories and meal timing plan!!!"  ';
  assert.equal(normalizeGeneratedChatTitle(rawTitle), 'Weekday bulking calories and meal timing plan');

  const longTitle = `Strength block ${'x'.repeat(CHAT_TITLE_MAX_CHARS)}`;
  assert.equal(normalizeGeneratedChatTitle(longTitle)?.length, CHAT_TITLE_MAX_CHARS);
});

test('does not generate a title after later turns or failed first replies', () => {
  const firstUser = createUserMessage('Explain deload planning.');
  const firstAssistant = createAssistantMessage('Use volume and fatigue markers to choose a deload week.');
  const laterUser = createUserMessage('Add a sample calendar.');
  const laterAssistant = createAssistantMessage('Week 4 can taper volume by 40 percent.');
  const multiTurnChat = appendMessage(appendMessage(appendMessage(createNewChat(firstUser, 'thinking'), firstAssistant), laterUser), laterAssistant);

  assert.equal(getChatTitleGenerationCandidate(multiTurnChat), null);

  const cancelledReplyChat = appendMessage(
    createNewChat(createUserMessage('Draft a mobility warmup.'), 'flash'),
    createAssistantMessage('Stopped early.', 'qwen', { status: 'cancelled' }),
  );
  assert.equal(getChatTitleGenerationCandidate(cancelledReplyChat), null);
});

test('finalizes a generated title once and blocks future regeneration attempts', () => {
  const chat = appendMessage(
    createNewChat(createUserMessage('Help me structure a cut without losing strength.'), 'thinking'),
    createAssistantMessage('Start with a small calorie deficit, keep protein high, and anchor progress to compound lifts.'),
  );
  const candidate = getChatTitleGenerationCandidate(chat);
  assert.ok(candidate);

  const generatedChat = finalizeChatTitleGeneration(chat, candidate, 'Strength-preserving fat-loss plan');
  assert.equal(generatedChat.title, 'Strength-preserving fat-loss plan');
  assert.equal(generatedChat.titleStatus, 'generated');
  assert.equal(getChatTitleGenerationCandidate(generatedChat), null);
});

test('keeps the heuristic title when generated naming is unavailable', () => {
  const chat = appendMessage(
    createNewChat(createUserMessage('Build a push day for dumbbells only.'), 'thinking'),
    createAssistantMessage('Use incline press, shoulder press, lateral raises, and triceps extensions.'),
  );
  const candidate = getChatTitleGenerationCandidate(chat);
  assert.ok(candidate);

  const finalizedChat = finalizeChatTitleGeneration(chat, candidate, null);
  assert.equal(finalizedChat.title, chat.title);
  assert.equal(finalizedChat.titleStatus, 'finalized');
});

test('editing the first prompt after a generated title keeps the original title', () => {
  const chat = appendMessage(
    createNewChat(createUserMessage('Compare upper lower and push pull legs for recovery.'), 'thinking'),
    createAssistantMessage('Upper lower is easier to recover from while push pull legs gives more specialization days.'),
  );
  const candidate = getChatTitleGenerationCandidate(chat);
  assert.ok(candidate);

  const generatedChat = finalizeChatTitleGeneration(chat, candidate, 'Upper/lower vs push/pull/legs');
  const editedChat = editUserMessageBranch(generatedChat, generatedChat.messages[0]!.id, 'Compare bro splits and upper lower.');

  assert.ok(editedChat);
  assert.equal(editedChat.title, 'Upper/lower vs push/pull/legs');
});

test('detects whether the dedicated title model is installed', () => {
  assert.equal(hasChatTitleModel([{ name: 'qwen3.5:0.8b', provider: 'ollama' }]), true);
  assert.equal(hasChatTitleModel([{ name: 'qwen3.5:9b', provider: 'ollama' }]), false);
});
