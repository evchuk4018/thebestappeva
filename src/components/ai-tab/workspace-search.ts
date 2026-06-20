import type { AutomationSummary, ConversationTrigger, ScheduleTrigger } from '../../../shared/automations-contract';
import type { SkillSummary } from '../../../shared/skills-contract';
import type { ToolDefinition } from './tools/types';

export interface SearchableTool extends ToolDefinition {
  enabled: boolean;
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function includesQuery(fields: Array<string | null | undefined>, query: string) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return true;
  return fields.some((field) => normalizeText(field ?? '').includes(normalizedQuery));
}

function statusLabel(enabled: boolean) {
  return enabled ? 'enabled on active' : 'disabled off inactive';
}

function toolFields(tool: SearchableTool) {
  return [
    tool.id,
    tool.label,
    tool.alias,
    tool.description,
    statusLabel(tool.enabled),
    tool.automatic ? 'automatic auto needs pdf' : 'manual toggle',
    ...tool.functions.flatMap((toolFunction) => [
      toolFunction.name,
      toolFunction.description,
      ...toolFunction.parameters.flatMap((parameter) => [
        parameter.name,
        parameter.type,
        parameter.description,
        parameter.required ? 'required' : 'optional',
      ]),
    ]),
  ];
}

function skillFields(skill: SkillSummary) {
  return [
    skill.id,
    skill.name,
    `/${skill.name}`,
    skill.description,
    skill.source,
    statusLabel(skill.enabled),
    skill.readOnly ? 'read only readonly built-in builtin' : 'editable user',
    ...(skill.compatibleModes ?? []),
    ...skill.requiredTools,
    ...skill.disabledTools,
  ];
}

function triggerFields(trigger: ScheduleTrigger | ConversationTrigger) {
  if ('phrases' in trigger) return trigger.phrases;
  return [
    trigger.cadence,
    trigger.timezone,
    trigger.startDate,
    trigger.endDate,
    trigger.timeOfDay,
    trigger.weekdays?.join(' '),
    trigger.dayOfMonth === undefined ? undefined : String(trigger.dayOfMonth),
    trigger.every === undefined ? undefined : String(trigger.every),
    trigger.unit,
    trigger.anchorAt,
    trigger.jitterMinutes === null ? undefined : String(trigger.jitterMinutes),
  ];
}

function automationFields(automation: AutomationSummary) {
  return [
    automation.id,
    automation.name,
    automation.description,
    automation.kind,
    statusLabel(automation.enabled),
    automation.action.prompt,
    automation.action.linkedSkillId,
    automation.action.linkedSkillName,
    automation.lastRunStatus,
    automation.lastRunSummary,
    automation.lastError,
    automation.nextRunAt,
    automation.lastTriggeredAt,
    automation.lastCompletedAt,
    ...automation.action.requiredTools,
    ...automation.action.disabledTools,
    ...triggerFields(automation.trigger),
  ];
}

export function filterToolsForWorkspaceSearch(tools: SearchableTool[], query: string) {
  return tools.filter((tool) => includesQuery(toolFields(tool), query));
}

export function filterSkillsForWorkspaceSearch(skills: SkillSummary[], query: string) {
  return skills.filter((skill) => includesQuery(skillFields(skill), query));
}

export function filterAutomationsForWorkspaceSearch(automations: AutomationSummary[], query: string) {
  return automations.filter((automation) => includesQuery(automationFields(automation), query));
}
