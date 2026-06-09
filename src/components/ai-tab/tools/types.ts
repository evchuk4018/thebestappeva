import type { ToolInvocation, ToolResult } from '../../../../shared/ai-workspace-contract';

export type { ToolInvocation, ToolResult } from '../../../../shared/ai-workspace-contract';

export interface ToolFunctionParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  schema?: Record<string, unknown>;
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
  automatic?: boolean;
}

export interface ToolCallRequest {
  tool: string;
  function: string;
  arguments?: Record<string, unknown>;
}

export interface ToolExecutionContext {
  model?: string;
  signal?: AbortSignal;
}

export interface ToolExecutionResult extends ToolResult {
  transientImages?: string[];
}

export interface ToolRegistryEntry {
  definition: ToolDefinition;
  execute: (invocation: ToolInvocation, context: ToolExecutionContext) => Promise<ToolExecutionResult>;
}
