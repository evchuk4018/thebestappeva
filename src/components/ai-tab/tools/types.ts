export interface ToolFunctionParameter {
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  required?: boolean;
}

export interface ToolFunctionDefinition {
  name: string;
  description: string;
  parameters: ToolFunctionParameter[];
}

export interface ToolDefinition {
  id: string;
  label: string;
  alias: string;
  description: string;
  functions: ToolFunctionDefinition[];
  enabledByDefault: boolean;
}

export interface ToolInvocation {
  toolId: string;
  functionName: string;
  args: Record<string, unknown>;
  createdAt: string;
}

export interface ToolResult {
  toolId: string;
  functionName: string;
  ok: boolean;
  summary: string;
  data?: Record<string, unknown>;
  error?: string;
}

export interface ToolCallRequest {
  tool: string;
  function: string;
  arguments?: Record<string, unknown>;
}

export interface ToolExecutionContext {
  signal?: AbortSignal;
}

export interface ToolRegistryEntry {
  definition: ToolDefinition;
  execute: (invocation: ToolInvocation, context: ToolExecutionContext) => Promise<ToolResult>;
}
