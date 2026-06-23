import { useEffect, useMemo, useState } from 'react';
import type { CalendarEventInput, CalendarEventOccurrence } from '../../../shared/calendar-contract';
import { CalendarAgendaView } from './CalendarAgendaView';
import { CalendarEventEditor } from './CalendarEventEditor';
import { CalendarMonthView } from './CalendarMonthView';
import { CalendarSidebar } from './CalendarSidebar';
import { CalendarTaskPanel } from './CalendarTaskPanel';
import { CalendarTimeGrid, DayView } from './CalendarTimeGrid';
import { CalendarToolbar } from './CalendarToolbar';
import { CalendarYearView } from './CalendarYearView';
import { daysBetween } from './calendar-date';
import { useCalendar } from './useCalendar';

function titleFor(date: Date, view: string) {
  if (view === 'year') return String(date.getFullYear());
  if (view === 'day') return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export default function CalendarPage() {
  const calendar = useCalendar();
  const [editing, setEditing] = useState<CalendarEventOccurrence | null>(null);
  const [creating, setCreating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const defaultCalendarId = calendar.primaryCalendar?.id ?? '';
  const visibleEvents = useMemo(() => {
    const visibleIds = new Set(calendar.calendars.filter((item) => item.visible).map((item) => item.id));
    return calendar.events.filter((event) => visibleIds.has(event.calendarId));
  }, [calendar.calendars, calendar.events]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === 'n') setCreating(true);
      if (event.key === 't') calendar.today();
      if (event.key === '/') {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('input[placeholder="Search calendar"]')?.focus();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') void calendar.undo();
      if (event.key === 'ArrowLeft') calendar.previous();
      if (event.key === 'ArrowRight') calendar.next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [calendar]);

  const saveMove = (eventId: string, input: CalendarEventInput) => void calendar.saveEvent(eventId, input);
  const newEvent = () => {
    if (!defaultCalendarId) return;
    setCreating(true);
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-zinc-950 text-white">
      <CalendarToolbar
        view={calendar.view}
        title={titleFor(calendar.anchorDate, calendar.view)}
        query={calendar.query}
        showTrash={calendar.showTrash}
        onView={calendar.setView}
        onPrevious={calendar.previous}
        onNext={calendar.next}
        onToday={calendar.today}
        onQuery={calendar.setQuery}
        onNewEvent={newEvent}
        onUndo={() => void calendar.undo()}
        onToggleSettings={() => setShowSettings((value) => !value)}
        onToggleTrash={() => calendar.setShowTrash(!calendar.showTrash)}
      />
      {calendar.error && <div className="border-b border-red-500/40 bg-red-950 px-4 py-2 text-sm text-red-100">{calendar.error}</div>}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <CalendarSidebar
          calendars={calendar.calendars}
          categories={calendar.categories}
          settings={calendar.settings}
          selectedDate={calendar.anchorDate}
          showSettings={showSettings}
          onDate={calendar.setAnchorDate}
          onCreateCalendar={calendar.createCalendar}
          onCreateCategory={calendar.createCategory}
          onToggleCalendar={(calendarId, visible) => void calendar.updateCalendar(calendarId, { visible })}
          onSettings={calendar.saveSettings}
        />
        <main className="min-h-0 flex-1 overflow-hidden">
          {calendar.busy ? <div className="grid h-full place-items-center text-sm text-zinc-500">Loading calendar...</div> : (
            calendar.view === 'month' ? <CalendarMonthView anchorDate={calendar.anchorDate} events={visibleEvents} settings={calendar.settings} onEdit={setEditing} onDate={(date) => { calendar.setAnchorDate(date); calendar.setView('day'); }} />
              : calendar.view === 'agenda' ? <CalendarAgendaView events={visibleEvents} tasks={calendar.tasks} settings={calendar.settings} onEdit={setEditing} />
                : calendar.view === 'year' ? <CalendarYearView anchorDate={calendar.anchorDate} events={visibleEvents} onMonth={(date) => { calendar.setAnchorDate(date); calendar.setView('month'); }} />
                  : calendar.view === 'day' ? <DayView start={calendar.range.start} end={calendar.range.end} events={visibleEvents} settings={calendar.settings} onEdit={setEditing} onMove={saveMove} onResize={saveMove} />
                    : <CalendarTimeGrid days={daysBetween(calendar.range.start, calendar.range.end)} events={visibleEvents} settings={calendar.settings} onEdit={setEditing} onMove={saveMove} onResize={saveMove} />
          )}
        </main>
        <CalendarTaskPanel categories={calendar.categories} tasks={calendar.tasks} onSave={(taskId, input) => void calendar.saveTask(taskId, input)} onDelete={(taskId) => void calendar.deleteTask(taskId)} />
      </div>
      {(editing || creating) && defaultCalendarId && (
        <CalendarEventEditor
          event={editing}
          calendars={calendar.calendars}
          categories={calendar.categories}
          settings={calendar.settings}
          defaultCalendarId={defaultCalendarId}
          showTrash={calendar.showTrash}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSave={(eventId, input) => void calendar.saveEvent(eventId, input)}
          onDuplicate={(eventId) => void calendar.duplicateEvent(eventId)}
          onTrash={(eventId) => void calendar.trashEvent(eventId)}
          onDelete={(eventId) => void calendar.deleteEvent(eventId)}
        />
      )}
    </div>
  );
}
