import { createUserMessage } from '../helpers';
import type { Chat } from '../types';
import type { AutomationRecord } from '../../../../shared/automations-contract';
import type { AutomationTurnConfig } from './automation-turns';

interface ScheduledAutomationRunDeps {
  automation: AutomationRecord;
  claimedRunAt: string;
  runModelTurn: (chat: Chat, mode: 'thinking', assistantMessageId?: string | null, overrides?: AutomationTurnConfig) => Promise<{ chat: Chat; lastError: string | null } | null>;
  queueCompletedTurnRefresh: (result: Awaited<ReturnType<ScheduledAutomationRunDeps['runModelTurn']>>) => void;
}

export async function runScheduledAutomationTurn({ automation, claimedRunAt, runModelTurn, queueCompletedTurnRefresh }: ScheduledAutomationRunDeps, config: AutomationTurnConfig) {
  const userMessage = createUserMessage(automation.action.prompt);
  const baseChat: Chat = { id: `chat-${Date.now()}`, title: `${automation.name} - ${new Date(claimedRunAt).toLocaleString()}`, titleStatus: 'finalized', messages: [userMessage], activeArtifactId: null, includedArtifactIds: [], mode: 'thinking', updatedAt: userMessage.createdAt };
  const resolved = await runModelTurn(baseChat, 'thinking', undefined, config);
  queueCompletedTurnRefresh(resolved);
  const latestAssistant = resolved?.chat.messages.at(-1);
  return resolved?.lastError
    ? { status: 'error' as const, error: resolved.lastError, summary: null, chatId: resolved.chat.id }
    : { status: 'success' as const, error: null, summary: latestAssistant?.kind === 'assistant' ? latestAssistant.content.slice(0, 240) : 'Automation completed.', chatId: resolved?.chat.id ?? null };
}
