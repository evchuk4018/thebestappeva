import { ChevronDown, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WorkoutExercise, WorkoutSession } from '../../../shared/workout-contract';
import { ExercisePicker } from './ExercisePicker';
import { WorkoutActionButton } from './WorkoutActionButton';
import { WorkoutSessionExerciseCard } from './WorkoutSessionExerciseCard';
import { completedSetCount, makeSessionExercise, makeWorkoutSet, moveSessionExercise, renumberSession, sessionVolume } from './workout-session-utils';

interface WorkoutSessionViewProps {
  session: WorkoutSession;
  exercises: WorkoutExercise[];
  onChange: (session: WorkoutSession) => void;
  onFinish: (session: WorkoutSession) => void;
  onCancel: (sessionId: string) => void;
  onCreateExercise: (input: { name: string; category: string; equipment: string }) => Promise<WorkoutExercise | null>;
}

export function WorkoutSessionView({ session, exercises, onChange, onFinish, onCancel, onCreateExercise }: WorkoutSessionViewProps) {
  const navigate = useNavigate();
  const deleteTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const latestSessionRef = useRef(session);
  const [draggingExerciseId, setDraggingExerciseId] = useState<string | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [removingExerciseIds, setRemovingExerciseIds] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const stats = useMemo(() => ({ volume: sessionVolume(session), sets: completedSetCount(session) }), [session]);

  useEffect(() => {
    latestSessionRef.current = session;
  }, [session]);

  useEffect(() => () => {
    deleteTimersRef.current.forEach((timer) => clearTimeout(timer));
    deleteTimersRef.current.clear();
  }, []);

  const update = (next: WorkoutSession) => onChange(renumberSession(next));
  const updateExercise = (exerciseId: string, updater: (exercise: WorkoutSession['exercises'][number]) => WorkoutSession['exercises'][number]) => {
    update({ ...session, exercises: session.exercises.map((exercise) => exercise.id === exerciseId ? updater(exercise) : exercise) });
  };

  const addExercise = (exercise: WorkoutExercise) => {
    update({ ...session, exercises: [...session.exercises, makeSessionExercise(session.id, exercise, session.exercises.length)] });
  };

  const requestDelete = (exerciseId: string) => {
    if (removingExerciseIds.includes(exerciseId)) return;
    setRemovingExerciseIds((current) => [...current, exerciseId]);
    const timer = setTimeout(() => {
      setRemovingExerciseIds((current) => current.filter((id) => id !== exerciseId));
      deleteTimersRef.current.delete(exerciseId);
      update({ ...latestSessionRef.current, exercises: latestSessionRef.current.exercises.filter((item) => item.id !== exerciseId) });
    }, 180);
    deleteTimersRef.current.set(exerciseId, timer);
  };

  const changeSetValue = (exerciseId: string, setId: string, field: 'rir' | 'weight' | 'reps', value: number | null) => {
    updateExercise(exerciseId, (item) => ({
      ...item,
      sets: item.sets.map((entry) => entry.id === setId ? { ...entry, [field]: value } : entry),
    }));
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-hidden">
      <header className="border-b border-zinc-800 bg-zinc-950 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="grid h-9 w-9 place-items-center rounded-xl text-zinc-300 transition hover:bg-zinc-800" aria-label="Return home">
            <ChevronDown size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <input value={session.name} onChange={(event) => update({ ...session, name: event.target.value })} className="w-full bg-transparent text-sm font-semibold text-white outline-none" />
            <p className="mt-1 text-xs text-zinc-500">{new Date(session.startedAt).toLocaleString()}</p>
          </div>
          <WorkoutActionButton onClick={() => onFinish(session)} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500">
            Finish
          </WorkoutActionButton>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
          <Metric label="Duration" value="In progress" />
          <Metric label="Volume" value={`${Math.round(stats.volume).toLocaleString()} lb`} />
          <Metric label="Sets" value={String(stats.sets)} />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-5 pb-4">
          {reorderMode ? (
            <div className="flex items-center justify-between rounded-2xl border border-blue-500/30 bg-blue-950/20 px-4 py-3">
              <p className="text-sm text-blue-100">Drag exercises to reorder them.</p>
              <button onClick={() => setReorderMode(false)} className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-500">
                Done
              </button>
            </div>
          ) : null}

          {session.exercises.map((exercise) => (
            <WorkoutSessionExerciseCard
              key={exercise.id}
              draggingId={draggingExerciseId}
              exercise={exercise}
              isRemoving={removingExerciseIds.includes(exercise.id)}
              reorderMode={reorderMode}
              onAddSet={() => updateExercise(exercise.id, (item) => ({ ...item, sets: [...item.sets, makeWorkoutSet(item.id, item.sets.length)] }))}
              onDelete={() => requestDelete(exercise.id)}
              onDragEnd={() => setDraggingExerciseId(null)}
              onDragOver={(targetExerciseId) => draggingExerciseId ? update(moveSessionExercise(session, draggingExerciseId, targetExerciseId)) : undefined}
              onDragStart={setDraggingExerciseId}
              onReorder={() => setReorderMode(true)}
              onSetChange={(setId, field, value) => changeSetValue(exercise.id, setId, field, value)}
              onToggleCompleted={(setId) => updateExercise(exercise.id, (item) => ({ ...item, sets: item.sets.map((entry) => entry.id === setId ? { ...entry, completed: !entry.completed } : entry) }))}
              onUpdateNotes={(value) => updateExercise(exercise.id, (item) => ({ ...item, notes: value }))}
            />
          ))}

          <WorkoutActionButton onClick={() => setShowPicker(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-sm font-bold text-white hover:bg-blue-500">
            <Plus size={18} /> Add Exercise
          </WorkoutActionButton>
          <button onClick={() => onCancel(session.id)} className="w-full rounded-2xl border border-red-500/30 px-4 py-3 text-sm font-bold text-red-200 transition hover:bg-red-950/40">
            Cancel Workout
          </button>
        </div>
      </main>

      {showPicker ? (
        <ExercisePicker
          exercises={exercises}
          onClose={() => setShowPicker(false)}
          onCreate={onCreateExercise}
          onPick={addExercise}
          title="Add exercise"
          description="Pick from the library or add a custom movement with its muscle group and weight type."
        />
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-zinc-500">{label}</p><p className="mt-1 font-semibold text-blue-400">{value}</p></div>;
}
