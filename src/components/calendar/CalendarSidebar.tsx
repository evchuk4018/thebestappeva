import { Check, Plus } from 'lucide-react';
import type { CalendarCategory, CalendarList, CalendarSettings } from '../../../shared/calendar-contract';

const swatches = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#14b8a6'];

export function CalendarSidebar(props: {
  calendars: CalendarList[];
  categories: CalendarCategory[];
  settings: CalendarSettings;
  selectedDate: Date;
  showSettings: boolean;
  onDate: (date: Date) => void;
  onCreateCalendar: (name: string, color: string) => void;
  onCreateCategory: (calendarId: string, name: string, color: string) => void;
  onToggleCalendar: (calendarId: string, visible: boolean) => void;
  onSettings: (settings: CalendarSettings) => void;
}) {
  const primary = props.calendars[0];
  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 border-r border-zinc-800 bg-zinc-950 p-4 md:w-72">
      <input type="date" value={props.selectedDate.toISOString().slice(0, 10)} onChange={(event) => props.onDate(new Date(`${event.target.value}T12:00:00`))} className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white outline-none" />
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Calendars</h2>
          <button title="New calendar" onClick={() => props.onCreateCalendar('New calendar', swatches[0])} className="rounded p-1 text-zinc-400 hover:bg-zinc-800"><Plus size={14} /></button>
        </div>
        <div className="space-y-2">
          {props.calendars.map((calendar) => (
            <button key={calendar.id} onClick={() => props.onToggleCalendar(calendar.id, !calendar.visible)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-900">
              <span className="grid size-4 place-items-center rounded" style={{ backgroundColor: calendar.visible ? calendar.color : '#3f3f46' }}>{calendar.visible && <Check size={12} />}</span>
              <span className="truncate">{calendar.name}</span>
            </button>
          ))}
        </div>
      </section>
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Categories</h2>
          <button title="New category" disabled={!primary} onClick={() => primary && props.onCreateCategory(primary.id, 'New category', swatches[1])} className="rounded p-1 text-zinc-400 hover:bg-zinc-800"><Plus size={14} /></button>
        </div>
        <div className="flex flex-wrap gap-2">
          {props.categories.map((category) => <span key={category.id} className="rounded border border-zinc-800 px-2 py-1 text-xs text-zinc-300"><span className="mr-1.5 inline-block size-2 rounded-full" style={{ backgroundColor: category.color }} />{category.name}</span>)}
        </div>
      </section>
      {props.showSettings && <SettingsEditor settings={props.settings} onSave={props.onSettings} />}
    </aside>
  );
}

function SettingsEditor({ settings, onSave }: { settings: CalendarSettings; onSave: (settings: CalendarSettings) => void }) {
  return (
    <section className="space-y-3 border-t border-zinc-800 pt-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Settings</h2>
      <select value={settings.weekStart} onChange={(event) => onSave({ ...settings, weekStart: event.target.value as CalendarSettings['weekStart'] })} className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-2 text-sm text-white">
        <option value="sun">Week starts Sunday</option>
        <option value="mon">Week starts Monday</option>
      </select>
      <select value={settings.hourCycle} onChange={(event) => onSave({ ...settings, hourCycle: event.target.value as CalendarSettings['hourCycle'] })} className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-2 text-sm text-white">
        <option value="12">12-hour time</option>
        <option value="24">24-hour time</option>
      </select>
      <input value={settings.timezone} onChange={(event) => onSave({ ...settings, timezone: event.target.value })} className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-2 text-sm text-white" />
      <div className="grid grid-cols-2 gap-2">
        <input type="time" value={settings.workingHoursStart} onChange={(event) => onSave({ ...settings, workingHoursStart: event.target.value })} className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-2 text-sm text-white" />
        <input type="time" value={settings.workingHoursEnd} onChange={(event) => onSave({ ...settings, workingHoursEnd: event.target.value })} className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-2 text-sm text-white" />
      </div>
    </section>
  );
}
