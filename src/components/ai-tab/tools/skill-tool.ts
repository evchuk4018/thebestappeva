import { fetchSkillByName } from '../skills/skills-api';
import type { ToolInvocation, ToolRegistryEntry, ToolResult } from './types';

function buildError(toolId: string, functionName: string, message: string, data?: Record<string, unknown>): ToolResult {
  return { toolId, functionName, ok: false, summary: message, error: message, data };
}

function requireString(value: unknown, message: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(message);
  return value.trim();
}

export const skillTool: ToolRegistryEntry = {
  definition: {
    id: 'skill',
    label: 'Skill',
    alias: '/skill',
    description: 'Loads a reusable skill by name so its full instructions are available in the response. Use when the user references /<skill-name> or when a skill description matches the request.',
    enabledByDefault: true,
    functions: [
      {
        name: 'view_skill',
        description: 'Fetch the full instructions for a named skill. Returns the skill description, instructions, and any required or disabled tools.',
        parameters: [
          { name: 'skillName', type: 'string', description: 'Name of the skill to load (without the leading slash).', required: true },
        ],
      },
    ],
  },
  async execute(invocation: ToolInvocation) {
    try {
      const skillName = requireString(invocation.args.skillName, 'view_skill requires a non-empty `skillName` argument.');
      const skill = await fetchSkillByName(skillName);
      if (!skill) {
        return buildError(invocation.toolId, invocation.functionName, `Skill "${skillName}" was not found or is not enabled.`);
      }
      const hint = 'Apply the instructions below for this turn. If requiredTools are listed, ensure those tools are enabled before proceeding; if disabledTools are listed, avoid calling those tools while this skill is active.';
      return {
        toolId: invocation.toolId,
        functionName: invocation.functionName,
        ok: true,
        summary: `Loaded skill "${skill.name}".`,
        data: {
          name: skill.name,
          description: skill.description,
          instructions: skill.instructions,
          requiredTools: skill.requiredTools,
          disabledTools: skill.disabledTools,
          compatibleModes: skill.compatibleModes,
          hint,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Skill lookup failed.';
      return buildError(invocation.toolId, invocation.functionName, message);
    }
  },
};