import type { AssistantToolCallTraceStep, AssistantTraceStep } from './types';

export const IMAGE_TOOL_RETRY_INDICATOR_MS = 30_500;

let retryIndicatorDelayMs = IMAGE_TOOL_RETRY_INDICATOR_MS;

function hasMatchingToolResult(step: AssistantToolCallTraceStep, steps: AssistantTraceStep[], index: number) {
  return steps.slice(index + 1).some((candidate) => (
    candidate.kind === 'tool-result'
    && candidate.result.toolCallId
    && candidate.result.toolCallId === step.invocation.toolCallId
  ));
}

export function isPendingToolCallStep(step: AssistantToolCallTraceStep, steps: AssistantTraceStep[], index: number) {
  return !hasMatchingToolResult(step, steps, index);
}

export function scheduleImageToolRetryIndicator(toolId: string, onRetrying: () => void) {
  if (toolId !== 'image-bridge') {
    return { cancel() {} };
  }
  const timeoutId = globalThis.setTimeout(onRetrying, retryIndicatorDelayMs);
  return {
    cancel() {
      globalThis.clearTimeout(timeoutId);
    },
  };
}

export function setImageToolRetryIndicatorDelayForTests(delayMs: number | null) {
  retryIndicatorDelayMs = typeof delayMs === 'number' ? delayMs : IMAGE_TOOL_RETRY_INDICATOR_MS;
}
