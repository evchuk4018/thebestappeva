import type { CalendarEventOccurrence, CalendarSettings, CalendarTask } from '../../../shared/calendar-contract';
import { timeLabel } from './calendar-date';

export function CalendarAgendaView(props: {
  events: CalendarEventOccurrence[];
  tasks: CalendarTask[];
  settings: CalendarSettings;
  onEdit: (event: CalendarEventOccurrence) => void;
}) {
  const grouped = new Map<string, CalendarEventOccurrence[]>();
  props.events.forEach((event) => {
    const key = event.startDate ?? event.startsAt.slice(0, 10);
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  });
  const days = [...grouped.keys()].sort();
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        {days.length === 0 && <div className="rounded-md border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-500">No events in this range.</div>}
        {days.map((day) => (
          <section key={day} className="rounded-md border border-zinc-800 bg-zinc-900/50">
            <h2 className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-200">{new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
            <div className="divide-y divide-zinc-800">
              {grouped.get(day)!.map((event) => (
                <button key={event.occurrenceId} onClick={() => props.onEdit(event)} className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-zinc-800/70">
                  <span className={`w-24 text-xs ${event.conflict ? 'text-amber-300' : 'text-zinc-400'}`}>{event.allDay ? 'All day' : timeLabel(event.startsAt, props.settings.hourCycle)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{event.title}</span>
                  {event.isRecurring && <span className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">Repeats</span>}
                </button>
              ))}
            </div>
          </section>
        ))}
        <section className="rounded-md border border-zinc-800 bg-zinc-900/50">
          <h2 className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-200">Open tasks</h2>
          {props.tasks.filter((task) => !task.completedAt && !task.trashedAt).slice(0, 8).map((task) => <div key={task.id} className="px-4 py-3 text-sm text-zinc-300">{task.title}</div>)}
        </section>
      </div>
    </div>
  );
}
