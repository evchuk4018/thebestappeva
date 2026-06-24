import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { WorkoutExercise, WorkoutSession, WorkoutSessionExercise } from '../../../shared/workout-contract';
import { ExercisePicker } from './ExercisePicker';
import { RoutineCard } from './RoutineCard';
import { WorkoutResumeBar } from './WorkoutResumeBar';
import { WorkoutSessionExerciseCard } from './WorkoutSessionExerciseCard';

const exercise: WorkoutExercise = {
  id: 'ex-1',
  name: 'Bench Press',
  category: 'Chest',
  equipment: 'Barbell',
  isPreset: true,
  createdAt: '2026-06-23T00:00:00.000Z',
  updatedAt: '2026-06-23T00:00:00.000Z',
};

const sessionExercise: WorkoutSessionExercise = {
  id: 'sex-1',
  sessionId: 'session-1',
  exerciseId: 'ex-1',
  exerciseName: 'Bench Press',
  orderIndex: 0,
  notes: '',
  lastPerformedText: null,
  sets: [{ id: 'set-1', sessionExerciseId: 'sex-1', setIndex: 0, rir: 2, reps: 8, weight: 185, completed: false }],
};

const session: WorkoutSession = {
  id: 'session-1',
  routineId: null,
  name: 'Push Day',
  startedAt: '2026-06-23T00:00:00.000Z',
  finishedAt: null,
  updatedAt: '2026-06-23T00:00:00.000Z',
  exercises: [sessionExercise],
};

test('renders the home resume workout bar with session details', () => {
  const html = renderToStaticMarkup(<MemoryRouter><WorkoutResumeBar session={session} /></MemoryRouter>);
  assert.match(html, /Active workout/);
  assert.match(html, /Push Day/);
  assert.match(html, /Resume/);
});

test('renders the routine actions popup without an edit action', () => {
  const html = renderToStaticMarkup(
    <RoutineCard
      menuForceOpen
      summary="Bench Press, Incline Press"
      title="Chest Day"
      onDelete={() => {}}
      onDuplicate={() => {}}
      onStart={() => {}}
    />,
  );
  assert.match(html, /Duplicate routine/);
  assert.match(html, /Delete routine/);
  assert.doesNotMatch(html, /Edit/);
});

test('renders exercise popup search, custom fields, and cancel action', () => {
  const html = renderToStaticMarkup(
    <ExercisePicker
      exercises={[exercise]}
      onClose={() => {}}
      onCreate={async () => null}
      onPick={() => {}}
      title="Add exercise"
      description="Pick or create a movement."
    />,
  );
  assert.match(html, /Search the exercise library/);
  assert.match(html, /Muscle group/);
  assert.match(html, /Weight type/);
  assert.match(html, /Cancel/);
});

test('renders workout exercise utility menu and reorder styling', () => {
  const html = renderToStaticMarkup(
    <WorkoutSessionExerciseCard
      draggingId={null}
      exercise={sessionExercise}
      isRemoving={false}
      menuForceOpen
      reorderMode
      onAddSet={() => {}}
      onDelete={() => {}}
      onDragEnd={() => {}}
      onDragOver={() => {}}
      onDragStart={() => {}}
      onReorder={() => {}}
      onSetChange={() => {}}
      onToggleCompleted={() => {}}
      onUpdateNotes={() => {}}
    />,
  );
  assert.match(html, /Delete/);
  assert.match(html, /Reorder/);
  assert.match(html, /cursor-move/);
});
