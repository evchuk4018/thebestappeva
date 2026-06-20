import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { isConversationAutomation, isScheduleAutomation, type AutomationRecord, type AutomationWeekday, type CreateAutomationRequest, type UpdateAutomationRequest } from '../../../../shared/automations-contract';
import type { SkillSummary } from '../../../../shared/skills-contract';
import { selectableTools, toggleToolSelection } from '../tools/selectable-tools';

interface AutomationEditorProps {
  automation: AutomationRecord | null;
  skills: SkillSummary[];
  onCancel: () => void;
  onSubmit: (request: CreateAutomationRequest | UpdateAutomationRequest) => void | Promise<void>;
}

const weekdays: AutomationWeekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function toDateTimeLocal(value: string | undefined) {
  return value ? new Date(value).toISOString().slice(0, 16) : '';
}

export function AutomationEditor({ automation, skills, onCancel, onSubmit }: AutomationEditorProps) {
  const scheduleAutomation = automation && isScheduleAutomation(automation) ? automation : null;
  const conversationAutomation = automation && isConversationAutomation(automation) ? automation : null;
  const [name, setName] = useState(automation?.name ?? '');
  const [description, setDescription] = useState(automation?.description ?? '');
  const [kind, setKind] = useState<AutomationRecord['kind']>(automation?.kind ?? 'schedule');
  const [prompt, setPrompt] = useState(automation?.action.prompt ?? '');
  const [linkedSkillId, setLinkedSkillId] = useState(automation?.action.linkedSkillId ?? '');
  const [requiredTools, setRequiredTools] = useState<string[]>(automation?.action.requiredTools ?? []);
  const [disabledTools, setDisabledTools] = useState<string[]>(automation?.action.disabledTools ?? []);
  const [cadence, setCadence] = useState(scheduleAutomation?.trigger.cadence ?? 'daily');
  const [timezone, setTimezone] = useState(scheduleAutomation?.trigger.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [timeOfDay, setTimeOfDay] = useState('timeOfDay' in (scheduleAutomation?.trigger ?? {}) ? scheduleAutomation?.trigger.timeOfDay ?? '09:00' : '09:00');
  const [weekdaysState, setWeekdaysState] = useState<AutomationWeekday[]>('weekdays' in (scheduleAutomation?.trigger ?? {}) ? scheduleAutomation?.trigger.weekdays ?? ['mon'] : ['mon']);
  const [dayOfMonth, setDayOfMonth] = useState('dayOfMonth' in (scheduleAutomation?.trigger ?? {}) ? scheduleAutomation?.trigger.dayOfMonth ?? 1 : 1);
  const [every, setEvery] = useState('every' in (scheduleAutomation?.trigger ?? {}) ? scheduleAutomation?.trigger.every ?? 1 : 1);
  const [unit, setUnit] = useState<'hours' | 'days'>('unit' in (scheduleAutomation?.trigger ?? {}) ? scheduleAutomation?.trigger.unit ?? 'days' : 'days');
  const [anchorAt, setAnchorAt] = useState(toDateTimeLocal('anchorAt' in (scheduleAutomation?.trigger ?? {}) ? scheduleAutomation?.trigger.anchorAt : undefined));
  const [startDate, setStartDate] = useState(scheduleAutomation?.trigger.startDate ?? '');
  const [endDate, setEndDate] = useState(scheduleAutomation?.trigger.endDate ?? '');
  const [jitterMinutes, setJitterMinutes] = useState(scheduleAutomation?.trigger.jitterMinutes ?? 0);
  const [phrases, setPhrases] = useState(conversationAutomation?.trigger.phrases.join('\n') ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const skillOptions = useMemo(() => [{ id: '', label: 'No linked skill' }, ...skills.map((skill) => ({ id: skill.id, label: skill.name }))], [skills]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !description.trim() || !prompt.trim()) {
      setError('Name, description, and prompt are required.');
      return;
    }
    const trigger = kind === 'schedule'
      ? cadence === 'daily'
        ? { cadence, timezone, startDate: startDate || null, endDate: endDate || null, jitterMinutes, timeOfDay }
        : cadence === 'weekly'
          ? { cadence, timezone, startDate: startDate || null, endDate: endDate || null, jitterMinutes, timeOfDay, weekdays: weekdaysState }
          : cadence === 'monthly'
            ? { cadence, timezone, startDate: startDate || null, endDate: endDate || null, jitterMinutes, timeOfDay, dayOfMonth }
            : { cadence, timezone, startDate: startDate || null, endDate: endDate || null, jitterMinutes, every, unit, anchorAt: new Date(anchorAt).toISOString() }
      : { phrases: phrases.split(/\r?\n|,/).map((entry) => entry.trim()).filter(Boolean) };
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        ...(automation ? {} : { name: name.trim() }),
        ...(automation ? {} : { enabled: true }),
        ...(automation ? { name: name.trim() } : {}),
        description: description.trim(),
        kind,
        trigger,
        action: {
          prompt: prompt.trim(),
          linkedSkillId: linkedSkillId || null,
          linkedSkillName: null,
          requiredTools,
          disabledTools,
        },
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to save automation.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full max-w-5xl flex-col gap-5 py-6 pb-24 text-left">
      <div className="flex items-start justify-between border-b border-[#2a2a27] pb-5">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">{automation ? 'Edit automation' : 'New automation'}</div>
          <h2 className="mt-1 font-serif text-3xl text-[#efeae4]">{automation ? automation.name : 'Create an automation'}</h2>
        </div>
        <button type="button" onClick={onCancel} className="rounded p-1 text-zinc-400 hover:bg-[#20201e] hover:text-zinc-200"><X size={14} /></button>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        <div className="flex flex-col gap-4">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Daily recap" className="rounded-xl border border-[#33332d] bg-[#11110f] px-3 py-2 text-sm text-zinc-100 outline-none" />
          <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Summarize the day each morning." className="rounded-xl border border-[#33332d] bg-[#11110f] px-3 py-2 text-sm text-zinc-100 outline-none" />
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Summarize yesterday's progress and suggest the next step." className="min-h-[180px] rounded-xl border border-[#33332d] bg-[#11110f] px-3 py-2 text-sm text-zinc-100 outline-none" />
          {kind === 'conversation' ? (
            <textarea value={phrases} onChange={(event) => setPhrases(event.target.value)} placeholder="nutrition&#10;meal prep" className="min-h-[140px] rounded-xl border border-[#33332d] bg-[#11110f] px-3 py-2 text-sm text-zinc-100 outline-none" />
          ) : (
            <ScheduleFields
              cadence={cadence}
              timeOfDay={timeOfDay}
              timezone={timezone}
              weekdaysState={weekdaysState}
              dayOfMonth={dayOfMonth}
              every={every}
              unit={unit}
              anchorAt={anchorAt}
              startDate={startDate}
              endDate={endDate}
              jitterMinutes={jitterMinutes}
              onCadenceChange={setCadence}
              onTimeOfDayChange={setTimeOfDay}
              onTimezoneChange={setTimezone}
              onWeekdaysChange={setWeekdaysState}
              onDayOfMonthChange={setDayOfMonth}
              onEveryChange={setEvery}
              onUnitChange={setUnit}
              onAnchorAtChange={setAnchorAt}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onJitterMinutesChange={setJitterMinutes}
            />
          )}
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-[#2a2a27] bg-[#171715] p-4">
          <label className="text-xs text-zinc-400">
            <span className="mb-1 block">Automation kind</span>
            <select value={kind} onChange={(event) => setKind(event.target.value as AutomationRecord['kind'])} className="w-full rounded-xl border border-[#33332d] bg-[#11110f] px-3 py-2 text-sm text-zinc-100 outline-none">
              <option value="schedule">Scheduled automation</option>
              <option value="conversation">Conversation trigger</option>
            </select>
          </label>

          <label className="text-xs text-zinc-400">
            <span className="mb-1 block">Linked skill</span>
            <select value={linkedSkillId} onChange={(event) => setLinkedSkillId(event.target.value)} className="w-full rounded-xl border border-[#33332d] bg-[#11110f] px-3 py-2 text-sm text-zinc-100 outline-none">
              {skillOptions.map((option) => <option key={option.id || 'none'} value={option.id}>{option.label}</option>)}
            </select>
          </label>

          <ToolCheckboxes title="Required tools" selected={requiredTools} onChange={setRequiredTools} />
          <ToolCheckboxes title="Disabled tools" selected={disabledTools} onChange={setDisabledTools} />
          {error && <p className="text-xs text-[#e2875e]">{error}</p>}

          <div className="mt-auto flex justify-end gap-2">
            <button type="button" onClick={onCancel} className="rounded-xl border border-[#33332d] bg-[#1f1f1c] px-3 py-1.5 text-xs font-medium text-zinc-300">Cancel</button>
            <button type="submit" disabled={busy} className="rounded-xl bg-[#e2875e] px-3 py-1.5 text-xs font-medium text-[#121210] disabled:opacity-60">{busy ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

function ScheduleFields(props: {
  cadence: AutomationRecord['kind'] extends never ? never : 'daily' | 'weekly' | 'monthly' | 'interval';
  timeOfDay: string; timezone: string; weekdaysState: AutomationWeekday[]; dayOfMonth: number; every: number; unit: 'hours' | 'days'; anchorAt: string; startDate: string; endDate: string; jitterMinutes: number;
  onCadenceChange: (value: 'daily' | 'weekly' | 'monthly' | 'interval') => void; onTimeOfDayChange: (value: string) => void; onTimezoneChange: (value: string) => void; onWeekdaysChange: (value: AutomationWeekday[]) => void; onDayOfMonthChange: (value: number) => void; onEveryChange: (value: number) => void; onUnitChange: (value: 'hours' | 'days') => void; onAnchorAtChange: (value: string) => void; onStartDateChange: (value: string) => void; onEndDateChange: (value: string) => void; onJitterMinutesChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-[#2a2a27] bg-[#171715] p-4 text-xs text-zinc-400">
      <select value={props.cadence} onChange={(event) => props.onCadenceChange(event.target.value as 'daily' | 'weekly' | 'monthly' | 'interval')} className="rounded-xl border border-[#33332d] bg-[#11110f] px-3 py-2 text-sm text-zinc-100 outline-none">
        <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="interval">Every N hours/days</option>
      </select>
      <input value={props.timezone} onChange={(event) => props.onTimezoneChange(event.target.value)} placeholder="America/New_York" className="rounded-xl border border-[#33332d] bg-[#11110f] px-3 py-2 text-sm text-zinc-100 outline-none" />
      {props.cadence === 'interval' ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min={1} value={props.every} onChange={(event) => props.onEveryChange(Number(event.target.value) || 1)} className="rounded-xl border border-[#33332d] bg-[#11110f] px-3 py-2 text-sm text-zinc-100 outline-none" />
            <select value={props.unit} onChange={(event) => props.onUnitChange(event.target.value as 'hours' | 'days')} className="rounded-xl border border-[#33332d] bg-[#11110f] px-3 py-2 text-sm text-zinc-100 outline-none"><option value="hours">Hours</option><option value="days">Days</option></select>
          </div>
          <input type="datetime-local" value={props.anchorAt} onChange={(event) => props.onAnchorAtChange(event.target.value)} className="rounded-xl border border-[#33332d] bg-[#11110f] px-3 py-2 text-sm text-zinc-100 outline-none" />
        </>
      ) : (
        <>
          <input type="time" value={props.timeOfDay} onChange={(event) => props.onTimeOfDayChange(event.target.value)} className="rounded-xl border border-[#33332d] bg-[#11110f] px-3 py-2 text-sm text-zinc-100 outline-none" />
          {props.cadence === 'weekly' && <div className="flex flex-wrap gap-2">{weekdays.map((weekday) => <label key={weekday} className="flex items-center gap-1 rounded-lg border border-[#2a2a27] px-2 py-1"><input type="checkbox" checked={props.weekdaysState.includes(weekday)} onChange={(event) => props.onWeekdaysChange(toggleToolSelection(props.weekdaysState, weekday, event.target.checked) as AutomationWeekday[])} />{weekday}</label>)}</div>}
          {props.cadence === 'monthly' && <input type="number" min={1} max={31} value={props.dayOfMonth} onChange={(event) => props.onDayOfMonthChange(Number(event.target.value) || 1)} className="rounded-xl border border-[#33332d] bg-[#11110f] px-3 py-2 text-sm text-zinc-100 outline-none" />}
        </>
      )}
      <div className="grid grid-cols-3 gap-2">
        <input type="date" value={props.startDate} onChange={(event) => props.onStartDateChange(event.target.value)} className="rounded-xl border border-[#33332d] bg-[#11110f] px-3 py-2 text-sm text-zinc-100 outline-none" />
        <input type="date" value={props.endDate} onChange={(event) => props.onEndDateChange(event.target.value)} className="rounded-xl border border-[#33332d] bg-[#11110f] px-3 py-2 text-sm text-zinc-100 outline-none" />
        <input type="number" min={0} max={720} value={props.jitterMinutes} onChange={(event) => props.onJitterMinutesChange(Number(event.target.value) || 0)} className="rounded-xl border border-[#33332d] bg-[#11110f] px-3 py-2 text-sm text-zinc-100 outline-none" />
      </div>
    </div>
  );
}

function ToolCheckboxes({ title, selected, onChange }: { title: string; selected: string[]; onChange: (value: string[]) => void }) {
  return (
    <fieldset className="flex flex-col gap-2 text-xs text-zinc-400">
      <legend>{title}</legend>
      <div className="flex flex-wrap gap-2">
        {selectableTools.map((tool) => (
          <label key={tool.id} className="flex items-center gap-1.5 rounded-lg border border-[#2a2a27] px-2 py-1">
            <input type="checkbox" checked={selected.includes(tool.id)} onChange={(event) => onChange(toggleToolSelection(selected, tool.id, event.target.checked))} />
            <span>{tool.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
