import {
  ASK_USER_FUNCTION_NAME,
  ASK_USER_TOOL_ID,
  MAX_ASK_USER_CALLS_PER_TURN,
  MAX_ASK_USER_SKIPS_PER_TURN,
  AskUserPromptPayload,
  createSkipAskUserResponse,
  getAskUserTurnStats,
  PendingAskUserState,
} from './ask-user';
import { createAssistantLiveUpdater } from './assistant-live-message';
import { ToolInvocation, ToolResult, Chat } from './types';

interface ResolveAskUserExecutionOptions {
  chat: Chat;
  invocation: ToolInvocation;
  liveAssistant: ReturnType<typeof createAssistantLiveUpdater>;
  prompt: AskUserPromptPayload;
  toolCallId: string;
  replyModel?: string;
}

type AskUserExecutionResolution =
  | {
      kind: 'continue';
      result: ToolResult;
    }
  | {
      kind: 'pause';
      pending: PendingAskUserState;
    };

function buildGuardrailResult(invocation: ToolInvocation, summary: string): ToolResult {
  return {
    toolId: ASK_USER_TOOL_ID,
    functionName: ASK_USER_FUNCTION_NAME,
    ok: true,
    summary,
    data: {
      autoResolved: true,
      originalInvocation: invocation.args,
      response: createSkipAskUserResponse(summary),
    },
  };
}

export function resolveAskUserExecution({
  chat,
  invocation,
  liveAssistant,
  prompt,
  toolCallId,
  replyModel,
}: ResolveAskUserExecutionOptions): AskUserExecutionResolution {
  const stats = getAskUserTurnStats(chat.messages);

  if (stats.hasPendingPrompt) {
    return {
      kind: 'continue',
      result: buildGuardrailResult(invocation, 'Skipped a duplicate ask_user prompt because another one is already pending in this turn.'),
    };
  }

  if (stats.promptCount >= MAX_ASK_USER_CALLS_PER_TURN) {
    return {
      kind: 'continue',
      result: buildGuardrailResult(invocation, 'Skipped ask_user because this assistant turn already used three ask_user prompts.'),
    };
  }

  if (stats.skipCount >= MAX_ASK_USER_SKIPS_PER_TURN) {
    return {
      kind: 'continue',
      result: buildGuardrailResult(invocation, 'Skipped ask_user because the user already skipped twice in this turn.'),
    };
  }

  const pending = liveAssistant.appendAskUser(
    {
      toolCallId,
      question: prompt.question,
      choices: prompt.choices,
      allowOpenEnded: prompt.allowOpenEnded,
      openEndedPlaceholder: prompt.openEndedPlaceholder,
      placement: prompt.placement,
      required: prompt.required,
      status: 'pending',
      createdAt: invocation.createdAt,
    },
    replyModel,
  );

  return {
    kind: 'pause',
    pending: {
      chatId: liveAssistant.getChat().id,
      assistantMessageId: pending.assistantMessageId,
      stepId: pending.stepId,
    },
  };
}
