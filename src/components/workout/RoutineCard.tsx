import { BookOpen } from 'lucide-react';
import { WorkoutActionButton } from './WorkoutActionButton';
import { WorkoutOverflowMenu } from './WorkoutOverflowMenu';

interface RoutineCardProps {
  menuForceOpen?: boolean;
  summary: string;
  title: string;
  onDelete: () => void;
  onDuplicate: () => void;
  onStart: () => void;
}

export function RoutineCard({ menuForceOpen = false, summary, title, onDelete, onDuplicate, onStart }: RoutineCardProps) {
  return (
    <article className="rounded-[28px] border border-zinc-800 bg-[#111317] p-4 shadow-xl shadow-black/20">
      <div className="flex gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-zinc-800 text-zinc-100">
          <BookOpen size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-white">{title}</h3>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">{summary}</p>
        </div>
        <WorkoutOverflowMenu
          ariaLabel={`Open actions for ${title}`}
          forceOpen={menuForceOpen}
          items={[
            { label: 'Duplicate routine', onClick: onDuplicate },
            { label: 'Delete routine', tone: 'danger', onClick: onDelete },
          ]}
        />
      </div>
      <WorkoutActionButton onClick={onStart} className="mt-4 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400/70">
        Start Routine
      </WorkoutActionButton>
    </article>
  );
}
