import type { AssistantToolCallTraceStep, AssistantTraceStep } from './types';

export const IMAGE_TOOL_RETRY_INDICATOR_MS = 30_500;
export const PYTHON_EXEC_RUNNING_INDICATOR_MS = 8_000;

interface ToolProgressPayload {
  status: 'running' | 'retrying';
  attempt: number;
  message: string;
}

let retryIndicatorDelayMs = IMAGE_TOOL_RETRY_INDICATOR_MS;
let pythonIndicatorDelayMs = PYTHON_EXEC_RUNNING_INDICATOR_MS;

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

function buildPayload(toolId: string): ToolProgressPayload | null {
  if (toolId === 'image-bridge') {
    return { status: 'retrying', attempt: 2, message: 'The first image attempt timed out. Retrying once.' };
  }
  if (toolId === 'python.exec') {
    return { status: 'running', attempt: 1, message: 'Python is still running…' };
  }
  return null;
}

export function scheduleImageToolRetryIndicator(toolId: string, onStatus: (payload: ToolProgressPayload) => void) {
  const payload = buildPayload(toolId);
  if (!payload) {
    return { cancel() {} };
  }
  const delay = toolId === 'python.exec' ? pythonIndicatorDelayMs : retryIndicatorDelayMs;
  const timeoutId = globalThis.setTimeout(() => onStatus(payload), delay);
  return {
    cancel() {
      globalThis.clearTimeout(timeoutId);
    },
  };
}

export function setImageToolRetryIndicatorDelayForTests(delayMs: number | null) {
  retryIndicatorDelayMs = typeof delayMs === 'number' ? delayMs : IMAGE_TOOL_RETRY_INDICATOR_MS;
}

export function setPythonExecIndicatorDelayForTests(delayMs: number | null) {
  pythonIndicatorDelayMs = typeof delayMs === 'number' ? delayMs : PYTHON_EXEC_RUNNING_INDICATOR_MS;
}