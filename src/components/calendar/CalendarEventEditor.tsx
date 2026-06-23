import { X } from 'lucide-react';
import { useState } from 'react';
import type { CalendarCategory, CalendarEventInput, CalendarEventOccurrence, CalendarList, CalendarRecurrenceFrequency, CalendarSettings } from '../../../shared/calendar-contract';

function localValue(iso: string) {
  return new Date(iso).toISOString().slice(0, 16);
}

function recurrenceFrequency(event: CalendarEventOccurrence | null) {
  return event?.recurrence?.frequency ?? 'none';
}

export function CalendarEventEditor(props: {
  event: CalendarEventOccurrence | null;
  calendars: CalendarList[];
  categories: CalendarCategory[];
  settings: CalendarSettings;
  defaultCalendarId: string;
  onClose: () => void;
  onSave: (eventId: string | null, input: CalendarEventInput) => void;
  onDuplicate: (eventId: string) => void;
  onTrash: (eventId: string) => void;
  onDelete: (eventId: string) => void;
  showTrash: boolean;
}) {
  const event = props.event;
  const start = event ? localValue(event.startsAt) : localValue(new Date().toISOString());
  const end = event ? localValue(event.endsAt) : localValue(new Date(Date.now() + 3600000).toISOString());
  const [title, setTitle] = useState(event?.title ?? '');
  const [calendarId, setCalendarId] = useState(event?.calendarId ?? props.defaultCalendarId);
  const [categoryId, setCategoryId] = useState(event?.categoryId ?? '');
  const [notes, setNotes] = useState(event?.notes ?? '');
  const [location, setLocation] = useState(event?.location ?? '');
  const [timezone, setTimezone] = useState(event?.timezone ?? props.settings.timezone);
  const [startsAt, setStartsAt] = useState(start);
  const [endsAt, setEndsAt] = useState(end);
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [startDate, setStartDate] = useState(event?.startDate ?? start.slice(0, 10));
  const [endDate, setEndDate] = useState(event?.endDate ?? end.slice(0, 10));
  const [frequency, setFrequency] = useState<CalendarRecurrenceFrequency | 'none'>(recurrenceFrequency(event));
  const [interval, setInterval] = useState(event?.recurrence?.interval ?? 1);
  const [until, setUntil] = useState(event?.recurrence?.until?.slice(0, 10) ?? '');
  const [error, setError] = useState<string | null>(null);

  function submit(form: React.FormEvent) {
    form.preventDefault();
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    const input: CalendarEventInput = {
      calendarId,
      categoryId: categoryId || null,
      title: title.trim(),
      notes,
      location,
      timezone,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      allDay,
      startDate: allDay ? startDate : null,
      endDate: allDay ? endDate : null,
      recurrence: frequency === 'none' ? null : {
        frequency,
        interval,
        until: until ? new Date(`${until}T23:59:00`).toISOString() : null,
        byWeekday: [],
      },
    };
    props.onSave(event?.masterEventId ?? null, input);
    props.onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <form onSubmit={submit} className="w-full max-w-2xl rounded-md border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{event ? 'Edit event' : 'New event'}</h2>
          <button type="button" onClick={props.onClose} className="rounded p-1 text-zinc-400 hover:bg-zinc-800"><X size={16} /></button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <input value={title} onChange={(change) => setTitle(change.target.value)} placeholder="Event title" className="md:col-span-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-white outline-none" />
          <select value={calendarId} onChange={(change) => setCalendarId(change.target.value)} className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-white">
            {props.calendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}
          </select>
          <select value={categoryId} onChange={(change) => setCategoryId(change.target.value)} className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-white">
            <option value="">No category</option>
            {props.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <label className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300"><input type="checkbox" checked={allDay} onChange={(change) => setAllDay(change.target.checked)} /> All day</label>
          <input value={timezone} onChange={(change) => setTimezone(change.target.value)} className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-white" />
          {allDay ? (
            <>
              <input type="date" value={startDate} onChange={(change) => setStartDate(change.target.value)} className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-white" />
              <input type="date" value={endDate} onChange={(change) => setEndDate(change.target.value)} className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-white" />
            </>
          ) : (
            <>
              <input type="datetime-local" value={startsAt} onChange={(change) => setStartsAt(change.target.value)} className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-white" />
              <input type="datetime-local" value={endsAt} onChange={(change) => setEndsAt(change.target.value)} className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-white" />
            </>
          )}
          <input value={location} onChange={(change) => setLocation(change.target.value)} placeholder="Location" className="md:col-span-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-white outline-none" />
          <textarea value={notes} onChange={(change) => setNotes(change.target.value)} placeholder="Notes" className="md:col-span-2 min-h-20 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-white outline-none" />
          <select value={frequency} onChange={(change) => setFrequency(change.target.value as CalendarRecurrenceFrequency | 'none')} className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-white">
            <option value="none">Does not repeat</option><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="YEARLY">Yearly</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min={1} value={interval} onChange={(change) => setInterval(Number(change.target.value) || 1)} className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-white" />
            <input type="date" value={until} onChange={(change) => setUntil(change.target.value)} className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-white" />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        <div className="mt-4 flex flex-wrap justify-between gap-2">
          <div className="flex gap-2">
            {event && <button type="button" onClick={() => props.onDuplicate(event.masterEventId)} className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200">Duplicate</button>}
            {event && (props.showTrash ? <button type="button" onClick={() => props.onDelete(event.masterEventId)} className="rounded-md border border-red-500 px-3 py-2 text-sm text-red-200">Delete forever</button> : <button type="button" onClick={() => props.onTrash(event.masterEventId)} className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200">Trash</button>)}
          </div>
          <button type="submit" className="rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white">Save event</button>
        </div>
      </form>
    </div>
  );
}
