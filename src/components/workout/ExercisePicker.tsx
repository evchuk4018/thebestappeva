import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { WorkoutExercise } from '../../../shared/workout-contract';

interface ExercisePickerProps {
  exercises: WorkoutExercise[];
  onPick: (exercise: WorkoutExercise) => void;
  onCreate: (input: { name: string; category: string; equipment: string }) => Promise<WorkoutExercise | null>;
}

export function ExercisePicker({ exercises, onPick, onCreate }: ExercisePickerProps) {
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return exercises.filter((exercise) => !normalized || `${exercise.name} ${exercise.category} ${exercise.equipment}`.toLowerCase().includes(normalized)).slice(0, 30);
  }, [exercises, query]);

  const create = async () => {
    if (!name.trim()) return;
    const exercise = await onCreate({ name: name.trim(), category: 'Custom', equipment: 'Other' });
    if (exercise) {
      setName('');
      onPick(exercise);
    }
  };

  return (
    <div className="rounded-[24px] border border-zinc-800 bg-zinc-900 p-4">
      <label className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-400">
        <Search size={17} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search exercises" className="min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-zinc-600" />
      </label>
      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
        {matches.map((exercise) => (
          <button key={exercise.id} onClick={() => onPick(exercise)} className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-left transition hover:border-blue-500/60">
            <p className="text-sm font-semibold text-white">{exercise.name}</p>
            <p className="mt-1 text-xs text-zinc-500">{exercise.category} - {exercise.equipment}</p>
          </button>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="New exercise" className="min-w-0 flex-1 rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600" />
        <button onClick={() => void create()} className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-600 text-white transition hover:bg-blue-500" aria-label="Add exercise">
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}
