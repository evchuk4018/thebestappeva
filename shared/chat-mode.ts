export type ChatMode = 'thinking' | 'flash';

export const CHAT_MODES: readonly ChatMode[] = ['thinking', 'flash'];

export function isChatMode(value: unknown): value is ChatMode {
  return value === 'thinking' || value === 'flash';
}