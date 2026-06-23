import { useState } from 'react';
import type { WorkoutRoutine } from '../../../shared/workout-contract';
import { WorkoutBottomNav } from './WorkoutBottomNav';
import { WorkoutLanding } from './WorkoutLanding';
import { WorkoutSessionView } from './WorkoutSessionView';
import { useWorkout } from './useWorkout';

export default function WorkoutPage() {
  const workout = useWorkout();
  const [showSession, setShowSession] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<WorkoutRoutine | null | 'new'>(null);

  const openSession = () => {
    if (workout.session) setShowSession(true);
  };

  const startEmpty = async () => {
    const session = await workout.startEmpty();
    if (session) setShowSession(true);
  };

  const startRoutine = async (routineId: string) => {
    const session = await workout.startRoutine(routineId);
    if (session) setShowSession(true);
  };

  const finish = async () => {
    if (!workout.session) return;
    await workout.finishSession(workout.session);
    setShowSession(false);
  };

  const cancel = async (sessionId: string) => {
    await workout.cancelSession(sessionId);
    setShowSession(false);
  };

  const content = workout.busy ? (
    <div className="grid flex-1 place-items-center text-sm text-zinc-500">Loading workouts...</div>
  ) : showSession && workout.session ? (
    <WorkoutSessionView
      session={workout.session}
      exercises={workout.exercises}
      onChange={(session) => void workout.saveSession(session)}
      onFinish={() => void finish()}
      onCancel={(sessionId) => void cancel(sessionId)}
      onCreateExercise={workout.createExercise}
    />
  ) : (
    <WorkoutLanding
      exercises={workout.exercises}
      routines={workout.routines}
      session={workout.session}
      editingRoutine={editingRoutine}
      onEditRoutine={setEditingRoutine}
      onStartEmpty={() => void startEmpty()}
      onStartRoutine={(routineId) => void startRoutine(routineId)}
      onOpenSession={openSession}
      onSaveRoutine={workout.saveRoutine}
      onCreateExercise={workout.createExercise}
    />
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-zinc-950 text-white">
      {workout.error && <div className="border-b border-red-500/40 bg-red-950 px-4 py-2 text-sm text-red-100">{workout.error}</div>}
      <div className="min-h-0 flex-1 overflow-y-auto">{content}</div>
      <WorkoutBottomNav onWorkout={() => workout.session ? setShowSession(true) : setShowSession(false)} />
    </div>
  );
}
