import { Plus, Search } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import type { WorkoutExercise } from '../../../shared/workout-contract';
import { WorkoutActionButton } from './WorkoutActionButton';
import { WorkoutModal } from './WorkoutModal';

interface ExercisePickerProps {
  allowCreate?: boolean;
  exercises: WorkoutExercise[];
  onClose: () => void;
  onCreate: (input: { name: string; category: string; equipment: string }) => Promise<WorkoutExercise | null>;
  onPick?: (exercise: WorkoutExercise) => void;
  title: string;
  description: string;
}

const muscleGroups = ['Chest', 'Back', 'Shoulders', 'Legs', 'Arms', 'Core', 'Glutes', 'Cardio', 'Full Body', 'Custom'];
const weightTypes = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Kettlebell', 'Bands', 'Cardio', 'Other'];

export function ExercisePicker({ allowCreate = true, exercises, onClose, onCreate, onPick, title, description }: ExercisePickerProps) {
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState(muscleGroups[0]);
  const [equipment, setEquipment] = useState(weightTypes[0]);

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return exercises.filter((exercise) => {
      if (!normalized) return true;
      return `${exercise.name} ${exercise.category} ${exercise.equipment}`.toLowerCase().includes(normalized);
    });
  }, [exercises, query]);

  const create = async () => {
    if (!allowCreate || !name.trim()) return;
    const exercise = await onCreate({ name: name.trim(), category, equipment });
    if (!exercise) return;
    setName('');
    setCategory(muscleGroups[0]);
    setEquipment(weightTypes[0]);
    onPick?.(exercise);
    onClose();
  };

  return (
    <WorkoutModal title={title} description={description} onClose={onClose}>
      <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
        <section className="min-h-0 rounded-[28px] border border-zinc-800 bg-zinc-900/50 p-4">
          <label className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-zinc-400">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the exercise library" className="min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-zinc-600" />
          </label>
          <div className="mt-4 max-h-[60dvh] space-y-2 overflow-y-auto pr-1">
            {matches.map((exercise) => {
              const card = (
                <>
                  <p className="text-sm font-semibold text-white">{exercise.name}</p>
                  <p className="mt-1 text-xs text-zinc-500">{exercise.category} • {exercise.equipment}</p>
                </>
              );
              return onPick ? (
                <button key={exercise.id} onClick={() => { onPick(exercise); onClose(); }} className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-left transition hover:border-blue-500/60 hover:bg-zinc-900">
                  {card}
                </button>
              ) : (
                <div key={exercise.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">{card}</div>
              );
            })}
          </div>
        </section>

        {allowCreate ? (
          <section className="rounded-[28px] border border-zinc-800 bg-[#12151a] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">New exercise</p>
            <div className="mt-4 space-y-3">
              <Field label="Name">
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Cable lateral raise" className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500" />
              </Field>
              <Field label="Muscle group">
                <select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-blue-500">
                  {muscleGroups.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Weight type">
                <select value={equipment} onChange={(event) => setEquipment(event.target.value)} className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-blue-500">
                  {weightTypes.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-2xl border border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800">
                Cancel
              </button>
              <WorkoutActionButton onClick={() => void create()} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-500">
                <Plus size={17} /> Add exercise
              </WorkoutActionButton>
            </div>
          </section>
        ) : null}
      </div>
    </WorkoutModal>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-zinc-300">{label}</span>
      {children}
    </label>
  );
}
