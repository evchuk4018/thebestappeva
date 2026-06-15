import { MAX_CONSECUTIVE_TOOL_ERRORS } from './tools/executor';
import type { SystemPromptContext } from './system-prompt';
import type { ToolExecutionResult, ToolInvocation, ToolRegistryEntry } from './tools/types';

interface TurnToolState {
  consecutiveFailureCount: number;
  consecutiveFailureToolId: string | null;
  disabledToolIds: Set<string>;
  lastWarning: string | null;
}

interface RecordedToolResult {
  result: ToolExecutionResult;
  warningMessage: string | null;
}

function buildRetiredToolInstruction(toolId: string) {
  return `The tool "${toolId}" is temporarily unavailable for the rest of this turn after repeated failures. Do not call "${toolId}" again in this turn. Try another enabled tool or explain the limitation to the user.`;
}

function buildRetiredToolWarning(toolId: string) {
  return `The tool "${toolId}" failed three times in a row and was disabled for the rest of this turn.`;
}

function appendInstruction(message: string | undefined, instruction: string) {
  const trimmed = message?.trim();
  return trimmed ? `${trimmed} ${instruction}` : instruction;
}

export function createTurnToolState(): TurnToolState {
  return {
    consecutiveFailureCount: 0,
    consecutiveFailureToolId: null,
    disabledToolIds: new Set<string>(),
    lastWarning: null,
  };
}

export function buildDisabledToolResult(invocation: ToolInvocation): ToolExecutionResult {
  const message = buildRetiredToolInstruction(invocation.toolId);
  return {
    toolId: invocation.toolId,
    functionName: invocation.functionName,
    ok: false,
    summary: message,
    error: message,
  };
}

export function resetTurnToolFailureStreak(state: TurnToolState) {
  state.consecutiveFailureCount = 0;
  state.consecutiveFailureToolId = null;
}

export function filterTurnToolEntries(entries: ToolRegistryEntry[], disabledToolIds: Set<string>) {
  return entries.filter((entry) => !disabledToolIds.has(entry.definition.id));
}

export function getTurnPromptContext(promptContext: SystemPromptContext, entries: ToolRegistryEntry[]): SystemPromptContext {
  return {
    ...promptContext,
    tools: entries.map((entry) => entry.definition),
  };
}

export function recordTurnToolResult(state: TurnToolState, result: ToolExecutionResult): RecordedToolResult {
  if (state.disabledToolIds.has(result.toolId)) {
    return { result, warningMessage: state.lastWarning };
  }

  if (result.ok) {
    resetTurnToolFailureStreak(state);
    return { result, warningMessage: null };
  }

  state.consecutiveFailureCount = state.consecutiveFailureToolId === result.toolId ? state.consecutiveFailureCount + 1 : 1;
  state.consecutiveFailureToolId = result.toolId;
  if (state.consecutiveFailureCount < MAX_CONSECUTIVE_TOOL_ERRORS) {
    return { result, warningMessage: null };
  }

  resetTurnToolFailureStreak(state);
  state.disabledToolIds.add(result.toolId);
  state.lastWarning = buildRetiredToolWarning(result.toolId);

  const instruction = buildRetiredToolInstruction(result.toolId);
  return {
    result: {
      ...result,
      summary: appendInstruction(result.summary, instruction),
      error: appendInstruction(result.error ?? result.summary, instruction),
    },
    warningMessage: state.lastWarning,
  };
}
