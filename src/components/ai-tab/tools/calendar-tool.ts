import {
  createCalendarCategory,
  createCalendarEvent,
  createCalendarList,
  createCalendarTask,
  deleteCalendarEvent,
  deleteCalendarTask,
  duplicateCalendarEvent,
  fetchCalendarBootstrap,
  fetchCalendarEvents,
  restoreCalendarEvent,
  saveCalendarOccurrence,
  trashCalendarEvent,
  updateCalendarCategory,
  updateCalendarEvent,
  updateCalendarList,
  updateCalendarSettings,
  updateCalendarTask,
  undoCalendarAction,
} from '../../calendar/calendar-api';
import { calendarToolDefinition } from './calendar-tool-definition';
import {
  optionalString,
  parseEventInput,
  parseEventOverride,
  parseListEventsArgs,
  parseSettings,
  parseTaskInput,
  requiredString,
} from './calendar-tool-parsers';
import type { ToolRegistryEntry, ToolResult } from './types';

function result(toolId: string, functionName: string, summary: string, data: Record<string, unknown> = {}): ToolResult {
  return { toolId, functionName, ok: true, summary, data };
}

function error(toolId: string, functionName: string, message: string): ToolResult {
  return { toolId, functionName, ok: false, summary: message, error: message };
}

function eventId(args: Record<string, unknown>) {
  return requiredString(args, 'eventId');
}

function taskId(args: Record<string, unknown>) {
  return requiredString(args, 'taskId');
}

function color(args: Record<string, unknown>) {
  return optionalString(args.color) ?? '#ef4444';
}

function calendarListUpdate(args: Record<string, unknown>) {
  const update: { name?: string; color?: string; visible?: boolean } = {};
  const name = optionalString(args.name);
  const nextColor = optionalString(args.color);
  if (name) update.name = name;
  if (nextColor) update.color = nextColor;
  if (typeof args.visible === 'boolean') update.visible = args.visible;
  if (!Object.keys(update).length) throw new Error('update_calendar_list requires at least one field to update.');
  return update;
}

function categoryUpdate(args: Record<string, unknown>) {
  const update: { name?: string; color?: string } = {};
  const name = optionalString(args.name);
  const nextColor = optionalString(args.color);
  if (name) update.name = name;
  if (nextColor) update.color = nextColor;
  if (!Object.keys(update).length) throw new Error('update_calendar_category requires at least one field to update.');
  return update;
}

function summarizeCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

async function executeCalendarFunction(functionName: string, args: Record<string, unknown>, toolId: string) {
  if (functionName === 'get_calendar_overview') {
    const overview = await fetchCalendarBootstrap();
    return result(toolId, functionName, `Loaded calendar overview with ${summarizeCount(overview.calendars.length, 'calendar')} and ${summarizeCount(overview.tasks.length, 'task')}.`, overview as unknown as Record<string, unknown>);
  }

  if (functionName === 'list_calendar_events') {
    const input = parseListEventsArgs(args);
    const events = await fetchCalendarEvents(input.start, input.end, input.query, input.showTrash);
    const filtered = input.recurringOnly ? events.filter((event) => event.isRecurring) : events;
    return result(toolId, functionName, `Loaded ${summarizeCount(filtered.length, 'calendar event')} from ${input.start} to ${input.end}.`, {
      events: filtered,
      recurringOnly: input.recurringOnly,
      range: { start: input.start, end: input.end },
    });
  }

  if (functionName === 'create_calendar_event') {
    const item = await createCalendarEvent(parseEventInput(args));
    return result(toolId, functionName, `Created calendar event "${item.title}".`, { item });
  }

  if (functionName === 'update_calendar_event') {
    const item = await updateCalendarEvent(eventId(args), parseEventInput(args));
    return result(toolId, functionName, `Updated calendar event "${item.title}".`, { item });
  }

  if (functionName === 'save_calendar_occurrence') {
    const action = args.action === 'cancel' ? 'cancel' : args.action === 'override' ? 'override' : null;
    if (!action) throw new Error('save_calendar_occurrence requires `action` to be "override" or "cancel".');
    const item = await saveCalendarOccurrence(eventId(args), requiredString(args, 'occurrenceKey'), action, action === 'cancel' ? null : parseEventOverride(args.override));
    return result(toolId, functionName, `${action === 'cancel' ? 'Cancelled' : 'Overrode'} a recurring occurrence for "${item.title}".`, { item, action });
  }

  if (functionName === 'duplicate_calendar_event') {
    const item = await duplicateCalendarEvent(eventId(args));
    return result(toolId, functionName, `Duplicated calendar event "${item.title}".`, { item });
  }

  if (functionName === 'trash_calendar_event') {
    const item = await trashCalendarEvent(eventId(args));
    return result(toolId, functionName, `Moved calendar event "${item.title}" to trash.`, { item });
  }

  if (functionName === 'restore_calendar_event') {
    const item = await restoreCalendarEvent(eventId(args));
    return result(toolId, functionName, `Restored calendar event "${item.title}".`, { item });
  }

  if (functionName === 'delete_calendar_event') {
    const id = eventId(args);
    await deleteCalendarEvent(id);
    return result(toolId, functionName, `Permanently deleted calendar event "${id}".`, { eventId: id });
  }

  if (functionName === 'create_calendar_task') {
    const item = await createCalendarTask(parseTaskInput(args));
    return result(toolId, functionName, `Created calendar task "${item.title}".`, { item });
  }

  if (functionName === 'update_calendar_task') {
    const item = await updateCalendarTask(taskId(args), parseTaskInput(args));
    return result(toolId, functionName, `Updated calendar task "${item.title}".`, { item });
  }

  if (functionName === 'delete_calendar_task') {
    const id = taskId(args);
    await deleteCalendarTask(id);
    return result(toolId, functionName, `Deleted calendar task "${id}".`, { taskId: id });
  }

  if (functionName === 'create_calendar_list') {
    const item = await createCalendarList({ name: requiredString(args, 'name'), color: color(args) });
    return result(toolId, functionName, `Created calendar "${item.name}".`, { item });
  }

  if (functionName === 'update_calendar_list') {
    const item = await updateCalendarList(requiredString(args, 'calendarId'), calendarListUpdate(args));
    return result(toolId, functionName, `Updated calendar "${item.name}".`, { item });
  }

  if (functionName === 'create_calendar_category') {
    const item = await createCalendarCategory({ calendarId: requiredString(args, 'calendarId'), name: requiredString(args, 'name'), color: color(args) });
    return result(toolId, functionName, `Created calendar category "${item.name}".`, { item });
  }

  if (functionName === 'update_calendar_category') {
    const item = await updateCalendarCategory(requiredString(args, 'categoryId'), categoryUpdate(args));
    return result(toolId, functionName, `Updated calendar category "${item.name}".`, { item });
  }

  if (functionName === 'update_calendar_settings') {
    const settings = await updateCalendarSettings(parseSettings(args));
    return result(toolId, functionName, `Updated calendar settings for ${settings.timezone}.`, { settings });
  }

  if (functionName === 'undo_calendar_action') {
    const restored = await undoCalendarAction();
    return result(toolId, functionName, restored ? 'Undid the latest calendar action.' : 'No calendar action was available to undo.', { restored });
  }

  return error(toolId, functionName, `Unknown calendar function "${functionName}".`);
}

export const calendarTool: ToolRegistryEntry = {
  definition: calendarToolDefinition,
  async execute(invocation) {
    try {
      return await executeCalendarFunction(invocation.functionName, invocation.args, invocation.toolId);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Calendar action failed.';
      return error(invocation.toolId, invocation.functionName, message);
    }
  },
};
