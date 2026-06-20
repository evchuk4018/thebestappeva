export const AUTOMATION_NAME_MAX_LENGTH = 120;
export const AUTOMATION_DESCRIPTION_MAX_LENGTH = 500;
export const AUTOMATION_PROMPT_MAX_LENGTH = 12000;
export const AUTOMATION_TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const AUTOMATION_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function createAutomationId(prefix = 'automation') {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function normalizeAutomationName(name: string) {
  return name.trim();
}
