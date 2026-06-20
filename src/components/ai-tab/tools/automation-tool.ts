import {
  type CreateAutomationRequest,
  type UpdateAutomationRequest,
} from '../../../../shared/automations-contract';
import {
  createAutomation,
  deleteAutomation,
  fetchAutomations,
  toggleAutomation,
  updateAutomation,
} from '../automations/automations-api';
import type { ToolRegistryEntry, ToolResult } from './types';

function buildError(toolId: string, functionName: string, message: string, data?: Record<string, unknown>): ToolResult {
  return { toolId, functionName, ok: false, summary: message, error: message, data };
}

function requireString(value: unknown, message: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(message);
  return value.trim();
}

function parseCreateRequest(args: Record<string, unknown>): CreateAutomationRequest {
  return {
    name: requireString(args.name, 'create_automation requires a non-empty `name` argument.'),
    description: requireString(args.description, 'create_automation requires a non-empty `description` argument.'),
    kind: args.kind === 'schedule' || args.kind === 'conversation' ? args.kind : (() => { throw new Error('create_automation requires `kind` to be "schedule" or "conversation".'); })(),
    trigger: (args.trigger ?? {}) as CreateAutomationRequest['trigger'],
    action: {
      prompt: requireString(args.prompt, 'create_automation requires a non-empty `prompt` argument.'),
      linkedSkillId: typeof args.linkedSkillId === 'string' ? args.linkedSkillId : null,
      linkedSkillName: typeof args.linkedSkillName === 'string' ? args.linkedSkillName : null,
      requiredTools: Array.isArray(args.requiredTools) ? args.requiredTools as string[] : [],
      disabledTools: Array.isArray(args.disabledTools) ? args.disabledTools as string[] : [],
    },
    enabled: typeof args.enabled === 'boolean' ? args.enabled : true,
  };
}

function parseUpdateRequest(args: Record<string, unknown>): { automationName: string; request: UpdateAutomationRequest } {
  const automationName = requireString(args.automationName, 'update_automation requires a non-empty `automationName` argument.');
  const request: UpdateAutomationRequest = {};
  if (typeof args.name === 'string' && args.name.trim()) request.name = args.name.trim();
  if (typeof args.description === 'string' && args.description.trim()) request.description = args.description.trim();
  if (args.kind === 'schedule' || args.kind === 'conversation') request.kind = args.kind;
  if (args.trigger) request.trigger = args.trigger as UpdateAutomationRequest['trigger'];
  if (args.prompt || args.linkedSkillId || args.linkedSkillName || args.requiredTools || args.disabledTools) {
    request.action = {
      prompt: typeof args.prompt === 'string' ? args.prompt.trim() : '',
      linkedSkillId: typeof args.linkedSkillId === 'string' ? args.linkedSkillId : null,
      linkedSkillName: typeof args.linkedSkillName === 'string' ? args.linkedSkillName : null,
      requiredTools: Array.isArray(args.requiredTools) ? args.requiredTools as string[] : [],
      disabledTools: Array.isArray(args.disabledTools) ? args.disabledTools as string[] : [],
    };
  }
  if (typeof args.enabled === 'boolean') request.enabled = args.enabled;
  if (!Object.keys(request).length) throw new Error('update_automation requires at least one field to update.');
  return { automationName, request };
}

async function findAutomationIdByName(name: string) {
  return (await fetchAutomations()).find((automation) => automation.name === name)?.id ?? null;
}

