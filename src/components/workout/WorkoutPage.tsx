import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { WorkoutRoutineInput } from '../../../shared/workout-contract';
import { WorkoutBottomNav } from './WorkoutBottomNav';
import { WorkoutFinishPromptModal } from './WorkoutFinishPromptModal';
import { WorkoutLanding } from './WorkoutLanding';
import { getWorkoutFinishPrompt, sessionToRoutineInput, type WorkoutFinishPrompt } from './workout-routine-utils';
import { WorkoutSaveRoutineModal } from './WorkoutSaveRoutineModal';
import { WorkoutSessionView } from './WorkoutSessionView';
import { useWorkoutSessionSummary } from './WorkoutSessionSummaryContext';
import { useWorkout } from './useWorkout';

export default function WorkoutPage() {
  const location = useLocation();
  const workout = useWorkout();
  const workoutSummary = useWorkoutSessionSummary();
  const [showSession, setShowSession] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<'new' | null>(null);
  const [finishPrompt, setFinishPrompt] = useState<{ sessionId: string; prompt: WorkoutFinishPrompt } | null>(null);
  const [saveRoutineSessionId, setSaveRoutineSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (workout.busy) return;
    workoutSummary.setSession(workout.session);
  }, [workout.busy, workout.session, workoutSummary]);

  useEffect(() => {
    if (location.state && typeof location.state === 'object' && 'openSession' in location.state && location.state.openSession && workout.session) {
      setShowSession(true);
    }
  }, [location.state, workout.session]);

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

  const finish = async (session = workout.session) => {
    if (!session) return;
    await workout.finishSession(session);
    setShowSession(false);
    setFinishPrompt(null);
    setSaveRoutineSessionId(null);
  };

  const requestFinish = async (session: NonNullable<typeof workout.session>) => {
    const prompt = getWorkoutFinishPrompt(session, workout.routines);
    if (!prompt) {
      await finish(session);
      return;
    }
    setFinishPrompt({ sessionId: session.id, prompt });
  };

  const handleUpdateRoutineFinish = async () => {
    if (!workout.session || !finishPrompt || finishPrompt.prompt.kind !== 'routine-update') return;
    const saved = await workout.saveRoutine(finishPrompt.prompt.routine.id, sessionToRoutineInput(workout.session, finishPrompt.prompt.routine.name));
    if (saved) await finish(workout.session);
  };

  const openQuickRoutineSave = () => {
    if (!workout.session) return;
    setFinishPrompt(null);
    setSaveRoutineSessionId(workout.session.id);
  };

  const handleQuickRoutineSave = async (input: WorkoutRoutineInput) => {
    if (!workout.session || workout.session.id !== saveRoutineSessionId) return;
    const saved = await workout.saveRoutine(null, input);
    if (saved) await finish(workout.session);
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
      onFinish={(session) => void requestFinish(session)}
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
      onDeleteRoutine={workout.deleteRoutine}
      onCreateExercise={workout.createExercise}
    />
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-zinc-950 text-white">
      {workout.error && <div className="border-b border-red-500/40 bg-red-950 px-4 py-2 text-sm text-red-100">{workout.error}</div>}
      <div className="min-h-0 flex-1 overflow-y-auto">{content}</div>
      <WorkoutBottomNav onWorkout={() => workout.session ? setShowSession(true) : setShowSession(false)} />
      {workout.session && finishPrompt?.sessionId === workout.session.id ? (
        <WorkoutFinishPromptModal
          kind={finishPrompt.prompt.kind}
          routineName={finishPrompt.prompt.kind === 'routine-update' ? finishPrompt.prompt.routine.name : undefined}
          onCancel={() => setFinishPrompt(null)}
          onConfirmPrimary={() => finishPrompt.prompt.kind === 'routine-update' ? void handleUpdateRoutineFinish() : openQuickRoutineSave()}
          onConfirmSecondary={() => void finish(workout.session)}
        />
      ) : null}
      {workout.session && saveRoutineSessionId === workout.session.id ? (
        <WorkoutSaveRoutineModal
          session={workout.session}
          onClose={() => setSaveRoutineSessionId(null)}
          onSave={(input) => void handleQuickRoutineSave(input)}
        />
      ) : null}
    </div>
  );
}
