import { Task } from '../../types';
import { formatDayLabel } from './utils';
import { priorityStyles } from './data';

interface TimelineViewProps {
  groups: Record<string, Task[]>;
  onOpenTask: (taskId: string) => void;
}

export function TimelineView({ groups, onOpenTask }: TimelineViewProps) {
  return (
    <section className="space-y-5">
      {Object.entries(groups).map(([dateKey, groupedTasks]) => (
        <div key={dateKey}>
          <div className="mb-3 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/8" />
            <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">{formatDayLabel(dateKey)}</span>
            <div className="h-px flex-1 bg-white/8" />
          </div>
          <div className="space-y-3">
            {groupedTasks.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => onOpenTask(task.id)}
                className="flex w-full gap-3 rounded-[28px] border border-white/8 bg-white/[0.05] p-4 text-left"
              >
                <div className="min-w-16 text-center">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Due</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(task.dueAt))}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${priorityStyles[task.priority]}`}>{task.priority}</div>
                  <h3 className="mt-3 text-lg font-semibold text-white">{task.title}</h3>
                  <p className="mt-1 text-sm text-zinc-400">{task.category}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
      {Object.keys(groups).length === 0 && (
        <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] px-5 py-12 text-center text-sm text-zinc-500">
          Nothing to show in the timeline.
        </div>
      )}
    </section>
  );
}
