import { Check, GripVertical, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import type { WorkoutSessionExercise } from '../../../shared/workout-contract';
import { WorkoutOverflowMenu } from './WorkoutOverflowMenu';

interface WorkoutSessionExerciseCardProps {
  draggingId: string | null;
  exercise: WorkoutSessionExercise;
  isRemoving: boolean;
  menuForceOpen?: boolean;
  reorderMode: boolean;
  onAddSet: () => void;
  onDelete: () => void;
  onReorder: () => void;
  onSetChange: (setId: string, field: 'rir' | 'weight' | 'reps', value: number | null) => void;
  onToggleCompleted: (setId: string) => void;
  onUpdateNotes: (value: string) => void;
  onDragEnd: () => void;
  onDragOver: (exerciseId: string) => void;
  onDragStart: (exerciseId: string) => void;
}

export function WorkoutSessionExerciseCard(props: WorkoutSessionExerciseCardProps) {
  const { draggingId, exercise, isRemoving, menuForceOpen = false, reorderMode } = props;

  return (
    <motion.section
      layout
      animate={isRemoving ? { opacity: 0, height: 0, marginBottom: 0 } : { opacity: 1, height: 'auto', marginBottom: 0 }}
      transition={{ duration: 0.18, ease: 'easeInOut' }}
      draggable={reorderMode}
      onDragEnd={props.onDragEnd}
      onDragOver={(event) => {
        if (!reorderMode || draggingId === exercise.id) return;
        event.preventDefault();
        props.onDragOver(exercise.id);
      }}
      onDragStart={() => reorderMode ? props.onDragStart(exercise.id) : undefined}
      className={`overflow-hidden rounded-[24px] border bg-[#101216] ${reorderMode ? 'cursor-move border-blue-500/40' : 'border-zinc-800'} ${draggingId === exercise.id ? 'opacity-55' : ''}`}
    >
      <div className="flex items-start gap-3 px-4 py-4">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-zinc-800 text-blue-300">
          {reorderMode ? <GripVertical size={18} /> : <span className="text-sm font-bold">{exercise.orderIndex + 1}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold text-blue-400">{exercise.exerciseName}</h2>
          <input
            value={exercise.notes}
            onChange={(event) => props.onUpdateNotes(event.target.value)}
            placeholder="Add notes here..."
            className="mt-2 w-full bg-transparent text-sm text-zinc-300 outline-none placeholder:text-zinc-600"
          />
          {exercise.lastPerformedText ? <p className="mt-2 text-xs text-zinc-500">{exercise.lastPerformedText}</p> : null}
        </div>
        <WorkoutOverflowMenu
          ariaLabel={`Open actions for ${exercise.exerciseName}`}
          forceOpen={menuForceOpen}
          items={[
            { label: 'Delete', tone: 'danger', onClick: props.onDelete },
            { label: 'Reorder', onClick: props.onReorder },
          ]}
        />
      </div>
      <div className="grid grid-cols-[44px_1fr_1fr_1fr_44px] border-y border-zinc-800 px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-zinc-500">
        <span>Set</span><span>RIR</span><span>Weight</span><span>Reps</span><span />
      </div>
      {exercise.sets.map((set, index) => (
        <div key={set.id} className={`grid grid-cols-[44px_1fr_1fr_1fr_44px] items-center gap-2 px-3 py-2 text-center ${set.completed ? 'bg-lime-300 text-zinc-950' : 'text-zinc-100'}`}>
          <span className="text-sm font-bold">{index + 1}</span>
          <SetInput value={set.rir} onChange={(value) => props.onSetChange(set.id, 'rir', value)} />
          <SetInput value={set.weight} onChange={(value) => props.onSetChange(set.id, 'weight', value)} />
          <SetInput value={set.reps} onChange={(value) => props.onSetChange(set.id, 'reps', value)} />
          <button onClick={() => props.onToggleCompleted(set.id)} className="mx-auto grid h-8 w-8 place-items-center rounded-full bg-green-600 text-white">
            <Check size={16} />
          </button>
        </div>
      ))}
      <button onClick={props.onAddSet} className="m-3 flex w-[calc(100%-1.5rem)] items-center justify-center gap-2 rounded-2xl bg-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-700">
        <Plus size={17} /> Add Set
      </button>
    </motion.section>
  );
}

function SetInput({ value, onChange }: { value: number | null; onChange: (value: number | null) => void }) {
  return (
    <input
      type="number"
      min="0"
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
      className="w-full rounded-xl border border-transparent bg-transparent px-2 py-2 text-center text-sm font-bold outline-none focus:border-blue-500 focus:bg-zinc-900/70"
    />
  );
}
