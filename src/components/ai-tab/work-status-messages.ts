export const WORK_STATUS_MESSAGES: readonly string[] = [
  'Ready to work',
  'Working hard',
  'Hardly working',
  'Let\u2019s build something',
  'Standing by',
  'Ready when you are',
  'Thinking cap on',
  'Locked in',
  'Here to help',
] as const;

export function pickWorkStatusMessage(): string {
  const index = Math.floor(Math.random() * WORK_STATUS_MESSAGES.length);
  return WORK_STATUS_MESSAGES[index] ?? WORK_STATUS_MESSAGES[0];
}