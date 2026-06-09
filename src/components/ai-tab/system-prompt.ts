import { ChatMode } from './types';
import { ToolDefinition } from './tools/types';

export interface SystemPromptContext {
  customPrompt: string;
  mode: ChatMode;
  tools: ToolDefinition[];
}

export interface SystemPromptSection {
  id: 'custom' | 'formatting' | 'workflow' | 'tools';
  title: string;
  content: string;
  readOnly: boolean;
}

const FORMATTING_SYSTEM_PROMPT = [
  'You may use rich Markdown in assistant replies when it improves clarity.',
  'Supported output includes headings, bold, italics, ordered and unordered lists, links, blockquotes, fenced code blocks, tables, task lists, and horizontal rules.',
  'Use inline math with $...$ when mathematical notation is helpful.',
  'For display math, put $$ on separate lines before and after the equation block.',
  'Do not use raw HTML unless the user explicitly asks for HTML.',
  'Do not wrap the entire reply in a single code fence.',
].join('\n');

const THINKING_WORKFLOW_SYSTEM_PROMPT = [
  'When the request is short or simple, answer normally.',
  'When the request is multi-step, long-running, or agentic, break your work into explicit thinking blocks.',
  'Start by identifying the main tasks in the reasoning trace.',
  'Work through one task block at a time.',
  'After each completed block, tool batch, or meaningful pivot, emit a brief progress checkpoint in the reasoning trace.',
  'Keep reasoning checkpoints concise and user-facing.',
  'Reserve the final assistant reply content for the final summary or result, not another progress update.',
].join('\n');

function buildWorkflowPromptContent(mode: ChatMode) {
  if (mode !== 'thinking') {
    return null;
  }

  return ['Current mode workflow: Thinking.', THINKING_WORKFLOW_SYSTEM_PROMPT].join('\n');
}

function buildToolPromptContent(mode: ChatMode, tools: ToolDefinition[]) {
  if (mode === 'flash') {
    return ['Current mode: Flash.', 'Tools are unavailable in this mode. Answer directly without attempting tool calls.'].join('\n');
  }

  if (!tools.length) {
    return ['Current mode: Thinking.', 'No tools are currently enabled for this turn. Answer directly unless the user enables tools.'].join('\n');
  }

  return [
    'Current mode: Thinking.',
    'You may call the enabled local tools below when they materially help answer the user.',
    'Enabled tools:',
    ...tools.flatMap((tool) => [
      `- ${tool.label} (${tool.alias}): ${tool.description}`,
      ...tool.functions.map((toolFunction) => `  - ${toolFunction.name}: ${toolFunction.description}`),
    ]),
  ].join('\n');
}

export function buildSystemPromptSections(context: SystemPromptContext) {
  const customPrompt = context.customPrompt.trim();
  const sections: SystemPromptSection[] = [];
  const workflowPrompt = buildWorkflowPromptContent(context.mode);

  if (customPrompt) {
    sections.push({
      id: 'custom',
      title: 'Custom instructions',
      content: customPrompt,
      readOnly: false,
    });
  }

  sections.push(
    {
      id: 'formatting',
      title: 'Markdown guidance',
      content: FORMATTING_SYSTEM_PROMPT,
      readOnly: true,
    },
    ...(workflowPrompt
      ? [{
          id: 'workflow' as const,
          title: 'Thinking workflow',
          content: workflowPrompt,
          readOnly: true,
        }]
      : []),
    {
      id: 'tools',
      title: 'Tool context',
      content: buildToolPromptContent(context.mode, context.tools),
      readOnly: true,
    },
  );

  return sections;
}

export function buildSystemPromptContent(context: SystemPromptContext) {
  return buildSystemPromptSections(context)
    .map((section) => section.content.trim())
    .filter(Boolean)
    .join('\n\n');
}
