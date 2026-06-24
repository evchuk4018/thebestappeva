import { useState } from 'react';
import type { WorkoutRoutineInput, WorkoutSession } from '../../../shared/workout-contract';
import { WorkoutActionButton } from './WorkoutActionButton';
import { WorkoutModal } from './WorkoutModal';

interface WorkoutSaveRoutineModalProps {
  session: WorkoutSession;
  onClose: () => void;
  onSave: (input: WorkoutRoutineInput) => void;
}

export function WorkoutSaveRoutineModal({ session, onClose, onSave }: WorkoutSaveRoutineModalProps) {
  const [name, setName] = useState(session.name);
  const [items, setItems] = useState(() => session.exercises.map((exercise) => ({
    exerciseId: exercise.exerciseId,
    exerciseName: exercise.exerciseName,
    targetSets: Math.max(1, exercise.sets.length),
  })));
  const canSave = name.trim().length > 0 && items.length > 0;

  return (
    <WorkoutModal title="Save as New Routine" description="Use this workout structure as the starting point for a reusable routine." onClose={onClose}>
      <div className="space-y-4 px-5 py-5">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Routine name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none" />
        </label>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={`${item.exerciseId}-${index}`} className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{item.exerciseName}</p>
                <p className="text-xs text-zinc-500">Exercise {index + 1}</p>
              </div>
              <input
                type="number"
                min="1"
                value={item.targetSets}
                onChange={(event) => setItems((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, targetSets: Math.max(1, Number(event.target.value) || 1) } : entry))}
                className="w-16 rounded-xl border border-zinc-800 bg-zinc-900 px-2 py-2 text-center text-sm text-white outline-none"
                aria-label={`${item.exerciseName} target sets`}
              />
            </div>
          ))}
        </div>
        <WorkoutActionButton
          disabled={!canSave}
          onClick={() => canSave ? onSave({ name: name.trim(), exercises: items.map((item, index) => ({ exerciseId: item.exerciseId, orderIndex: index, targetSets: item.targetSets })) }) : undefined}
          className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          Save Routine
        </WorkoutActionButton>
      </div>
    </WorkoutModal>
  );
}
