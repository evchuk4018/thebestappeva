import type { CalendarEventInput, CalendarEventOccurrence, CalendarSettings } from '../../../shared/calendar-contract';
import { daysBetween, durationMinutes, eventOnDay, movedEvent, resizedEvent, timeLabel } from './calendar-date';

const hours = Array.from({ length: 24 }, (_, index) => index);

export function CalendarTimeGrid(props: {
  days: Date[];
  events: CalendarEventOccurrence[];
  settings: CalendarSettings;
  onEdit: (event: CalendarEventOccurrence) => void;
  onMove: (eventId: string, input: CalendarEventInput) => void;
  onResize: (eventId: string, input: CalendarEventInput) => void;
}) {
  return (
    <div className="min-w-[720px] flex-1 overflow-auto">
      <div className="grid border-b border-zinc-800" style={{ gridTemplateColumns: `64px repeat(${props.days.length}, minmax(140px, 1fr))` }}>
        <div />
        {props.days.map((day) => <div key={day.toISOString()} className="border-l border-zinc-800 p-3 text-sm font-semibold text-zinc-200">{day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>)}
      </div>
      <div className="grid" style={{ gridTemplateColumns: `64px repeat(${props.days.length}, minmax(140px, 1fr))` }}>
        <div>
          {hours.map((hour) => <div key={hour} className="h-20 border-b border-zinc-900 pr-2 text-right text-[11px] text-zinc-600">{hour}:00</div>)}
        </div>
        {props.days.map((day) => (
          <DayColumn key={day.toISOString()} day={day} events={props.events.filter((event) => eventOnDay(event, day))} settings={props.settings} onEdit={props.onEdit} onMove={props.onMove} onResize={props.onResize} />
        ))}
      </div>
    </div>
  );
}

export function DayView(props: Omit<Parameters<typeof CalendarTimeGrid>[0], 'days'> & { start: Date; end: Date }) {
  return <CalendarTimeGrid {...props} days={daysBetween(props.start, props.end)} />;
}

function DayColumn(props: {
  day: Date;
  events: CalendarEventOccurrence[];
  settings: CalendarSettings;
  onEdit: (event: CalendarEventOccurrence) => void;
  onMove: (eventId: string, input: CalendarEventInput) => void;
  onResize: (eventId: string, input: CalendarEventInput) => void;
}) {
  return (
    <div className="relative border-l border-zinc-800">
      {hours.map((hour) => (
        <div
          key={hour}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(drop) => {
            const payload = props.events.find((item) => item.occurrenceId === drop.dataTransfer.getData('text/calendar-event'));
            if (payload) props.onMove(payload.masterEventId, movedEvent(payload, new Date(props.day.getFullYear(), props.day.getMonth(), props.day.getDate(), hour)));
          }}
          className={`h-20 border-b border-zinc-900 ${hour >= Number(props.settings.workingHoursStart.slice(0, 2)) && hour < Number(props.settings.workingHoursEnd.slice(0, 2)) ? 'bg-zinc-900/30' : ''}`}
        />
      ))}
      {props.events.map((event) => <TimedEvent key={event.occurrenceId} event={event} settings={props.settings} onEdit={props.onEdit} onResize={props.onResize} />)}
    </div>
  );
}

function TimedEvent({ event, settings, onEdit, onResize }: { event: CalendarEventOccurrence; settings: CalendarSettings; onEdit: (event: CalendarEventOccurrence) => void; onResize: (eventId: string, input: CalendarEventInput) => void }) {
  const start = new Date(event.startsAt);
  const top = (start.getHours() * 80) + (start.getMinutes() / 60) * 80;
  const height = Math.max(34, (durationMinutes(event) / 60) * 80);
  return (
    <div
      draggable
      onDragStart={(drag) => drag.dataTransfer.setData('text/calendar-event', event.occurrenceId)}
      style={{ top, height }}
      className={`absolute left-1 right-1 overflow-hidden rounded-md border px-2 py-1 text-xs shadow-lg ${event.conflict ? 'border-amber-300 bg-amber-500/90 text-zinc-950' : 'border-red-300/40 bg-red-500/90 text-white'}`}
    >
      <button onClick={() => onEdit(event)} className="block w-full truncate text-left font-semibold">{event.title}</button>
      <div className="truncate opacity-85">{event.allDay ? 'All day' : `${timeLabel(event.startsAt, settings.hourCycle)} - ${timeLabel(event.endsAt, settings.hourCycle)}`}</div>
      <div className="mt-1 flex gap-1">
        <button title="Shorter" onClick={() => onResize(event.masterEventId, resizedEvent(event, -15))} className="rounded bg-black/20 px-1">-15</button>
        <button title="Longer" onClick={() => onResize(event.masterEventId, resizedEvent(event, 15))} className="rounded bg-black/20 px-1">+15</button>
      </div>
    </div>
  );
}
