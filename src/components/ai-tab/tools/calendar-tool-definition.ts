import type { ToolDefinition, ToolFunctionParameter } from './types';

const eventParams: ToolFunctionParameter[] = [
  { name: 'calendarId', type: 'string', description: 'Target calendar id from get_calendar_overview.', required: true },
  { name: 'categoryId', type: 'string', description: 'Optional category id from get_calendar_overview.' },
  { name: 'title', type: 'string', description: 'Event title.', required: true },
  { name: 'notes', type: 'string', description: 'Optional notes, such as syllabus source details.' },
  { name: 'location', type: 'string', description: 'Optional location.' },
  { name: 'timezone', type: 'string', description: 'IANA timezone, usually from calendar settings.' },
  { name: 'startsAt', type: 'string', description: 'Event start as an ISO timestamp.', required: true },
  { name: 'endsAt', type: 'string', description: 'Event end as an ISO timestamp after startsAt.', required: true },
  { name: 'allDay', type: 'boolean', description: 'True for all-day/date-only events.' },
  { name: 'startDate', type: 'string', description: 'YYYY-MM-DD for all-day starts.' },
  { name: 'endDate', type: 'string', description: 'YYYY-MM-DD for all-day ends.' },
  { name: 'recurrence', type: 'object', description: 'Optional recurrence: frequency DAILY/WEEKLY/MONTHLY/YEARLY, interval, count, until, byWeekday MO/TU/WE/TH/FR/SA/SU.' },
];

const taskParams: ToolFunctionParameter[] = [
  { name: 'categoryId', type: 'string', description: 'Optional category id from get_calendar_overview.' },
  { name: 'title', type: 'string', description: 'Task title.', required: true },
  { name: 'notes', type: 'string', description: 'Optional task notes.' },
  { name: 'dueAt', type: 'string', description: 'Optional due timestamp as ISO.' },
  { name: 'dueDate', type: 'string', description: 'Optional due date as YYYY-MM-DD.' },
  { name: 'timezone', type: 'string', description: 'IANA timezone, usually from calendar settings.' },
  { name: 'priority', type: 'string', description: 'low, medium, or high.' },
  { name: 'completedAt', type: 'string', description: 'Optional completion timestamp as ISO.' },
  { name: 'recurrence', type: 'object', description: 'Optional recurrence object.' },
];

export const calendarToolDefinition: ToolDefinition = {
  id: 'calendar',
  label: 'Calendar',
  alias: '/calendar',
  description: [
    'Reads and writes the local calendar, including timed events, all-day events, tasks, recurring events, occurrence overrides, calendars, categories, and settings.',
    'Read the overview before writing when ids are unknown. Use ISO timestamps plus the calendar timezone.',
    'For syllabus PDFs, extract deadlines, exams, meetings, office hours, and recurring sessions; use recurrence rules for repeating patterns and all-day events for date-only deadlines.',
  ].join(' '),
  enabledByDefault: true,
  functions: [
    { name: 'get_calendar_overview', description: 'Load calendars, categories, settings, and tasks.', parameters: [] },
    {
      name: 'list_calendar_events',
      description: 'List event occurrences in an ISO start/end range for a day, week, month, or custom span.',
      parameters: [
        { name: 'start', type: 'string', description: 'Inclusive ISO range start.', required: true },
        { name: 'end', type: 'string', description: 'Exclusive ISO range end, after start.', required: true },
        { name: 'query', type: 'string', description: 'Optional search text.' },
        { name: 'showTrash', type: 'boolean', description: 'Include trashed events.' },
        { name: 'recurringOnly', type: 'boolean', description: 'Return only recurring occurrences.' },
      ],
    },
    { name: 'create_calendar_event', description: 'Create a timed, all-day, or recurring calendar event.', parameters: eventParams },
    { name: 'update_calendar_event', description: 'Replace an existing master event by id.', parameters: [{ name: 'eventId', type: 'string', description: 'Master event id.', required: true }, ...eventParams] },
    {
      name: 'save_calendar_occurrence',
      description: 'Override or cancel one occurrence of a recurring event.',
      parameters: [
        { name: 'eventId', type: 'string', description: 'Master event id.', required: true },
        { name: 'occurrenceKey', type: 'string', description: 'Occurrence key from list_calendar_events.', required: true },
        { name: 'action', type: 'string', description: 'override or cancel.', required: true },
        { name: 'override', type: 'object', description: 'Partial event fields for an override; omit for cancel.' },
      ],
    },
    { name: 'duplicate_calendar_event', description: 'Duplicate an event by master event id.', parameters: [{ name: 'eventId', type: 'string', description: 'Master event id.', required: true }] },
    { name: 'trash_calendar_event', description: 'Move an event to trash by master event id.', parameters: [{ name: 'eventId', type: 'string', description: 'Master event id.', required: true }] },
    { name: 'restore_calendar_event', description: 'Restore a trashed event by master event id.', parameters: [{ name: 'eventId', type: 'string', description: 'Master event id.', required: true }] },
    { name: 'delete_calendar_event', description: 'Permanently delete an event by master event id.', parameters: [{ name: 'eventId', type: 'string', description: 'Master event id.', required: true }] },
    { name: 'create_calendar_task', description: 'Create a calendar task.', parameters: taskParams },
    { name: 'update_calendar_task', description: 'Replace an existing calendar task.', parameters: [{ name: 'taskId', type: 'string', description: 'Task id.', required: true }, ...taskParams] },
    { name: 'delete_calendar_task', description: 'Delete a calendar task by id.', parameters: [{ name: 'taskId', type: 'string', description: 'Task id.', required: true }] },
    { name: 'create_calendar_list', description: 'Create a calendar list.', parameters: [{ name: 'name', type: 'string', description: 'Calendar name.', required: true }, { name: 'color', type: 'string', description: 'Hex color; defaults if omitted.' }] },
    { name: 'update_calendar_list', description: 'Update calendar name, color, or visibility.', parameters: [{ name: 'calendarId', type: 'string', description: 'Calendar id.', required: true }, { name: 'name', type: 'string', description: 'Optional new name.' }, { name: 'color', type: 'string', description: 'Optional hex color.' }, { name: 'visible', type: 'boolean', description: 'Optional visibility.' }] },
    { name: 'create_calendar_category', description: 'Create a category within a calendar.', parameters: [{ name: 'calendarId', type: 'string', description: 'Calendar id.', required: true }, { name: 'name', type: 'string', description: 'Category name.', required: true }, { name: 'color', type: 'string', description: 'Hex color; defaults if omitted.' }] },
    { name: 'update_calendar_category', description: 'Update a category name or color.', parameters: [{ name: 'categoryId', type: 'string', description: 'Category id.', required: true }, { name: 'name', type: 'string', description: 'Optional new name.' }, { name: 'color', type: 'string', description: 'Optional hex color.' }] },
    { name: 'update_calendar_settings', description: 'Replace calendar settings.', parameters: [{ name: 'timezone', type: 'string', description: 'IANA timezone.', required: true }, { name: 'weekStart', type: 'string', description: 'sun or mon.', required: true }, { name: 'hourCycle', type: 'string', description: '12 or 24.', required: true }, { name: 'workingHoursStart', type: 'string', description: 'HH:MM.', required: true }, { name: 'workingHoursEnd', type: 'string', description: 'HH:MM.', required: true }] },
    { name: 'undo_calendar_action', description: 'Undo the latest calendar action when possible.', parameters: [] },
  ],
};
