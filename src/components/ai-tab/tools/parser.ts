import { ToolCallRequest } from './types';

const TOOL_CALL_PATTERN = /<tool_call>\s*([\s\S]+?)\s*<\/tool_call>/i;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parseToolCall(content: string) {
  const match = content.match(TOOL_CALL_PATTERN);
  if (!match) {
    return null;
  }

  try {
    const parsed = JSON.parse(match[1]) as unknown;
    if (!isObject(parsed)) {
      return null;
    }

    const tool = typeof parsed.tool === 'string' ? parsed.tool : '';
    const functionName = typeof parsed.function === 'string' ? parsed.function : '';
    const args = isObject(parsed.arguments) ? parsed.arguments : {};

    if (!tool || !functionName) {
      return null;
    }

    return {
      tool,
      function: functionName,
      arguments: args,
    } satisfies ToolCallRequest;
  } catch {
    return null;
  }
}
