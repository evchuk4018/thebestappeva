import { Plus, Save, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { WorkoutExercise, WorkoutRoutineInput } from '../../../shared/workout-contract';
import { ExercisePicker } from './ExercisePicker';
import { WorkoutActionButton } from './WorkoutActionButton';

interface RoutineEditorProps {
  exercises: WorkoutExercise[];
  onClose: () => void;
  onSave: (routineId: string | null, input: WorkoutRoutineInput) => Promise<unknown>;
  onCreateExercise: (input: { name: string; category: string; equipment: string }) => Promise<WorkoutExercise | null>;
}

export function RoutineEditor({ exercises, onClose, onSave, onCreateExercise }: RoutineEditorProps) {
  const [name, setName] = useState('New Routine');
  const [items, setItems] = useState<Array<{ exerciseId: string; targetSets: number }>>([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const byId = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise])), [exercises]);
  const canSave = name.trim() && items.length > 0;

  const addExercise = (exercise: WorkoutExercise) => {
    setItems((current) => [...current, { exerciseId: exercise.id, targetSets: 3 }]);
  };

  const save = async () => {
    if (!canSave) return;
    await onSave(null, { name: name.trim(), exercises: items.map((item, index) => ({ ...item, orderIndex: index })) });
    onClose();
  };

  return (
    <section className="rounded-[28px] border border-zinc-800 bg-[#101216] p-4 shadow-2xl shadow-black/35">
      <div className="flex items-center justify-between gap-3">
        <input value={name} onChange={(event) => setName(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xl font-bold text-white outline-none" />
        <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-2xl border border-zinc-800 text-zinc-300 hover:bg-zinc-800" aria-label="Close routine editor">
          <X size={18} />
        </button>
      </div>
      <div className="mt-4 space-y-2">
        {items.map((item, index) => {
          const exercise = byId.get(item.exerciseId);
          return (
            <div key={`${item.exerciseId}-${index}`} className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{exercise?.name ?? 'Unknown exercise'}</p>
                <p className="text-xs text-zinc-500">{exercise?.category ?? 'Exercise'}</p>
              </div>
              <input
                type="number"
                min="1"
                value={item.targetSets}
                onChange={(event) => setItems((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, targetSets: Math.max(1, Number(event.target.value) || 1) } : entry))}
                className="w-16 rounded-xl border border-zinc-800 bg-zinc-900 px-2 py-2 text-center text-sm text-white outline-none"
                aria-label="Target sets"
              />
              <button onClick={() => setItems((current) => current.filter((_, entryIndex) => entryIndex !== index))} className="grid h-9 w-9 place-items-center rounded-xl text-zinc-500 hover:bg-zinc-800 hover:text-red-300" aria-label="Remove exercise">
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>
      <button onClick={() => setShowExercisePicker(true)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-blue-500/70 hover:bg-zinc-900">
        <Plus size={18} /> Add exercises
      </button>
      <WorkoutActionButton disabled={!canSave} onClick={() => void save()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">
        <Save size={18} /> Save Routine
      </WorkoutActionButton>
      {showExercisePicker ? (
        <ExercisePicker
          exercises={exercises}
          onClose={() => setShowExercisePicker(false)}
          onCreate={onCreateExercise}
          onPick={addExercise}
          title="Add exercises"
          description="Search the library or build a custom movement before saving this new routine."
        />
      ) : null}
    </section>
  );
}
