import { BookOpen, MoreHorizontal, Plus, Search } from 'lucide-react';
import type { WorkoutExercise, WorkoutRoutine, WorkoutSession } from '../../../shared/workout-contract';
import { RoutineEditor } from './RoutineEditor';

interface WorkoutLandingProps {
  exercises: WorkoutExercise[];
  routines: WorkoutRoutine[];
  session: WorkoutSession | null;
  editingRoutine: WorkoutRoutine | null | 'new';
  onEditRoutine: (routine: WorkoutRoutine | null | 'new') => void;
  onStartEmpty: () => void;
  onStartRoutine: (routineId: string) => void;
  onOpenSession: () => void;
  onSaveRoutine: (routineId: string | null, input: { name: string; exercises: Array<{ exerciseId: string; orderIndex: number; targetSets: number }> }) => Promise<unknown>;
  onCreateExercise: (input: { name: string; category: string; equipment: string }) => Promise<WorkoutExercise | null>;
}

export function WorkoutLanding(props: WorkoutLandingProps) {
  const activeEditorRoutine = props.editingRoutine === 'new' ? null : props.editingRoutine;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-5 md:grid-cols-[minmax(0,520px)_minmax(320px,1fr)] md:px-6">
      <section className="min-w-0">
        <header className="mb-5 flex items-center justify-center">
          <h1 className="text-sm font-semibold text-zinc-200">Workout</h1>
        </header>

        <div>
          <h2 className="text-base font-bold text-white">Quick Start</h2>
          <button onClick={props.onStartEmpty} className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-zinc-800/80 px-4 py-4 text-left text-sm font-semibold text-white transition hover:bg-zinc-700">
            <Plus size={22} className="text-zinc-300" /> Start Empty Workout
          </button>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Routines</h2>
            <button onClick={() => props.onEditRoutine('new')} className="grid h-8 w-8 place-items-center rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800" aria-label="Create routine">
              <Plus size={17} />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button onClick={() => props.onEditRoutine('new')} className="flex items-center justify-center gap-2 rounded-2xl bg-zinc-800/80 px-3 py-4 text-sm font-semibold text-zinc-100 hover:bg-zinc-700">
              <BookOpen size={18} /> New Routine
            </button>
            <button className="flex items-center justify-center gap-2 rounded-2xl bg-zinc-800/80 px-3 py-4 text-sm font-semibold text-zinc-100 hover:bg-zinc-700">
              <Search size={18} /> Explore
            </button>
          </div>
        </div>

        <p className="mt-6 text-xs font-semibold text-zinc-500">My Routines ({props.routines.length})</p>
        <div className="mt-3 space-y-3 pb-4">
          {props.routines.map((routine) => (
            <article key={routine.id} className="rounded-2xl border border-zinc-800 bg-[#111317] p-4">
              <div className="flex gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-bold text-white">{routine.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">{routine.exerciseSummary}</p>
                </div>
                <button onClick={() => props.onEditRoutine(routine)} className="grid h-8 w-8 place-items-center rounded-xl text-zinc-400 hover:bg-zinc-800" aria-label="Edit routine">
                  <MoreHorizontal size={18} />
                </button>
              </div>
              <button onClick={() => props.onStartRoutine(routine.id)} className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-500">
                Start Routine
              </button>
            </article>
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
        {props.editingRoutine ? (
          <RoutineEditor
            routine={activeEditorRoutine}
            exercises={props.exercises}
            onClose={() => props.onEditRoutine(null)}
            onSave={props.onSaveRoutine}
            onCreateExercise={props.onCreateExercise}
          />
        ) : (
          <div className="rounded-[28px] border border-zinc-800 bg-[#101216] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Exercise Library</p>
            <h2 className="mt-3 text-2xl font-bold text-white">{props.exercises.length} exercises ready</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Presets cover major movement patterns, and custom exercises are saved to SQLite as soon as you add them.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
