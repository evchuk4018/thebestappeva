import type { AssistantTraceStep, ToolInvocation, ToolResult } from './types';
import { PYTHON_EXEC_FUNCTION_NAME, PYTHON_EXEC_TOOL_ID } from './tools/python-exec-contract';
import type { PythonExecGeneratedFile, PythonExecStagedFile } from './tools/python-exec-contract';

export interface PythonTraceInspection {
  code: string;
  durationMs: number | null;
  exitCode: number | null;
  generatedFiles: PythonExecGeneratedFile[];
  requestedFiles: string[];
  stagedFiles: PythonExecStagedFile[];
  stderr: string;
  stdout: string;
}

function isPythonInvocation(invocation: Pick<ToolInvocation, 'functionName' | 'toolId'>) {
  return invocation.toolId === PYTHON_EXEC_TOOL_ID && invocation.functionName === PYTHON_EXEC_FUNCTION_NAME;
}

function isPythonResult(result: Pick<ToolResult, 'functionName' | 'toolId'>) {
  return result.toolId === PYTHON_EXEC_TOOL_ID && result.functionName === PYTHON_EXEC_FUNCTION_NAME;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readStagedFiles(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is PythonExecStagedFile =>
      Boolean(entry)
      && typeof entry === 'object'
      && typeof (entry as PythonExecStagedFile).requestedPath === 'string'
      && typeof (entry as PythonExecStagedFile).sandboxPath === 'string'
      && typeof (entry as PythonExecStagedFile).sizeBytes === 'number')
    : [];
}

function readGeneratedFiles(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is PythonExecGeneratedFile =>
      Boolean(entry)
      && typeof entry === 'object'
      && typeof (entry as PythonExecGeneratedFile).path === 'string'
      && typeof (entry as PythonExecGeneratedFile).preview === 'string'
      && typeof (entry as PythonExecGeneratedFile).sizeBytes === 'number'
      && typeof (entry as PythonExecGeneratedFile).truncated === 'boolean')
    : [];
}

function findMatchingInvocation(steps: AssistantTraceStep[], index: number) {
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    const step = steps[cursor];
    if (step?.kind !== 'tool-call' || !isPythonInvocation(step.invocation)) {
      continue;
    }
    if (steps[index]?.kind !== 'tool-result') {
      return step.invocation;
    }
    if (!steps[index].result.toolCallId || steps[index].result.toolCallId === step.invocation.toolCallId) {
      return step.invocation;
    }
  }

  return null;
}

function findMatchingResult(steps: AssistantTraceStep[], index: number) {
  for (let cursor = index; cursor < steps.length; cursor += 1) {
    const step = steps[cursor];
    if (step?.kind !== 'tool-result' || !isPythonResult(step.result)) {
      continue;
    }
    if (steps[index]?.kind !== 'tool-call') {
      return step.result;
    }
    if (!steps[index].invocation.toolCallId || steps[index].invocation.toolCallId === step.result.toolCallId) {
      return step.result;
    }
  }

  return null;
}

export function buildPythonTraceInspection(steps: AssistantTraceStep[], index: number): PythonTraceInspection | null {
  const current = steps[index];
  if (!current) {
    return null;
  }

  const invocation = current.kind === 'tool-call'
    ? (isPythonInvocation(current.invocation) ? current.invocation : null)
    : findMatchingInvocation(steps, index);
  const result = current.kind === 'tool-result'
    ? (isPythonResult(current.result) ? current.result : null)
    : findMatchingResult(steps, index);

  if (!invocation && !result) {
    return null;
  }

  const data = result?.data ?? {};
  return {
    code: typeof invocation?.args.code === 'string' ? invocation.args.code : '',
    requestedFiles: readStringArray(invocation?.args.files),
    stagedFiles: readStagedFiles(data.stagedFiles),
    generatedFiles: readGeneratedFiles(data.generatedFiles),
    stdout: typeof data.stdout === 'string' ? data.stdout : '',
    stderr: typeof data.stderr === 'string' ? data.stderr : '',
    exitCode: readNumber(data.exitCode),
    durationMs: readNumber(data.durationMs),
  };
}
