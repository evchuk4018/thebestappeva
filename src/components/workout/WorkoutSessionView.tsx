import { Check, ChevronDown, Dumbbell, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { WorkoutExercise, WorkoutSession } from '../../../shared/workout-contract';
import { ExercisePicker } from './ExercisePicker';
import { completedSetCount, makeSessionExercise, makeWorkoutSet, renumberSession, sessionVolume } from './workout-session-utils';

interface WorkoutSessionViewProps {
  session: WorkoutSession;
  exercises: WorkoutExercise[];
  onChange: (session: WorkoutSession) => void;
  onFinish: (session: WorkoutSession) => void;
  onCancel: (sessionId: string) => void;
  onCreateExercise: (input: { name: string; category: string; equipment: string }) => Promise<WorkoutExercise | null>;
}

export function WorkoutSessionView({ session, exercises, onChange, onFinish, onCancel, onCreateExercise }: WorkoutSessionViewProps) {
  const [showPicker, setShowPicker] = useState(false);
  const stats = useMemo(() => ({ volume: sessionVolume(session), sets: completedSetCount(session) }), [session]);

  const update = (next: WorkoutSession) => onChange(renumberSession(next));
  const updateExercise = (exerciseId: string, updater: (exercise: WorkoutSession['exercises'][number]) => WorkoutSession['exercises'][number]) => {
    update({ ...session, exercises: session.exercises.map((exercise) => exercise.id === exerciseId ? updater(exercise) : exercise) });
  };
  const addExercise = (exercise: WorkoutExercise) => {
    update({ ...session, exercises: [...session.exercises, makeSessionExercise(session.id, exercise, session.exercises.length)] });
    setShowPicker(false);
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-hidden">
      <header className="border-b border-zinc-800 bg-zinc-950 px-4 py-3">
        <div className="flex items-center gap-3">
          <button className="grid h-9 w-9 place-items-center rounded-xl text-zinc-300 hover:bg-zinc-800" aria-label="Collapse workout">
            <ChevronDown size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <input value={session.name} onChange={(event) => update({ ...session, name: event.target.value })} className="w-full bg-transparent text-sm font-semibold text-white outline-none" />
            <p className="mt-1 text-xs text-zinc-500">{new Date(session.startedAt).toLocaleString()}</p>
          </div>
          <button onClick={() => onFinish(session)} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500">
            Finish
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
          <Metric label="Duration" value="In progress" />
          <Metric label="Volume" value={`${Math.round(stats.volume).toLocaleString()} lb`} />
          <Metric label="Sets" value={String(stats.sets)} />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-5">
          {session.exercises.map((exercise) => (
            <section key={exercise.id} className="overflow-hidden rounded-[24px] border border-zinc-800 bg-[#101216]">
              <div className="flex items-start gap-3 px-4 py-4">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-zinc-800 text-blue-300"><Dumbbell size={19} /></div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-bold text-blue-400">{exercise.exerciseName}</h2>
                  <input
                    value={exercise.notes}
                    onChange={(event) => updateExercise(exercise.id, (item) => ({ ...item, notes: event.target.value }))}
                    placeholder="Add notes here..."
                    className="mt-2 w-full bg-transparent text-sm text-zinc-300 outline-none placeholder:text-zinc-600"
                  />
                  {exercise.lastPerformedText && <p className="mt-2 text-xs text-zinc-500">{exercise.lastPerformedText}</p>}
                </div>
                <button onClick={() => update({ ...session, exercises: session.exercises.filter((item) => item.id !== exercise.id) })} className="grid h-9 w-9 place-items-center rounded-xl text-zinc-500 hover:bg-zinc-800 hover:text-red-300" aria-label="Remove exercise">
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="grid grid-cols-[44px_1fr_1fr_1fr_44px] border-y border-zinc-800 px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                <span>Set</span><span>RIR</span><span>Weight</span><span>Reps</span><span />
              </div>
              {exercise.sets.map((set, index) => (
                <div key={set.id} className={`grid grid-cols-[44px_1fr_1fr_1fr_44px] items-center gap-2 px-3 py-2 text-center ${set.completed ? 'bg-lime-300 text-zinc-950' : 'text-zinc-100'}`}>
                  <span className="text-sm font-bold">{index + 1}</span>
                  <SetInput value={set.rir} onChange={(rir) => updateExercise(exercise.id, (item) => ({ ...item, sets: item.sets.map((entry) => entry.id === set.id ? { ...entry, rir } : entry) }))} />
                  <SetInput value={set.weight} onChange={(weight) => updateExercise(exercise.id, (item) => ({ ...item, sets: item.sets.map((entry) => entry.id === set.id ? { ...entry, weight } : entry) }))} />
                  <SetInput value={set.reps} onChange={(reps) => updateExercise(exercise.id, (item) => ({ ...item, sets: item.sets.map((entry) => entry.id === set.id ? { ...entry, reps } : entry) }))} />
                  <button onClick={() => updateExercise(exercise.id, (item) => ({ ...item, sets: item.sets.map((entry) => entry.id === set.id ? { ...entry, completed: !entry.completed } : entry) }))} className="mx-auto grid h-8 w-8 place-items-center rounded-full bg-green-600 text-white">
                    <Check size={16} />
                  </button>
                </div>
              ))}
              <button onClick={() => updateExercise(exercise.id, (item) => ({ ...item, sets: [...item.sets, makeWorkoutSet(item.id, item.sets.length)] }))} className="m-3 flex w-[calc(100%-1.5rem)] items-center justify-center gap-2 rounded-2xl bg-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-100 hover:bg-zinc-700">
                <Plus size={17} /> Add Set
              </button>
            </section>
          ))}
          {showPicker ? <ExercisePicker exercises={exercises} onPick={addExercise} onCreate={onCreateExercise} /> : (
            <button onClick={() => setShowPicker(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-sm font-bold text-white hover:bg-blue-500">
              <Plus size={18} /> Add Exercise
            </button>
          )}
          <button onClick={() => onCancel(session.id)} className="w-full rounded-2xl border border-red-500/30 px-4 py-3 text-sm font-bold text-red-200 hover:bg-red-950/40">
            Cancel Workout
          </button>
        </div>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-zinc-500">{label}</p><p className="mt-1 font-semibold text-blue-400">{value}</p></div>;
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
