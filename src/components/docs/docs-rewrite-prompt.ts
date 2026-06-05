import { OllamaChatMessage } from '../../lib/ollama/runtime';

export function buildDocsRewritePrompt(selectedText: string, instruction: string): OllamaChatMessage[] {
  const normalizedInstruction = instruction.trim() || 'Improve the grammar and clarity while keeping the original meaning.';

  return [
    {
      role: 'system',
      content: 'You rewrite selected document text. Return only the rewritten text. Do not add quotes, markdown, bullets, commentary, or explanations.',
    },
    {
      role: 'user',
      content: `Instruction:\n${normalizedInstruction}\n\nSelected text:\n${selectedText}`,
    },
  ];
}
