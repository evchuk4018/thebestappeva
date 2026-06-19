import {
  createSkill,
  fetchSkillByName,
  fetchSkills,
  updateSkill,
} from '../skills/skills-api';
import {
  parseCreateSkillRequest,
  parseUpdateSkillRequest,
  type CreateSkillRequest,
  type UpdateSkillRequest,
} from '../../../../shared/skills-contract';
import type { ToolInvocation, ToolRegistryEntry, ToolResult } from './types';

function buildError(toolId: string, functionName: string, message: string, data?: Record<string, unknown>): ToolResult {
  return { toolId, functionName, ok: false, summary: message, error: message, data };
}

function requireString(value: unknown, message: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(message);
  return value.trim();
}

function parseCreateRequest(args: Record<string, unknown>): CreateSkillRequest {
  return parseCreateSkillRequest({
    name: requireString(args.name, 'create_skill requires a non-empty `name` argument.'),
    description: requireString(args.description, 'create_skill requires a non-empty `description` argument.'),
    instructions: requireString(args.instructions, 'create_skill requires a non-empty `instructions` argument.'),
    enabled: args.enabled,
    compatibleModes: args.compatibleModes,
    requiredTools: args.requiredTools,
    disabledTools: args.disabledTools,
  });
}

function parseUpdateRequest(args: Record<string, unknown>): { skillName: string; request: UpdateSkillRequest } {
  const skillName = requireString(args.skillName, 'update_skill requires a non-empty `skillName` argument.');
  const request = parseUpdateSkillRequest({
    description: args.description,
    instructions: args.instructions,
    enabled: args.enabled,
    compatibleModes: args.compatibleModes,
    requiredTools: args.requiredTools,
    disabledTools: args.disabledTools,
  });

  if (Object.keys(request).length === 0) {
    throw new Error('update_skill requires at least one field to update.');
  }

  return { skillName, request };
}

export const skillTool: ToolRegistryEntry = {
  definition: {
    id: 'skill',
    label: 'Skill',
    alias: '/skill',
    description: 'Loads, lists, creates, and updates reusable skills for the current workspace.',
    enabledByDefault: true,
    functions: [
      {
        name: 'list_skills',
        description: 'List available skills, including read-only built-ins and editable user-created skills.',
        parameters: [],
      },
      {
        name: 'view_skill',
        description: 'Fetch the full instructions for a named skill.',
        parameters: [
          { name: 'skillName', type: 'string', description: 'Name of the skill to load (without the leading slash).', required: true },
        ],
      },
      {
        name: 'create_skill',
        description: 'Create a new editable workspace skill.',
        parameters: [
          { name: 'name', type: 'string', description: 'Lowercase hyphenated skill name.', required: true },
          { name: 'description', type: 'string', description: 'Trigger-oriented summary of what the skill does.', required: true },
          { name: 'instructions', type: 'string', description: 'Full instructions to load when the skill is used.', required: true },
          { name: 'enabled', type: 'boolean', description: 'Whether the skill should be enabled immediately.' },
          { name: 'compatibleModes', type: 'array', description: 'Optional compatible chat modes.' },
          { name: 'requiredTools', type: 'array', description: 'Optional tool ids the skill depends on.' },
          { name: 'disabledTools', type: 'array', description: 'Optional tool ids the skill should avoid.' },
        ],
      },
      {
        name: 'update_skill',
        description: 'Update an existing editable workspace skill by skill name. Built-in skills are read-only.',
        parameters: [
          { name: 'skillName', type: 'string', description: 'Name of the existing skill to update.', required: true },
          { name: 'description', type: 'string', description: 'Optional replacement description.' },
          { name: 'instructions', type: 'string', description: 'Optional replacement instructions.' },
          { name: 'enabled', type: 'boolean', description: 'Optional enabled flag.' },
          { name: 'compatibleModes', type: 'array', description: 'Optional compatible chat modes.' },
          { name: 'requiredTools', type: 'array', description: 'Optional required tool ids.' },
          { name: 'disabledTools', type: 'array', description: 'Optional disabled tool ids.' },
        ],
      },
    ],
  },
  async execute(invocation) {
    try {
      if (invocation.functionName === 'list_skills') {
        const skills = await fetchSkills();
        return {
          toolId: invocation.toolId,
          functionName: invocation.functionName,
          ok: true,
          summary: `Loaded ${skills.length} skill${skills.length === 1 ? '' : 's'}.`,
          data: { skills },
        };
      }

      if (invocation.functionName === 'view_skill') {
        const skillName = requireString(invocation.args.skillName, 'view_skill requires a non-empty `skillName` argument.');
        const skill = await fetchSkillByName(skillName);
        if (!skill) {
          return buildError(invocation.toolId, invocation.functionName, `Skill "${skillName}" was not found.`);
        }
        return {
          toolId: invocation.toolId,
          functionName: invocation.functionName,
          ok: true,
          summary: `Loaded skill "${skill.name}".`,
          data: {
            name: skill.name,
            description: skill.description,
            instructions: skill.instructions,
            source: skill.source,
            readOnly: skill.readOnly,
            requiredTools: skill.requiredTools,
            disabledTools: skill.disabledTools,
            compatibleModes: skill.compatibleModes,
            hint: 'Apply these instructions for this turn. Respect readOnly built-ins, and ensure required tools are enabled before depending on them.',
          },
        };
      }

      if (invocation.functionName === 'create_skill') {
        const skill = await createSkill(parseCreateRequest(invocation.args));
        return {
          toolId: invocation.toolId,
          functionName: invocation.functionName,
          ok: true,
          summary: `Created skill "${skill.name}".`,
          data: { skill },
        };
      }

      if (invocation.functionName === 'update_skill') {
        const { skillName, request } = parseUpdateRequest(invocation.args);
        const existing = await fetchSkillByName(skillName);
        if (!existing) {
          return buildError(invocation.toolId, invocation.functionName, `Skill "${skillName}" was not found.`);
        }
        if (existing.readOnly) {
          return buildError(invocation.toolId, invocation.functionName, `Skill "${skillName}" is built in and read-only.`);
        }
        const skill = await updateSkill(existing.id, request);
        return {
          toolId: invocation.toolId,
          functionName: invocation.functionName,
          ok: true,
          summary: `Updated skill "${skill.name}".`,
          data: { skill },
        };
      }

      return buildError(invocation.toolId, invocation.functionName, `Unknown skill function "${invocation.functionName}".`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Skill action failed.';
      return buildError(invocation.toolId, invocation.functionName, message);
    }
  },
};
