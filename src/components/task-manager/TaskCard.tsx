import { CheckCircle2, Circle } from 'lucide-react';
import { Task } from '../../types';
import { priorityStyles } from './data';
import { formatDateTime } from './utils';

interface TaskCardProps {
  task: Task;
  onOpen: (taskId: string) => void;
  onToggleComplete: (taskId: string) => void;
}

export function TaskCard({ task, onOpen, onToggleComplete }: TaskCardProps) {
  const completedSubtasks = task.subtasks.filter((subtask) => subtask.completed).length;

  return (
    <div className="w-full rounded-[28px] border border-white/8 bg-white/[0.06] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.18)] transition hover:border-white/15">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${priorityStyles[task.priority]}`}>
          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
        </div>
        <button
          type="button"
          aria-label={task.status === 'done' ? 'Mark task incomplete' : 'Mark task complete'}
          onClick={(event) => {
            event.stopPropagation();
            onToggleComplete(task.id);
          }}
          className="text-zinc-200"
        >
          {task.status === 'done' ? <CheckCircle2 size={22} className="text-white" /> : <Circle size={22} className="text-zinc-500" />}
        </button>
      </div>
      <button type="button" onClick={() => onOpen(task.id)} className="w-full text-left">
        <div className="space-y-2">
          <h3 className="text-[22px] font-semibold leading-[1.15] text-white">{task.title}</h3>
          <p className="line-clamp-2 text-sm leading-6 text-zinc-400">{task.description}</p>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-zinc-500">
          <span>{formatDateTime(task.dueAt)}</span>
          <span>{task.category}</span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {task.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="rounded-full bg-white/6 px-2.5 py-1 text-[11px] font-medium text-zinc-300">
                {tag}
              </span>
            ))}
          </div>
          <span className="text-[11px] font-medium text-zinc-400">
            {completedSubtasks}/{task.subtasks.length || 0} subtasks
          </span>
        </div>
      </button>
    </div>
  );
}
