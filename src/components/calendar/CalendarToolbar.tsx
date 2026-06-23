import { ChevronLeft, ChevronRight, Plus, RotateCcw, Search, Settings, Trash2 } from 'lucide-react';
import type { CalendarView } from '../../../shared/calendar-contract';

const views: CalendarView[] = ['day', 'week', 'month', 'year', 'agenda'];

export function CalendarToolbar(props: {
  view: CalendarView;
  title: string;
  query: string;
  showTrash: boolean;
  onView: (view: CalendarView) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onQuery: (query: string) => void;
  onNewEvent: () => void;
  onUndo: () => void;
  onToggleSettings: () => void;
  onToggleTrash: () => void;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-zinc-800 bg-zinc-950/95 px-4 py-3 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={props.onPrevious} className="rounded-md p-2 text-zinc-300 hover:bg-zinc-800" title="Previous"><ChevronLeft size={18} /></button>
          <button onClick={props.onNext} className="rounded-md p-2 text-zinc-300 hover:bg-zinc-800" title="Next"><ChevronRight size={18} /></button>
          <button onClick={props.onToday} className="rounded-md border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800">Today</button>
          <h1 className="ml-2 text-lg font-semibold text-white md:text-2xl">{props.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={props.onNewEvent} className="flex items-center gap-2 rounded-md bg-red-500 px-3 py-2 text-sm font-semibold text-white hover:bg-red-400"><Plus size={16} /> Event</button>
          <button onClick={props.onUndo} className="rounded-md p-2 text-zinc-300 hover:bg-zinc-800" title="Undo"><RotateCcw size={17} /></button>
          <button onClick={props.onToggleTrash} className={`rounded-md p-2 ${props.showTrash ? 'bg-red-500 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`} title="Trash"><Trash2 size={17} /></button>
          <button onClick={props.onToggleSettings} className="rounded-md p-2 text-zinc-300 hover:bg-zinc-800" title="Settings"><Settings size={17} /></button>
        </div>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex rounded-md border border-zinc-800 bg-zinc-900 p-1">
          {views.map((view) => (
            <button key={view} onClick={() => props.onView(view)} className={`rounded px-3 py-1.5 text-xs font-semibold capitalize ${props.view === view ? 'bg-red-500 text-white' : 'text-zinc-400 hover:text-white'}`}>{view}</button>
          ))}
        </div>
        <label className="flex min-w-0 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 md:w-80">
          <Search size={16} className="shrink-0 text-zinc-500" />
          <input value={props.query} onChange={(event) => props.onQuery(event.target.value)} placeholder="Search calendar" className="min-w-0 flex-1 bg-transparent outline-none" />
        </label>
      </div>
    </header>
  );
}
