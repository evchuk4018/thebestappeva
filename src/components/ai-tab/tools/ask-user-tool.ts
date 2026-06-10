import {
  ASK_USER_FUNCTION_NAME,
  ASK_USER_TOOL_ID,
  AskUserPromptPayload,
  MAX_ASK_USER_CHOICES,
  MAX_ASK_USER_DESCRIPTION_LENGTH,
  MAX_ASK_USER_TEXT_LENGTH,
} from '../ask-user';
import { ToolExecutionOutcome, ToolRegistryEntry } from './types';

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildToolResult(summary: string): ToolExecutionOutcome {
  return {
    toolId: ASK_USER_TOOL_ID,
    functionName: ASK_USER_FUNCTION_NAME,
    ok: false,
    summary,
    error: summary,
  };
}

function parseChoices(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_ASK_USER_CHOICES) {
    return null;
  }

  const choices = value
    .map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return null;
      }

      const id = asTrimmedString((item as { id?: unknown }).id) || `choice-${index + 1}`;
      const label = asTrimmedString((item as { label?: unknown }).label);
      const description = asTrimmedString((item as { description?: unknown }).description);
      if (!label || label.length > MAX_ASK_USER_TEXT_LENGTH || description.length > MAX_ASK_USER_DESCRIPTION_LENGTH) {
        return null;
      }

      return { id, label, description: description || undefined };
    })
    .filter(Boolean);

  return choices.length === value.length ? choices : null;
}

function normalizePrompt(args: Record<string, unknown>): AskUserPromptPayload | string {
  const question = asTrimmedString(args.question);
  if (!question || question.length > MAX_ASK_USER_TEXT_LENGTH) {
    return 'ask_user requires a non-empty `question` under 280 characters.';
  }

  const choices = parseChoices(args.choices);
  if (!choices) {
    return 'ask_user requires `choices` as an array of 1-6 labeled options.';
  }

  const placement = asTrimmedString(args.placement) || 'inline_trace';
  if (placement !== 'inline_trace' && placement !== 'end_of_response') {
    return 'ask_user only supports `placement` values "inline_trace" or "end_of_response".';
  }

  const allowOpenEnded = typeof args.allow_open_ended === 'boolean' ? args.allow_open_ended : true;
  const openEndedPlaceholder = asTrimmedString(args.open_ended_placeholder);
  const required = typeof args.required === 'boolean' ? args.required : false;

  return {
    question,
    choices,
    allowOpenEnded,
    openEndedPlaceholder: openEndedPlaceholder ? openEndedPlaceholder.slice(0, MAX_ASK_USER_TEXT_LENGTH) : undefined,
    placement,
    required,
  };
}

export const askUserTool: ToolRegistryEntry = {
  definition: {
    id: ASK_USER_TOOL_ID,
    label: 'Ask User',
    alias: '/ask-user',
    description: 'Pauses a Thinking turn and asks the user a focused multiple-choice follow-up.',
    enabledByDefault: true,
    internal: true,
    functions: [
      {
        name: ASK_USER_FUNCTION_NAME,
        description: 'Ask the user a short multiple-choice follow-up when one focused clarification would materially improve the answer.',
        parameters: [
          { name: 'question', type: 'string', description: 'Short question shown to the user.', required: true },
          {
            name: 'choices',
            type: 'array',
            description: 'One to six choices, each with id, label, and optional description.',
            required: true,
          },
          { name: 'allow_open_ended', type: 'boolean', description: 'Whether the user may type a custom answer.' },
          { name: 'open_ended_placeholder', type: 'string', description: 'Optional placeholder shown for a typed custom answer.' },
          { name: 'placement', type: 'string', description: 'Either `inline_trace` or `end_of_response`.' },
          { name: 'required', type: 'boolean', description: 'Controls prompt copy and close affordance only; skip remains available.' },
        ],
      },
    ],
  },
  async execute(invocation) {
    const normalized = normalizePrompt(invocation.args);
    if (typeof normalized === 'string') {
      return buildToolResult(normalized);
    }

    return {
      deferred: true,
      prompt: normalized,
    };
  },
};
