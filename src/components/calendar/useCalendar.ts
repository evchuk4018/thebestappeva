import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CalendarCategory, CalendarEventInput, CalendarEventOccurrence, CalendarList, CalendarSettings, CalendarTask, CalendarTaskInput, CalendarView } from '../../../shared/calendar-contract';
import { createCalendarCategory, createCalendarEvent, createCalendarList, createCalendarTask, deleteCalendarEvent, deleteCalendarTask, duplicateCalendarEvent, fetchCalendarBootstrap, fetchCalendarEvents, restoreCalendarEvent, trashCalendarEvent, undoCalendarAction, updateCalendarEvent, updateCalendarList, updateCalendarSettings, updateCalendarTask } from './calendar-api';
import { defaultEventInput, shiftDate, viewRange } from './calendar-date';

const fallbackSettings: CalendarSettings = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  weekStart: 'sun',
  hourCycle: '12',
  workingHoursStart: '09:00',
  workingHoursEnd: '17:00',
};

export function useCalendar() {
  const [calendars, setCalendars] = useState<CalendarList[]>([]);
  const [categories, setCategories] = useState<CalendarCategory[]>([]);
  const [settings, setSettings] = useState<CalendarSettings>(fallbackSettings);
  const [events, setEvents] = useState<CalendarEventOccurrence[]>([]);
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [view, setView] = useState<CalendarView>('month');
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [query, setQuery] = useState('');
  const [showTrash, setShowTrash] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => viewRange(anchorDate, view, settings.weekStart), [anchorDate, view, settings.weekStart]);

  const loadEvents = useCallback(async () => {
    setEvents(await fetchCalendarEvents(range.start.toISOString(), range.end.toISOString(), query, showTrash));
  }, [query, range.end, range.start, showTrash]);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const bootstrap = await fetchCalendarBootstrap();
      setCalendars(bootstrap.calendars);
      setCategories(bootstrap.categories);
      setSettings(bootstrap.settings);
      setTasks(bootstrap.tasks);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load calendar.');
    } finally {
      setBusy(false);
    }
  }, []);

  const run = useCallback(async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      await refresh();
      await loadEvents();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Calendar action failed.');
    }
  }, [loadEvents, refresh]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { if (!busy) void loadEvents(); }, [busy, loadEvents]);

  const primaryCalendar = calendars.find((calendar) => calendar.visible && !calendar.trashedAt) ?? calendars[0];

  return {
    calendars, categories, settings, events, tasks, view, anchorDate, query, showTrash, busy, error, range, primaryCalendar,
    setView, setAnchorDate, setQuery, setShowTrash,
    next: () => setAnchorDate((date) => shiftDate(date, view, 1)),
    previous: () => setAnchorDate((date) => shiftDate(date, view, -1)),
    today: () => setAnchorDate(new Date()),
    quickCreate: (title: string) => primaryCalendar && run(() => createCalendarEvent(defaultEventInput(primaryCalendar.id, anchorDate, title))),
    saveEvent: (eventId: string | null, input: CalendarEventInput) => run(() => eventId ? updateCalendarEvent(eventId, input) : createCalendarEvent(input)),
    duplicateEvent: (eventId: string) => run(() => duplicateCalendarEvent(eventId)),
    trashEvent: (eventId: string) => run(() => trashCalendarEvent(eventId)),
    restoreEvent: (eventId: string) => run(() => restoreCalendarEvent(eventId)),
    deleteEvent: (eventId: string) => run(() => deleteCalendarEvent(eventId)),
    saveTask: (taskId: string | null, input: CalendarTaskInput) => run(() => taskId ? updateCalendarTask(taskId, input) : createCalendarTask(input)),
    deleteTask: (taskId: string) => run(() => deleteCalendarTask(taskId)),
    saveSettings: (next: CalendarSettings) => run(async () => setSettings(await updateCalendarSettings(next))),
    createCalendar: (name: string, color: string) => run(() => createCalendarList({ name, color })),
    updateCalendar: (calendarId: string, input: Partial<Pick<CalendarList, 'name' | 'color' | 'visible'>>) => run(() => updateCalendarList(calendarId, input)),
    createCategory: (calendarId: string, name: string, color: string) => run(() => createCalendarCategory({ calendarId, name, color })),
    undo: () => run(() => undoCalendarAction()),
    reload: () => run(async () => undefined),
  };
}
