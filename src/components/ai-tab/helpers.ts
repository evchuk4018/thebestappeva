import { Chat, Message, OllamaModel, PullProgress } from './types';
import { suggestionPrompts } from './data';

export function createChatTitle(message: string) {
  const summary = message.trim().split(/\s+/).slice(0, 5).join(' ');
  return summary.length > 42 ? `${summary.slice(0, 42)}...` : summary || 'New local chat';
}

export function createNewChat(message: Message): Chat {
  return {
    id: `chat-${Date.now()}`,
    title: createChatTitle(message.content),
    messages: [message],
    updatedAt: message.createdAt,
  };
}

export function appendMessage(chat: Chat, message: Message): Chat {
  return {
    ...chat,
    messages: [...chat.messages, message],
    updatedAt: message.createdAt,
  };
}

export function getSuggestionPrompt(label: string) {
  return suggestionPrompts[label] ?? '';
}

export function sortModels(models: OllamaModel[]) {
  return [...models].sort((left, right) => Date.parse(right.modifiedAt) - Date.parse(left.modifiedAt));
}

export function formatBytes(bytes?: number) {
  if (!bytes) {
    return null;
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatModelMeta(model: OllamaModel) {
  const parts = [model.parameterSize, model.family, model.quantizationLevel].filter(Boolean);
  return parts.join(' • ');
}

export function normalizeModelName(name: string) {
  return name.trim();
}

export function formatProgress(progress: PullProgress | null) {
  if (!progress) {
    return null;
  }

  const bytesText = progress.total
    ? `${formatBytes(progress.completed) ?? '0 B'} / ${formatBytes(progress.total) ?? '0 B'}`
    : formatBytes(progress.completed);

  if (progress.total && progress.completed) {
    const percent = Math.min(100, Math.round((progress.completed / progress.total) * 100));
    return `${progress.status} (${percent}%)${bytesText ? ` • ${bytesText}` : ''}`;
  }

  return bytesText ? `${progress.status} • ${bytesText}` : progress.status;
}
