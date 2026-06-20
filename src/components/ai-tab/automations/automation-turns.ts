import { isConversationAutomation, type AutomationRecord } from '../../../../shared/automations-contract';
import type { SkillRecord } from '../../../../shared/skills-contract';

export interface AutomationTurnConfig {
  automationContext: string | null;
  forcedEnabledToolIds: string[];
  forcedDisabledToolIds: string[];
  forceThinking: boolean;
  error: string | null;
}

export const defaultAutomationTurnConfig: AutomationTurnConfig = {
  automationContext: null,
  forcedEnabledToolIds: [],
  forcedDisabledToolIds: [],
  forceThinking: false,
  error: null,
};

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function matchConversationAutomations(automations: AutomationRecord[], content: string) {
  const haystack = content.trim().toLowerCase();
  return automations.filter((automation) => isConversationAutomation(automation) && automation.enabled && automation.trigger.phrases.some((phrase) => haystack.includes(phrase.trim().toLowerCase())));
}

export async function resolveAutomationTurnConfig(
  automations: AutomationRecord[],
  resolveSkillById: (skillId: string) => Promise<SkillRecord | null>,
): Promise<AutomationTurnConfig> {
  const lines: string[] = [];
  const forcedEnabledToolIds: string[] = [];
  const forcedDisabledToolIds: string[] = [];
  for (const automation of automations) {
    lines.push(`Automation "${automation.name}" triggered for this turn.`);
    lines.push(`Additional instructions: ${automation.action.prompt}`);
    forcedEnabledToolIds.push(...automation.action.requiredTools);
    forcedDisabledToolIds.push(...automation.action.disabledTools);
    if (!automation.action.linkedSkillId) {
      continue;
    }
    const skill = await resolveSkillById(automation.action.linkedSkillId);
    if (!skill) {
      return {
        automationContext: null,
        forcedEnabledToolIds: [],
        forcedDisabledToolIds: [],
        forceThinking: true,
        error: `Linked skill "${automation.action.linkedSkillName ?? automation.action.linkedSkillId}" was not found.`,
      };
    }
    forcedEnabledToolIds.push(...skill.requiredTools);
    forcedDisabledToolIds.push(...skill.disabledTools);
    lines.push(`Linked skill "${skill.name}" instructions:`);
    lines.push(skill.instructions);
  }

  return {
    automationContext: lines.length ? lines.join('\n\n') : null,
    forcedEnabledToolIds: unique(forcedEnabledToolIds),
    forcedDisabledToolIds: unique(forcedDisabledToolIds),
    forceThinking: automations.some((automation) => Boolean(automation.action.linkedSkillId) || automation.action.requiredTools.length > 0 || automation.action.disabledTools.length > 0),
    error: null,
  };
}
