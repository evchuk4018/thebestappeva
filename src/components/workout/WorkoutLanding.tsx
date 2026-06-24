import { BookOpen, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import type { WorkoutExercise, WorkoutRoutine, WorkoutRoutineInput, WorkoutSession } from '../../../shared/workout-contract';
import { ExercisePicker } from './ExercisePicker';
import { RoutineCard } from './RoutineCard';
import { RoutineEditor } from './RoutineEditor';
import { WorkoutActionButton } from './WorkoutActionButton';
import { duplicateRoutineInput } from './workout-routine-utils';

interface WorkoutLandingProps {
  exercises: WorkoutExercise[];
  routines: WorkoutRoutine[];
  session: WorkoutSession | null;
  editingRoutine: 'new' | null;
  onDeleteRoutine: (routineId: string) => Promise<unknown>;
  onEditRoutine: (routine: 'new' | null) => void;
  onStartEmpty: () => void;
  onStartRoutine: (routineId: string) => void;
  onOpenSession: () => void;
  onSaveRoutine: (routineId: string | null, input: WorkoutRoutineInput) => Promise<unknown>;
  onCreateExercise: (input: { name: string; category: string; equipment: string }) => Promise<WorkoutExercise | null>;
}

export function WorkoutLanding(props: WorkoutLandingProps) {
  const showRoutineEditor = props.editingRoutine === 'new';
  const [showExplore, setShowExplore] = useState(false);

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-5 md:grid-cols-[minmax(0,520px)_minmax(320px,1fr)] md:px-6">
      <section className="min-w-0">
        <header className="mb-5 flex items-center justify-center">
          <h1 className="text-sm font-semibold text-zinc-200">Workout</h1>
        </header>

        <div>
          <h2 className="text-base font-bold text-white">Quick Start</h2>
          <WorkoutActionButton onClick={props.onStartEmpty} className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-zinc-800/80 px-4 py-4 text-left text-sm font-semibold text-white transition hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-400/70">
            <Plus size={22} className="text-zinc-300" /> Start Empty Workout
          </WorkoutActionButton>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Routines</h2>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <WorkoutActionButton onClick={() => props.onEditRoutine('new')} className="flex items-center justify-center gap-2 rounded-2xl bg-zinc-800/80 px-3 py-4 text-sm font-semibold text-zinc-100 hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-400/70">
              <BookOpen size={18} /> New Routine
            </WorkoutActionButton>
            <WorkoutActionButton onClick={() => setShowExplore(true)} className="flex items-center justify-center gap-2 rounded-2xl bg-zinc-800/80 px-3 py-4 text-sm font-semibold text-zinc-100 hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-400/70">
              <Search size={18} /> Explore
            </WorkoutActionButton>
          </div>
        </div>

        <p className="mt-6 text-xs font-semibold text-zinc-500">My Routines ({props.routines.length})</p>
        <div className="mt-3 space-y-3 pb-4">
          {props.routines.map((routine) => (
            <RoutineCard
              key={routine.id}
              summary={routine.exerciseSummary}
              title={routine.name}
              onDelete={() => void props.onDeleteRoutine(routine.id)}
              onDuplicate={() => void props.onSaveRoutine(null, duplicateRoutineInput(routine, props.routines))}
              onStart={() => props.onStartRoutine(routine.id)}
            />
          ))}
        </div>
      </section>

      <aside className="min-w-0 md:pt-11">
        {props.session && (
          <button onClick={props.onOpenSession} className="mb-5 w-full rounded-[24px] border border-blue-500/30 bg-blue-950/30 p-4 text-left shadow-xl shadow-blue-950/20">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-300">Resume</p>
            <h2 className="mt-2 text-xl font-bold text-white">{props.session.name}</h2>
            <p className="mt-2 text-sm text-zinc-400">{props.session.exercises.length} exercises saved in progress</p>
          </button>
        )}
        {showRoutineEditor ? (
          <RoutineEditor
            exercises={props.exercises}
            onClose={() => props.onEditRoutine(null)}
            onSave={props.onSaveRoutine}
            onCreateExercise={props.onCreateExercise}
          />
        ) : (
          <div className="rounded-[28px] border border-zinc-800 bg-[#101216] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Training flow</p>
            <h2 className="mt-3 text-2xl font-bold text-white">Build, duplicate, and run routines fast.</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Explore the full library in a popup, create custom movements with muscle-group and weight-type metadata, and jump back into any active session from home.
            </p>
          </div>
        )}
      </aside>
      {showExplore ? (
        <ExercisePicker
          allowCreate={false}
          exercises={props.exercises}
          onClose={() => setShowExplore(false)}
          onCreate={props.onCreateExercise}
          title="Exercise library"
          description="Search the full library without leaving the workout tab."
        />
      ) : null}
    </div>
  );
}
