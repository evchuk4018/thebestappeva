import { ArrowLeft, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import { Task, TaskStatus } from '../../types';
import { priorityStyles, statusLabels, statusOrder } from './data';
import { formatDateTime } from './utils';

interface DetailScreenProps {
  task: Task;
  onBack: () => void;
  onDelete: (taskId: string) => void;
  onEdit: (task: Task) => void;
  onMoveTaskStatus: (taskId: string, status: TaskStatus) => void;
  onToggleSubtaskComplete: (taskId: string, subtaskId: string) => void;
  onToggleTaskComplete: (taskId: string) => void;
}

export function DetailScreen({
  task,
  onBack,
  onDelete,
  onEdit,
  onMoveTaskStatus,
  onToggleSubtaskComplete,
  onToggleTaskComplete,
}: DetailScreenProps) {
  return (
    <>
      <header className="flex items-center justify-between px-4 pb-4 pt-5">
        <button type="button" onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/6 text-zinc-100">
          <ArrowLeft size={18} />
        </button>
        <span className="text-sm font-semibold text-zinc-200">Task details</span>
        <button type="button" onClick={() => onDelete(task.id)} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/6 text-zinc-100">
          <Trash2 size={18} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-28">
        <div className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityStyles[task.priority]}`}>
          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
        </div>
        <h1 className="mt-5 text-[2rem] font-semibold leading-[1.08] text-white">{task.title}</h1>
        <p className="mt-4 text-[15px] leading-7 text-zinc-400">{task.description}</p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-[24px] border border-white/8 bg-white/[0.05] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Due</p>
            <p className="mt-3 text-base font-semibold text-white">{formatDateTime(task.dueAt)}</p>
          </div>
          <div className="rounded-[24px] border border-white/8 bg-white/[0.05] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Tags</p>
            <p className="mt-3 text-base font-semibold text-white">{task.tags.join(', ') || 'None'}</p>
          </div>
        </div>

        <div className="mt-3 rounded-[24px] border border-white/8 bg-white/[0.05] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Status</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {statusOrder.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => onMoveTaskStatus(task.id, status)}
                className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                  task.status === status ? 'bg-[#7867ff] text-white' : 'bg-white/[0.06] text-zinc-300'
                }`}
              >
                {statusLabels[status]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Subtasks</h2>
            <span className="text-sm text-zinc-500">{task.subtasks.filter((subtask) => subtask.completed).length}/{task.subtasks.length}</span>
          </div>
          <div className="space-y-3">
            {task.subtasks.map((subtask) => (
              <button
                key={subtask.id}
                type="button"
                onClick={() => onToggleSubtaskComplete(task.id, subtask.id)}
                className="flex w-full items-center justify-between gap-3 rounded-[24px] border border-white/8 bg-white/[0.05] px-4 py-4 text-left"
              >
                <span className={`text-sm font-medium ${subtask.completed ? 'text-zinc-500 line-through' : 'text-white'}`}>{subtask.title}</span>
                {subtask.completed ? <CheckCircle2 size={20} className="text-white" /> : <Circle size={20} className="text-zinc-500" />}
              </button>
            ))}
            {task.subtasks.length === 0 && <p className="text-sm text-zinc-500">No subtasks yet.</p>}
          </div>
        </div>
      </main>

      <div className="absolute inset-x-0 bottom-0 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => onEdit(task)} className="rounded-full bg-white/18 px-5 py-4 text-sm font-semibold text-white">
            Edit task
          </button>
          <button
            type="button"
            onClick={() => onToggleTaskComplete(task.id)}
            className="rounded-full bg-[#7867ff] px-5 py-4 text-sm font-semibold text-white shadow-lg shadow-indigo-950/50"
          >
            {task.status === 'done' ? 'Reopen task' : 'Completed'}
          </button>
        </div>
      </div>
    </>
  );
}
