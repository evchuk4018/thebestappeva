import { createChatTitle } from './helpers';
import { AiMessage, Chat, UserMessage, UserMessageVersion } from './types';

export type BranchDirection = 'previous' | 'next';

function createBranchId() {
  return `branch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getOriginalBranchId(message: UserMessage) {
  return `${message.id}-original`;
}

function getActiveBranchId(message: UserMessage) {
  return message.activeVersionId ?? message.versions?.[0]?.id ?? getOriginalBranchId(message);
}

function getBranchIndex(branches: UserMessageVersion[], branchId: string) {
  const index = branches.findIndex((branch) => branch.id === branchId);
  return index === -1 ? 0 : index;
}

function saveVisibleBranch(message: UserMessage, messagesAfter: AiMessage[]) {
  const activeBranchId = getActiveBranchId(message);
  const branches = message.versions?.length
    ? message.versions
    : [
        {
          id: activeBranchId,
          content: message.content,
          createdAt: message.createdAt,
          messagesAfter,
        },
      ];

  const hasActiveBranch = branches.some((branch) => branch.id === activeBranchId);
  const nextBranches = hasActiveBranch
    ? branches.map((branch) =>
        branch.id === activeBranchId ? { ...branch, content: message.content, messagesAfter } : branch,
      )
    : [...branches, { id: activeBranchId, content: message.content, createdAt: message.createdAt, messagesAfter }];

  return nextBranches;
}

function updateChatTitle(chat: Chat, messageIndex: number, content: string) {
  return messageIndex === 0 && chat.titleStatus === 'pending' ? createChatTitle(content) : chat.title;
}

export function getUserMessageVersionInfo(message: UserMessage) {
  const total = message.versions?.length ?? 1;
  const activeBranchId = getActiveBranchId(message);
  const activeIndex = message.versions ? getBranchIndex(message.versions, activeBranchId) : 0;
  return { activeIndex, total };
}

export function editUserMessageBranch(chat: Chat, messageId: string, nextContent: string) {
  const trimmedContent = nextContent.trim();
  const messageIndex = chat.messages.findIndex((message) => message.id === messageId && message.kind === 'user');
  if (!trimmedContent || messageIndex === -1) {
    return null;
  }

  const message = chat.messages[messageIndex] as UserMessage;
  if (message.content.trim() === trimmedContent) {
    return null;
  }

  const messagesAfter = chat.messages.slice(messageIndex + 1);
  const savedBranches = saveVisibleBranch(message, messagesAfter);
  const newBranch = {
    id: createBranchId(),
    content: trimmedContent,
    createdAt: new Date().toISOString(),
    messagesAfter: [],
  };
  const editedMessage = {
    ...message,
    content: trimmedContent,
    activeVersionId: newBranch.id,
    versions: [...savedBranches, newBranch],
  };

  return {
    ...chat,
    title: updateChatTitle(chat, messageIndex, trimmedContent),
    messages: [...chat.messages.slice(0, messageIndex), editedMessage],
    updatedAt: newBranch.createdAt,
  };
}

export function regenerateUserMessageBranch(chat: Chat, messageId: string) {
  const messageIndex = chat.messages.findIndex((message) => message.id === messageId && message.kind === 'user');
  if (messageIndex === -1) {
    return null;
  }

  const message = chat.messages[messageIndex] as UserMessage;
  const messagesAfter = chat.messages.slice(messageIndex + 1);
  const updatedMessage = {
    ...message,
    versions: saveVisibleBranch(message, messagesAfter),
  };

  return {
    ...chat,
    messages: [...chat.messages.slice(0, messageIndex), updatedMessage],
    updatedAt: new Date().toISOString(),
  };
}

export function regenerateAssistantBranch(chat: Chat, messageId: string) {
  const messageIndex = chat.messages.findIndex((message) => message.id === messageId && message.kind === 'assistant');
  if (messageIndex === -1) {
    return null;
  }

  const sourceUserMessage = [...chat.messages.slice(0, messageIndex)].reverse().find((message) => message.kind === 'user');
  return sourceUserMessage?.kind === 'user' ? regenerateUserMessageBranch(chat, sourceUserMessage.id) : null;
}

export function switchUserMessageBranch(chat: Chat, messageId: string, direction: BranchDirection) {
  const messageIndex = chat.messages.findIndex((message) => message.id === messageId && message.kind === 'user');
  if (messageIndex === -1) {
    return chat;
  }

  const message = chat.messages[messageIndex] as UserMessage;
  const messagesAfter = chat.messages.slice(messageIndex + 1);
  const branches = saveVisibleBranch(message, messagesAfter);
  if (branches.length < 2) {
    return chat;
  }

  const activeBranchId = getActiveBranchId(message);
  const activeIndex = getBranchIndex(branches, activeBranchId);
  const offset = direction === 'next' ? 1 : -1;
  const nextIndex = (activeIndex + offset + branches.length) % branches.length;
  const nextBranch = branches[nextIndex];
  const nextMessage = {
    ...message,
    content: nextBranch.content,
    activeVersionId: nextBranch.id,
    versions: branches,
  };

  return {
    ...chat,
    title: updateChatTitle(chat, messageIndex, nextBranch.content),
    messages: [...chat.messages.slice(0, messageIndex), nextMessage, ...nextBranch.messagesAfter],
    updatedAt: new Date().toISOString(),
  };
}
