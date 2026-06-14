import { ToolInvocation } from './types';
import {
  PYTHON_EXEC_CODE_PLACEHOLDER,
  PYTHON_EXEC_FUNCTION_NAME,
  PYTHON_EXEC_TOOL_ID,
} from './python-exec-contract';

function normalizeFiles(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : undefined;
}

export function toPersistedToolInvocation(invocation: ToolInvocation): ToolInvocation {
  if (invocation.toolId !== PYTHON_EXEC_TOOL_ID || invocation.functionName !== PYTHON_EXEC_FUNCTION_NAME) {
    return invocation;
  }

  return {
    ...invocation,
    displayArgs: {
      ...invocation.args,
      code: PYTHON_EXEC_CODE_PLACEHOLDER,
      ...(normalizeFiles(invocation.args.files) ? { files: normalizeFiles(invocation.args.files) } : {}),
    },
  };
}