export const automationTool: ToolRegistryEntry = {
  definition: {
    id: 'automation',
    label: 'Automation',
    alias: '/automation',
    description: 'Creates, inspects, updates, toggles, and deletes workspace automations.',
    enabledByDefault: true,
    functions: [
      { name: 'list_automations', description: 'List all automations in the workspace.', parameters: [] },
      { name: 'view_automation', description: 'View one automation by name.', parameters: [{ name: 'automationName', type: 'string', description: 'Exact automation name.', required: true }] },
      { name: 'create_automation', description: 'Create a new automation.', parameters: [{ name: 'name', type: 'string', description: 'Automation name.', required: true }, { name: 'description', type: 'string', description: 'Automation description.', required: true }, { name: 'kind', type: 'string', description: '"schedule" or "conversation".', required: true }, { name: 'trigger', type: 'object', description: 'Schedule or conversation trigger object.', required: true }, { name: 'prompt', type: 'string', description: 'Prompt to run when triggered.', required: true }, { name: 'linkedSkillId', type: 'string', description: 'Optional linked skill id.' }, { name: 'linkedSkillName', type: 'string', description: 'Optional linked skill name.' }, { name: 'requiredTools', type: 'array', description: 'Optional required tool ids.' }, { name: 'disabledTools', type: 'array', description: 'Optional disabled tool ids.' }, { name: 'enabled', type: 'boolean', description: 'Whether the automation is enabled.' }] },
      { name: 'update_automation', description: 'Update an existing automation by name.', parameters: [{ name: 'automationName', type: 'string', description: 'Exact automation name.', required: true }, { name: 'name', type: 'string', description: 'Optional new name.' }, { name: 'description', type: 'string', description: 'Optional new description.' }, { name: 'kind', type: 'string', description: 'Optional new kind.' }, { name: 'trigger', type: 'object', description: 'Optional replacement trigger object.' }, { name: 'prompt', type: 'string', description: 'Optional replacement prompt.' }, { name: 'linkedSkillId', type: 'string', description: 'Optional linked skill id.' }, { name: 'linkedSkillName', type: 'string', description: 'Optional linked skill name.' }, { name: 'requiredTools', type: 'array', description: 'Optional required tool ids.' }, { name: 'disabledTools', type: 'array', description: 'Optional disabled tool ids.' }, { name: 'enabled', type: 'boolean', description: 'Optional enabled value.' }] },
      { name: 'toggle_automation', description: 'Enable or disable an automation by name.', parameters: [{ name: 'automationName', type: 'string', description: 'Exact automation name.', required: true }, { name: 'enabled', type: 'boolean', description: 'True to enable, false to disable.', required: true }] },
      { name: 'delete_automation', description: 'Delete an automation by name.', parameters: [{ name: 'automationName', type: 'string', description: 'Exact automation name.', required: true }] },
    ],
  },
  async execute(invocation) {
    try {
      if (invocation.functionName === 'list_automations') {
        const automations = await fetchAutomations();
        return { toolId: invocation.toolId, functionName: invocation.functionName, ok: true, summary: `Loaded ${automations.length} automation${automations.length === 1 ? '' : 's'}.`, data: { automations } };
      }
      if (invocation.functionName === 'view_automation') {
        const automationName = requireString(invocation.args.automationName, 'view_automation requires a non-empty `automationName` argument.');
        const automation = (await fetchAutomations()).find((entry) => entry.name === automationName);
        return automation
          ? { toolId: invocation.toolId, functionName: invocation.functionName, ok: true, summary: `Loaded automation "${automation.name}".`, data: { automation } }
          : buildError(invocation.toolId, invocation.functionName, `Automation "${automationName}" was not found.`);
      }
      if (invocation.functionName === 'create_automation') {
        const automation = await createAutomation(parseCreateRequest(invocation.args));
        return { toolId: invocation.toolId, functionName: invocation.functionName, ok: true, summary: `Created automation "${automation.name}".`, data: { automation } };
      }
      if (invocation.functionName === 'update_automation') {
        const { automationName, request } = parseUpdateRequest(invocation.args);
        const automationId = await findAutomationIdByName(automationName);
        if (!automationId) return buildError(invocation.toolId, invocation.functionName, `Automation "${automationName}" was not found.`);
        const automation = await updateAutomation(automationId, request);
        return { toolId: invocation.toolId, functionName: invocation.functionName, ok: true, summary: `Updated automation "${automation.name}".`, data: { automation } };
      }
      if (invocation.functionName === 'toggle_automation') {
        const automationName = requireString(invocation.args.automationName, 'toggle_automation requires a non-empty `automationName` argument.');
        if (typeof invocation.args.enabled !== 'boolean') throw new Error('toggle_automation requires a boolean `enabled` argument.');
        const automationId = await findAutomationIdByName(automationName);
        if (!automationId) return buildError(invocation.toolId, invocation.functionName, `Automation "${automationName}" was not found.`);
        const automation = await toggleAutomation(automationId, invocation.args.enabled);
        return { toolId: invocation.toolId, functionName: invocation.functionName, ok: true, summary: `${automation.enabled ? 'Enabled' : 'Disabled'} automation "${automation.name}".`, data: { automation } };
      }
      if (invocation.functionName === 'delete_automation') {
        const automationName = requireString(invocation.args.automationName, 'delete_automation requires a non-empty `automationName` argument.');
        const automationId = await findAutomationIdByName(automationName);
        if (!automationId) return buildError(invocation.toolId, invocation.functionName, `Automation "${automationName}" was not found.`);
        await deleteAutomation(automationId);
        return { toolId: invocation.toolId, functionName: invocation.functionName, ok: true, summary: `Deleted automation "${automationName}".`, data: { automationName } };
      }
      return buildError(invocation.toolId, invocation.functionName, `Unknown automation function "${invocation.functionName}".`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Automation action failed.';
      return buildError(invocation.toolId, invocation.functionName, message);
    }
  },
};
