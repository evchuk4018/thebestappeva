import type { CalendarEventOccurrence } from '../../../shared/calendar-contract';

const monthNames = Array.from({ length: 12 }, (_, month) => new Date(2026, month, 1).toLocaleDateString(undefined, { month: 'long' }));

export function CalendarYearView(props: {
  anchorDate: Date;
  events: CalendarEventOccurrence[];
  onMonth: (date: Date) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        {monthNames.map((name, month) => {
          const count = props.events.filter((event) => new Date(event.startsAt).getMonth() === month).length;
          return (
            <button key={name} onClick={() => props.onMonth(new Date(props.anchorDate.getFullYear(), month, 1))} className="rounded-md border border-zinc-800 bg-zinc-900/60 p-4 text-left hover:border-red-500/60">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">{name}</h2>
                <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">{count}</span>
              </div>
              <div className="mt-4 grid grid-cols-7 gap-1">
                {Array.from({ length: new Date(props.anchorDate.getFullYear(), month + 1, 0).getDate() }, (_, index) => (
                  <span key={index} className={`h-2 rounded ${props.events.some((event) => new Date(event.startsAt).getMonth() === month && new Date(event.startsAt).getDate() === index + 1) ? 'bg-red-400' : 'bg-zinc-800'}`} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
