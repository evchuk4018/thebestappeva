import { ChatMode } from './types';
import { ToolDefinition } from './tools/types';

export interface SystemPromptContext {
  generatedUserMemory: string;
  customPrompt: string;
  mode: ChatMode;
  tools: ToolDefinition[];
  artifactContext?: string;
}

export interface SystemPromptSection {
  id: 'memory' | 'custom' | 'formatting' | 'workflow' | 'tools' | 'artifacts';
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

const ARTIFACT_WORKFLOW_PROMPT = [
  'When drafting substantial reusable content, prefer creating or updating an artifact instead of dumping the full document into chat.',
  'When the user asks for content in an artifact, call create_artifact for the draft instead of returning the full document only in the chat reply.',
  'Use create_artifact for new documents, list_artifacts to inspect what already exists, get_artifact_outline or search_artifact to locate sections, and fetch_artifact_lines for exact recall.',
  'Prefer update_artifact patches over full replacements when editing existing artifacts.',
  'Preserve user-authored content outside the requested edit range.',
  'Keep Markdown tables valid. Use update_artifact_table for structural table changes when possible.',
  'Export finished artifacts to /docs with export_artifact_to_doc when the user wants a document in the docs workspace.',
].join('\n');

const THINKING_WORKFLOW_SYSTEM_PROMPT = [
  'When the request is short or simple, answer normally.',
  'When the request is multi-step, long-running, or agentic, break your work into explicit thinking blocks.',
  'If one focused clarification from the user would materially improve the answer, call ask_user instead of guessing.',
  'Only use ask_user for high-value clarifications, never more than three times in one turn, and do not keep asking after the user skips twice.',
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
    'The internal ask_user tool pauses the current turn, shows the user a multiple-choice prompt, and resumes after the user answers or skips.',
    'Every tool call must be emitted as one valid JSON tool invocation with no freeform prose or Markdown mixed into the tool arguments.',
    'Enabled tools:',
    ...tools.flatMap((tool) => [
      `- ${tool.label} (${tool.alias}): ${tool.description}`,
      ...tool.functions.map((toolFunction) => `  - ${toolFunction.name}: ${toolFunction.description}`),
    ]),
  ].join('\n');
}

function buildArtifactPromptContent(context: string | undefined) {
  return context?.trim() ? context.trim() : null;
}

export function buildSystemPromptSections(context: SystemPromptContext) {
  const generatedUserMemory = context.generatedUserMemory.trim();
  const customPrompt = context.customPrompt.trim();
  const sections: SystemPromptSection[] = [];
  const workflowPrompt = buildWorkflowPromptContent(context.mode);
  const artifactPrompt = buildArtifactPromptContent(context.artifactContext);

  if (generatedUserMemory) {
    sections.push({
      id: 'memory',
      title: 'Generated memory',
      content: generatedUserMemory,
      readOnly: true,
    });
  }

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
      content: [buildToolPromptContent(context.mode, context.tools), ARTIFACT_WORKFLOW_PROMPT].join('\n\n'),
      readOnly: true,
    },
    ...(artifactPrompt
      ? [{
          id: 'artifacts' as const,
          title: 'Artifact context',
          content: artifactPrompt,
          readOnly: true,
        }]
      : []),
  );

  return sections;
}

export function buildSystemPromptContent(context: SystemPromptContext) {
  return buildSystemPromptSections(context)
    .map((section) => section.content.trim())
    .filter(Boolean)
    .join('\n\n');
}
