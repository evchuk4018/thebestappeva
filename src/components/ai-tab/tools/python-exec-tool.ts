import { executePython } from './python-exec-service';
import {
  PYTHON_EXEC_FUNCTION_NAME,
  PYTHON_EXEC_TOOL_ID,
  type PythonExecResponse,
} from './python-exec-contract';
import { ToolExecutionContext, ToolRegistryEntry, ToolResult } from './types';

function readCode(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('python_exec requires a non-empty `code` argument.');
  }
  return value;
}

function readFiles(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];
}

function buildSummary(payload: PythonExecResponse) {
  const duration = `${Math.max(0, Math.round(payload.durationMs))}ms`;
  if (payload.exitCode === 0) {
    const firstLine = payload.stdout.trim().split(/\r?\n/).find(Boolean);
    return firstLine
      ? `Python ran successfully in ${duration}. First output: ${firstLine.slice(0, 120)}`
      : `Python ran successfully in ${duration}.`;
  }

  return `Python exited with code ${payload.exitCode} after ${duration}.`;
}

function buildErrorResult(functionName: string, message: string): ToolResult {
  return {
    toolId: PYTHON_EXEC_TOOL_ID,
    functionName,
    ok: false,
    summary: message,
    error: message,
  };
}

export const pythonExecTool: ToolRegistryEntry = {
  definition: {
    id: PYTHON_EXEC_TOOL_ID,
    label: 'Python Exec',
    alias: '/python.exec',
    description: 'Runs private Python code in a local sandbox with writable work/ and staged repo files in inputs/.',
    enabledByDefault: false,
    functions: [
      {
        name: PYTHON_EXEC_FUNCTION_NAME,
        description: 'Execute Python code privately. Requested repo files are copied into inputs/ and code runs in work/.',
        parameters: [
          { name: 'code', type: 'string', description: 'Python code to execute in the local sandbox.', required: true },
          {
            name: 'files',
            type: 'array',
            description: 'Optional repo-relative files to stage as read-only inputs for the Python code.',
            schema: {
              type: 'array',
              description: 'Optional repo-relative files to stage as read-only inputs.',
              items: { type: 'string' },
            },
          },
        ],
      },
    ],
  },
  async execute(invocation, context: ToolExecutionContext) {
    try {
      const payload = await executePython({
        code: readCode(invocation.args.code),
        files: readFiles(invocation.args.files),
        signal: context.signal,
      });

      return {
        toolId: invocation.toolId,
        functionName: invocation.functionName,
        ok: payload.exitCode === 0,
        summary: buildSummary(payload),
        data: payload,
        ...(payload.exitCode === 0 ? {} : { error: payload.stderr.trim() || `Python exited with code ${payload.exitCode}.` }),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Python execution failed.';
      return buildErrorResult(invocation.functionName, message);
    }
  },
};
