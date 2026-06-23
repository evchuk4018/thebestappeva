import type { CalendarEventOccurrence, CalendarSettings } from '../../../shared/calendar-contract';
import { addDays, daysBetween, eventOnDay, startOfWeek, timeLabel, toDateInput } from './calendar-date';

export function CalendarMonthView(props: {
  anchorDate: Date;
  events: CalendarEventOccurrence[];
  settings: CalendarSettings;
  onEdit: (event: CalendarEventOccurrence) => void;
  onDate: (date: Date) => void;
}) {
  const monthStart = new Date(props.anchorDate.getFullYear(), props.anchorDate.getMonth(), 1);
  const start = startOfWeek(monthStart, props.settings.weekStart);
  const days = daysBetween(start, addDays(start, 42));
  return (
    <div className="grid min-h-full grid-cols-7 overflow-hidden">
      {days.map((day) => {
        const inMonth = day.getMonth() === props.anchorDate.getMonth();
        const dayEvents = props.events.filter((event) => eventOnDay(event, day));
        return (
          <button key={day.toISOString()} onDoubleClick={() => props.onDate(day)} className={`min-h-32 border-b border-r border-zinc-800 p-2 text-left align-top ${inMonth ? 'bg-zinc-950' : 'bg-zinc-900/40'}`}>
            <div className={`text-xs font-semibold ${toDateInput(day) === toDateInput(new Date()) ? 'text-red-300' : inMonth ? 'text-zinc-300' : 'text-zinc-600'}`}>{day.getDate()}</div>
            <div className="mt-2 space-y-1">
              {dayEvents.slice(0, 4).map((event) => (
                <span key={event.occurrenceId} onClick={(click) => { click.stopPropagation(); props.onEdit(event); }} className={`block truncate rounded px-2 py-1 text-[11px] ${event.conflict ? 'bg-amber-400 text-zinc-950' : 'bg-red-500 text-white'}`}>
                  {!event.allDay && `${timeLabel(event.startsAt, props.settings.hourCycle)} `}{event.title}
                </span>
              ))}
              {dayEvents.length > 4 && <span className="text-[11px] text-zinc-500">+{dayEvents.length - 4} more</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
