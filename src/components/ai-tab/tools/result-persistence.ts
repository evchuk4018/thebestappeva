import { ToolResult } from './types';

export function toPersistedToolResult(result: ToolResult): ToolResult {
  if (result.toolId !== 'pdf-reader') {
    return result;
  }

  return {
    toolId: result.toolId,
    functionName: result.functionName,
    ok: result.ok,
    summary: result.summary,
    error: result.error,
  };
}
