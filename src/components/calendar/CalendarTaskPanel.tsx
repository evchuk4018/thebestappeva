import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { CalendarCategory, CalendarPriority, CalendarTask, CalendarTaskInput } from '../../../shared/calendar-contract';

export function CalendarTaskPanel(props: {
  categories: CalendarCategory[];
  tasks: CalendarTask[];
  onSave: (taskId: string | null, input: CalendarTaskInput) => void;
  onDelete: (taskId: string) => void;
}) {
  const [editing, setEditing] = useState<CalendarTask | null>(null);
  const [open, setOpen] = useState(false);
  const activeTasks = props.tasks.filter((task) => !task.trashedAt);
  return (
    <aside className="flex w-full shrink-0 flex-col border-l border-zinc-800 bg-zinc-950 md:w-80">
      <div className="flex items-center justify-between border-b border-zinc-800 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-400">Tasks</h2>
        <button onClick={() => { setEditing(null); setOpen(true); }} className="rounded p-1 text-zinc-300 hover:bg-zinc-800"><Plus size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {activeTasks.map((task) => (
          <div key={task.id} className="mb-2 rounded-md border border-zinc-800 bg-zinc-900 p-3">
            <div className="flex items-start gap-2">
              <input type="checkbox" checked={Boolean(task.completedAt)} onChange={(event) => props.onSave(task.id, taskInput({ ...task, completedAt: event.target.checked ? new Date().toISOString() : null }))} className="mt-1" />
              <button onClick={() => { setEditing(task); setOpen(true); }} className="min-w-0 flex-1 text-left">
                <div className={`truncate text-sm font-medium ${task.completedAt ? 'text-zinc-500 line-through' : 'text-white'}`}>{task.title}</div>
                <div className="mt-1 text-xs text-zinc-500">{task.dueDate ?? task.dueAt?.slice(0, 10) ?? 'No due date'} - {task.priority}</div>
              </button>
              <button onClick={() => props.onDelete(task.id)} className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-red-300"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      {open && <TaskEditor task={editing} categories={props.categories} onClose={() => setOpen(false)} onSave={(taskId, input) => { props.onSave(taskId, input); setOpen(false); }} />}
    </aside>
  );
}

function taskInput(task: CalendarTask): CalendarTaskInput {
  return { categoryId: task.categoryId, title: task.title, notes: task.notes, dueAt: task.dueAt, dueDate: task.dueDate, timezone: task.timezone, priority: task.priority, completedAt: task.completedAt, recurrence: task.recurrence ? { frequency: task.recurrence.frequency, interval: task.recurrence.interval, count: task.recurrence.count, until: task.recurrence.until, byWeekday: task.recurrence.byWeekday } : null };
}

function TaskEditor(props: { task: CalendarTask | null; categories: CalendarCategory[]; onClose: () => void; onSave: (taskId: string | null, input: CalendarTaskInput) => void }) {
  const [title, setTitle] = useState(props.task?.title ?? '');
  const [notes, setNotes] = useState(props.task?.notes ?? '');
  const [categoryId, setCategoryId] = useState(props.task?.categoryId ?? '');
  const [dueDate, setDueDate] = useState(props.task?.dueDate ?? props.task?.dueAt?.slice(0, 10) ?? '');
  const [priority, setPriority] = useState<CalendarPriority>(props.task?.priority ?? 'medium');
  const [repeats, setRepeats] = useState(Boolean(props.task?.recurrence));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <form onSubmit={(event) => {
        event.preventDefault();
        props.onSave(props.task?.id ?? null, { categoryId: categoryId || null, title, notes, dueDate: dueDate || null, dueAt: null, priority, recurrence: repeats ? { frequency: 'WEEKLY', interval: 1, byWeekday: [] } : null });
      }} className="w-full max-w-md rounded-md border border-zinc-800 bg-zinc-950 p-4">
        <h2 className="mb-3 text-lg font-semibold text-white">{props.task ? 'Edit task' : 'New task'}</h2>
        <div className="space-y-3">
          <input value={title} onChange={(change) => setTitle(change.target.value)} placeholder="Task title" className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-white" />
          <select value={categoryId} onChange={(change) => setCategoryId(change.target.value)} className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-white">
            <option value="">No category</option>{props.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <input type="date" value={dueDate} onChange={(change) => setDueDate(change.target.value)} className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-white" />
          <select value={priority} onChange={(change) => setPriority(change.target.value as CalendarPriority)} className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-white">
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={repeats} onChange={(change) => setRepeats(change.target.checked)} /> Repeat weekly</label>
          <textarea value={notes} onChange={(change) => setNotes(change.target.value)} placeholder="Notes" className="min-h-20 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-white" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={props.onClose} className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200">Cancel</button>
          <button type="submit" className="rounded-md bg-red-500 px-3 py-2 text-sm font-semibold text-white">Save</button>
        </div>
      </form>
    </div>
  );
}
