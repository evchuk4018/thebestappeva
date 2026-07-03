import type BetterSqlite3 from 'better-sqlite3';
import type { WorkoutSession } from '../../shared/workout-contract';

interface WorkoutSessionSetDraft {
  rir?: number | null;
  reps?: number | null;
  weight?: number | null;
  completed?: boolean;
}

export function createWorkoutSessionWriter(database: BetterSqlite3.Database, id: (prefix: string) => string, ownerId: string) {
  const insertExercise = database.prepare('INSERT INTO workout_session_exercises (id, owner_id, session_id, exercise_id, order_index, notes) VALUES (?, ?, ?, ?, ?, ?)');
  const insertSet = database.prepare('INSERT INTO workout_sets (id, owner_id, session_exercise_id, set_index, rir, reps, weight, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

  function insertSessionSet(sessionExerciseId: string, setIndex: number, set: WorkoutSessionSetDraft) {
    insertSet.run(id('set'), ownerId, sessionExerciseId, setIndex, set.rir ?? null, set.reps ?? null, set.weight ?? null, set.completed ? 1 : 0);
  }

  return {
    insertSessionExercise(sessionId: string, exerciseId: string, orderIndex: number, targetSets = 3) {
      const sessionExerciseId = id('sex');
      insertExercise.run(sessionExerciseId, ownerId, sessionId, exerciseId, orderIndex, '');
      for (let index = 0; index < targetSets; index += 1) insertSessionSet(sessionExerciseId, index, {});
    },
    insertSessionSet,
    replaceSessionExercises(session: WorkoutSession) {
      database.prepare('DELETE FROM workout_session_exercises WHERE owner_id = ? AND session_id = ?').run(ownerId, session.id);
      session.exercises.forEach((exercise, index) => {
        insertExercise.run(exercise.id, ownerId, session.id, exercise.exerciseId, exercise.orderIndex ?? index, exercise.notes ?? '');
        exercise.sets.forEach((set, setIndex) => insertSet.run(set.id, ownerId, exercise.id, set.setIndex ?? setIndex, set.rir, set.reps, set.weight, set.completed ? 1 : 0));
      });
    },
  };
}
