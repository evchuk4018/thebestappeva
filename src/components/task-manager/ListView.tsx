import { ListFilter } from 'lucide-react';
import { Task } from '../../types';
import { TaskCard } from './TaskCard';

interface ListViewProps {
  tasks: Task[];
  onOpenTask: (taskId: string) => void;
  onToggleTaskComplete: (taskId: string) => void;
}

export function ListView({ tasks, onOpenTask, onToggleTaskComplete }: ListViewProps) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <ListFilter size={15} className="text-zinc-400" />
          <span>To do tasks</span>
        </div>
        <span className="text-sm font-medium text-indigo-200">See all</span>
      </div>
      <div className="space-y-4">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onOpen={onOpenTask} onToggleComplete={onToggleTaskComplete} />
        ))}
        {tasks.length === 0 && (
          <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.04] px-5 py-12 text-center text-sm text-zinc-400">
            No tasks match the current filter.
          </div>
        )}
      </div>
    </section>
  );
}
