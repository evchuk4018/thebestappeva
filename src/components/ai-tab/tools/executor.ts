import { ToolInvocation, ToolRegistryEntry, ToolResult } from './types';

export const MAX_TOOL_CALL_DEPTH = 3;

function buildMissingToolResult(invocation: ToolInvocation): ToolResult {
  return {
    toolId: invocation.toolId,
    functionName: invocation.functionName,
    ok: false,
    summary: `The tool "${invocation.toolId}" is unavailable or disabled.`,
    error: `The tool "${invocation.toolId}" is unavailable or disabled.`,
  };
}

export async function executeToolInvocation(invocation: ToolInvocation, entries: ToolRegistryEntry[]) {
  const entry = entries.find((candidate) => candidate.definition.id === invocation.toolId);
  if (!entry) {
    return buildMissingToolResult(invocation);
  }

  const supportedFunction = entry.definition.functions.some((candidate) => candidate.name === invocation.functionName);
  if (!supportedFunction) {
    return {
      toolId: invocation.toolId,
      functionName: invocation.functionName,
      ok: false,
      summary: `The tool "${invocation.toolId}" does not support "${invocation.functionName}".`,
      error: `The tool "${invocation.toolId}" does not support "${invocation.functionName}".`,
    };
  }

  try {
    return await entry.execute(invocation);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The tool failed unexpectedly.';
    return {
      toolId: invocation.toolId,
      functionName: invocation.functionName,
      ok: false,
      summary: message,
      error: message,
    };
  }
}
