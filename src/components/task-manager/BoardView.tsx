import { Task, TaskStatus } from '../../types';
import { priorityStyles, statusLabels, statusOrder, statusStyles } from './data';

interface BoardColumn {
  status: TaskStatus;
  tasks: Task[];
}

interface BoardViewProps {
  columns: BoardColumn[];
  onOpenTask: (taskId: string) => void;
  onMoveTaskStatus: (taskId: string, status: TaskStatus) => void;
}

export function BoardView({ columns, onOpenTask, onMoveTaskStatus }: BoardViewProps) {
  return (
    <section className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((column) => (
        <div key={column.status} className="w-[18.5rem] shrink-0 rounded-[28px] border border-white/10 bg-white/[0.05] p-3">
          <div className="mb-3 flex items-center justify-between">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[column.status]}`}>{statusLabels[column.status]}</span>
            <span className="text-xs text-zinc-500">{column.tasks.length}</span>
          </div>
          <div className="space-y-3">
            {column.tasks.map((task) => {
              const statusIndex = statusOrder.indexOf(task.status);
              const previousStatus = statusOrder[statusIndex - 1];
              const nextStatus = statusOrder[statusIndex + 1];

              return (
                <div key={task.id} className="rounded-[24px] border border-white/8 bg-[#17171d] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                  <button type="button" onClick={() => onOpenTask(task.id)} className="w-full text-left">
                    <div className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${priorityStyles[task.priority]}`}>{task.priority}</div>
                    <h3 className="mt-3 text-lg font-semibold text-white">{task.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-400">{task.description}</p>
                  </button>
                  <div className="mt-4 flex gap-2">
                    {previousStatus && (
                      <button
                        type="button"
                        onClick={() => onMoveTaskStatus(task.id, previousStatus)}
                        className="flex-1 rounded-full bg-white/7 px-3 py-2 text-xs font-medium text-zinc-300"
                      >
                        {statusLabels[previousStatus]}
                      </button>
                    )}
                    {nextStatus && (
                      <button
                        type="button"
                        onClick={() => onMoveTaskStatus(task.id, nextStatus)}
                        className="flex-1 rounded-full bg-[#7867ff] px-3 py-2 text-xs font-semibold text-white"
                      >
                        {statusLabels[nextStatus]}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {column.tasks.length === 0 && (
              <div className="rounded-[24px] border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-500">No tasks here.</div>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
