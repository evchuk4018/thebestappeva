import { isConversationAutomation, isScheduleAutomation, type AutomationRecord, type AutomationWeekday, type ScheduleTrigger } from '../shared/automations-contract';
import { addUtcDays, daysInMonth, getTimeZoneParts, getWeekday, toLocalDateKey, zonedDateTimeToUtc } from './automation-time';

const weeklySet = (weekdays: AutomationWeekday[] | undefined) => new Set(weekdays ?? []);

function parseTimeOfDay(timeOfDay: string) {
  const [hours, minutes] = timeOfDay.split(':').map(Number);
  return { hours, minutes };
}

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function applyJitter(date: Date, jitterMinutes: number | null, seed: string) {
  if (!jitterMinutes) return date;
  return new Date(date.getTime() + (hashSeed(seed) % (jitterMinutes + 1)) * 60000);
}

function withinDateRange(localDateKey: string, trigger: ScheduleTrigger) {
  if (trigger.startDate && localDateKey < trigger.startDate) return false;
  if (trigger.endDate && localDateKey > trigger.endDate) return false;
  return true;
}

function buildWallClockCandidate(automation: AutomationRecord, year: number, month: number, day: number, timeOfDay: string) {
  if (!isScheduleAutomation(automation)) return new Date(0);
  const { hours, minutes } = parseTimeOfDay(timeOfDay);
  const base = zonedDateTimeToUtc(year, month, day, hours, minutes, automation.trigger.timezone);
  return applyJitter(base, automation.trigger.jitterMinutes, `${automation.id}:${toLocalDateKey(year, month, day)}:${timeOfDay}`);
}

function computeWallClockCandidates(automation: AutomationRecord, reference = new Date(), limitDays = 400) {
  if (!isScheduleAutomation(automation) || automation.trigger.cadence === 'interval') return [];
  const trigger = automation.trigger;
  const timeOfDay = trigger.timeOfDay!;
  const localNow = getTimeZoneParts(reference, trigger.timezone);
  const weekdays = weeklySet(trigger.weekdays);
  const matches = [];
  for (let offset = -limitDays; offset <= limitDays; offset += 1) {
    const next = addUtcDays(localNow.year, localNow.month, localNow.day, offset);
    const localDateKey = toLocalDateKey(next.year, next.month, next.day);
    if (!withinDateRange(localDateKey, trigger)) continue;
    const weekday = getWeekday(next.year, next.month, next.day);
    const monthDay = Math.min(trigger.dayOfMonth ?? next.day, daysInMonth(next.year, next.month));
    const cadenceMatches =
      trigger.cadence === 'daily'
      || (trigger.cadence === 'weekly' && weekdays.has(weekday))
      || (trigger.cadence === 'monthly' && monthDay === next.day);
    if (cadenceMatches) matches.push(buildWallClockCandidate(automation, next.year, next.month, next.day, timeOfDay));
  }
  return matches.sort((left, right) => left.getTime() - right.getTime());
}

function computeIntervalOccurrence(automation: AutomationRecord, occurrenceIndex: number) {
  if (!isScheduleAutomation(automation)) return null;
  const trigger = automation.trigger;
  if (trigger.cadence !== 'interval') return null;
  const anchor = new Date(trigger.anchorAt!);
  const stepMs = (trigger.unit === 'hours' ? 3600000 : 86400000) * (trigger.every ?? 1);
  const base = new Date(anchor.getTime() + occurrenceIndex * stepMs);
  return applyJitter(base, trigger.jitterMinutes, `${automation.id}:${occurrenceIndex}`);
}

function computeLatestIntervalRunAt(automation: AutomationRecord, now: Date) {
  if (!isScheduleAutomation(automation)) return null;
  const trigger = automation.trigger;
  if (trigger.cadence !== 'interval') return null;
  const anchor = new Date(trigger.anchorAt!);
  const stepMs = (trigger.unit === 'hours' ? 3600000 : 86400000) * (trigger.every ?? 1);
  let index = Math.floor((now.getTime() - anchor.getTime()) / stepMs);
  while (index >= 0) {
    const candidate = computeIntervalOccurrence(automation, index);
    if (candidate && candidate.getTime() <= now.getTime()) return candidate;
    index -= 1;
  }
  return null;
}

function computeNextIntervalRunAt(automation: AutomationRecord, now: Date) {
  if (!isScheduleAutomation(automation)) return null;
  const trigger = automation.trigger;
  if (trigger.cadence !== 'interval') return null;
  const anchor = new Date(trigger.anchorAt!);
  const stepMs = (trigger.unit === 'hours' ? 3600000 : 86400000) * (trigger.every ?? 1);
  let index = Math.max(0, Math.floor((now.getTime() - anchor.getTime()) / stepMs));
  while (index < 100000) {
    const candidate = computeIntervalOccurrence(automation, index);
    if (candidate && candidate.getTime() > now.getTime()) return candidate;
    index += 1;
  }
  return null;
}

export function computeLatestScheduledRunAt(automation: AutomationRecord, now = new Date()) {
  if (!isScheduleAutomation(automation) || !automation.enabled) return null;
  return automation.trigger.cadence === 'interval'
    ? computeLatestIntervalRunAt(automation, now)
    : [...computeWallClockCandidates(automation, now)].reverse().find((candidate) => candidate.getTime() <= now.getTime()) ?? null;
}

export function computeNextScheduledRunAt(automation: AutomationRecord, now = new Date()) {
  if (!isScheduleAutomation(automation) || !automation.enabled) return null;
  return automation.trigger.cadence === 'interval'
    ? computeNextIntervalRunAt(automation, now)
    : computeWallClockCandidates(automation, now).find((candidate) => candidate.getTime() > now.getTime()) ?? null;
}

export function matchesConversationAutomation(automation: AutomationRecord, content: string) {
  if (!automation.enabled || !isConversationAutomation(automation)) return false;
  const haystack = content.trim().toLowerCase();
  return automation.trigger.phrases.some((phrase) => haystack.includes(phrase.trim().toLowerCase()));
}
