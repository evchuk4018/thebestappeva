import {
  AskUserChoice,
  AskUserResponse,
  AssistantAskUserTraceStep,
  AssistantMessage,
  AssistantTraceStep,
  Chat,
  ToolInvocation,
  ToolResult,
} from './types';

export const ASK_USER_TOOL_ID = 'ask-user';
export const ASK_USER_FUNCTION_NAME = 'ask_user';
export const MAX_ASK_USER_CALLS_PER_TURN = 3;
export const MAX_ASK_USER_CHOICES = 6;
export const MAX_ASK_USER_SKIPS_PER_TURN = 2;
export const MAX_ASK_USER_TEXT_LENGTH = 280;
export const MAX_ASK_USER_DESCRIPTION_LENGTH = 400;

export interface AskUserPromptPayload {
  question: string;
  choices: AskUserChoice[];
  allowOpenEnded: boolean;
  openEndedPlaceholder?: string;
  placement: AssistantAskUserTraceStep['placement'];
  required: boolean;
}

export interface PendingAskUserState {
  chatId: string;
  assistantMessageId: string;
  stepId: string;
}

export interface AskUserTurnStats {
  hasPendingPrompt: boolean;
  promptCount: number;
  skipCount: number;
}

export function isAskUserInvocation(invocation: Pick<ToolInvocation, 'toolId' | 'functionName'>) {
  return invocation.toolId === ASK_USER_TOOL_ID && invocation.functionName === ASK_USER_FUNCTION_NAME;
}

export function createAskUserTraceStep(
  toolCallId: string,
  prompt: AskUserPromptPayload,
  createdAt = new Date().toISOString(),
): AssistantAskUserTraceStep {
  return {
    id: `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: 'ask-user',
    toolCallId,
    question: prompt.question,
    choices: prompt.choices,
    allowOpenEnded: prompt.allowOpenEnded,
    openEndedPlaceholder: prompt.openEndedPlaceholder,
    placement: prompt.placement,
    required: prompt.required,
    status: 'pending',
    createdAt,
  };
}

export function buildAskUserResponseSummary(response: AskUserResponse) {
  if (response.kind === 'choice') {
    return `User selected: ${response.label}`;
  }

  if (response.kind === 'open-ended') {
    return `User answered: ${response.text}`;
  }

  return response.reason?.trim() ? `User skipped the question (${response.reason.trim()})` : 'User skipped the question';
}

export function buildAskUserToolResult(step: AssistantAskUserTraceStep): ToolResult {
  const response = step.response ?? { kind: 'skip', reason: 'The prompt was unresolved.' } satisfies AskUserResponse;
  return {
    toolId: ASK_USER_TOOL_ID,
    functionName: ASK_USER_FUNCTION_NAME,
    ok: true,
    summary: buildAskUserResponseSummary(response),
    data: {
      placement: step.placement,
      question: step.question,
      response,
      status: step.status,
    },
  };
}

export function createSkipAskUserResponse(reason?: string): AskUserResponse {
  return reason?.trim() ? { kind: 'skip', reason: reason.trim() } : { kind: 'skip' };
}

export function resolveAskUserStep(step: AssistantAskUserTraceStep, response: AskUserResponse): AssistantAskUserTraceStep {
  return {
    ...step,
    status: response.kind === 'skip' ? 'skipped' : 'answered',
    response,
  };
}

export function getAskUserTurnStats(messages: Chat['messages']): AskUserTurnStats {
  let promptCount = 0;
  let skipCount = 0;
  let hasPendingPrompt = false;

  for (const message of messages) {
    if (message.kind !== 'assistant') {
      continue;
    }

    for (const step of message.trace ?? []) {
      if (step.kind !== 'ask-user') {
        continue;
      }

      promptCount += 1;
      hasPendingPrompt = hasPendingPrompt || step.status === 'pending';
      if (step.status === 'skipped') {
        skipCount += 1;
      }
    }
  }

  return { hasPendingPrompt, promptCount, skipCount };
}

export function findPendingAskUserState(chat: Chat): PendingAskUserState | null {
  for (let messageIndex = chat.messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = chat.messages[messageIndex];
    if (message.kind !== 'assistant') {
      continue;
    }

    for (let stepIndex = (message.trace ?? []).length - 1; stepIndex >= 0; stepIndex -= 1) {
      const step = message.trace?.[stepIndex];
      if (step?.kind === 'ask-user' && step.status === 'pending') {
        return { chatId: chat.id, assistantMessageId: message.id, stepId: step.id };
      }
    }
  }

  return null;
}

export function updateAskUserStepInChat(chat: Chat, assistantMessageId: string, stepId: string, response: AskUserResponse) {
  return {
    ...chat,
    updatedAt: new Date().toISOString(),
    messages: chat.messages.map((message) => {
      if (message.kind !== 'assistant' || message.id !== assistantMessageId) {
        return message;
      }

      return {
        ...message,
        trace: (message.trace ?? []).map((step) => {
          if (step.kind !== 'ask-user' || step.id !== stepId) {
            return step;
          }

          return resolveAskUserStep(step, response);
        }),
      };
    }),
  };
}

export function normalizePendingAskUserChats(chats: Chat[]) {
  let changed = false;
  const nextChats = chats.map((chat) => {
    let chatChanged = false;
    const nextMessages = chat.messages.map((message) => {
      if (message.kind !== 'assistant' || !message.trace?.length) {
        return message;
      }

      let messageChanged = false;
      const nextTrace = message.trace.map((step) => {
        if (step.kind !== 'ask-user' || step.status !== 'pending') {
          return step;
        }

        messageChanged = true;
        return resolveAskUserStep(step, createSkipAskUserResponse('The page reloaded before the answer was submitted.'));
      });

      if (!messageChanged) {
        return message;
      }

      chatChanged = true;
      return { ...message, trace: nextTrace };
    });

    if (!chatChanged) {
      return chat;
    }

    changed = true;
    return { ...chat, messages: nextMessages, updatedAt: new Date().toISOString() };
  });

  return { chats: changed ? nextChats : chats, changed };
}

export function findEndOfResponseAskUserStep(message: AssistantMessage) {
  return (message.trace ?? []).find(
    (step): step is AssistantAskUserTraceStep => step.kind === 'ask-user' && step.placement === 'end_of_response',
  ) ?? null;
}

export function shouldHideToolCallStep(steps: AssistantTraceStep[], index: number) {
  const step = steps[index];
  const nextStep = steps[index + 1];
  return Boolean(
    step?.kind === 'tool-call' &&
      nextStep?.kind === 'ask-user' &&
      nextStep.toolCallId === step.id &&
      isAskUserInvocation(step.invocation),
  );
}

export function getChoiceById(step: AssistantAskUserTraceStep, choiceId: string) {
  return step.choices.find((choice) => choice.id === choiceId) ?? null;
}
