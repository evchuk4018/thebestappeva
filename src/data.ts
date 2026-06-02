import { Routine, ActiveWorkoutState } from './types';

export const mockRoutines: Routine[] = [
  {
    id: 'r1',
    name: 'Chest and triceps',
    exercises: ['Bench Press (Barbell)', 'Chest Fly (Machine)', 'Triceps Pushdown', 'Triceps Extension']
  },
  {
    id: 'r2',
    name: 'Back and biceps',
    exercises: ['Bent Over Row (Barbell)', 'Lat Pulldown (Cable)', 'Seated Cable Row', 'Bicep Curl']
  },
  {
    id: 'r3',
    name: 'Legs and abs',
    exercises: ['Squat (Barbell)', 'Leg Press', 'Calf Raise', 'Crunch']
  }
];

export function createWorkoutFromRoutine(routine: Routine): ActiveWorkoutState {
  const isFirstRoutine = routine.id === 'r1';
  return {
    id: `w-${Date.now()}`,
    name: 'Log Workout',
    startTime: Date.now() - (40 * 60 * 1000) - (12 * 1000), // Simulating 40m 12s elapsed
    exercises: routine.exercises.map((exName, idx) => {
      const isFirstEx = idx === 0 && isFirstRoutine;
      return {
        id: `ex-${idx}`,
        name: exName,
        sets: [
          { id: `s1-${idx}`, type: 'W', previous: '-', kg: 20, reps: 12, completed: isFirstEx },
          { id: `s2-${idx}`, type: 'W', previous: '-', kg: 40, reps: 5, completed: isFirstEx },
          { id: `s3-${idx}`, type: 'N', previous: '-', kg: 55, reps: 8, completed: isFirstEx },
          { id: `s4-${idx}`, type: 'N', previous: '-', kg: 55, reps: 8, completed: isFirstEx },
          { id: `s5-${idx}`, type: 'N', previous: '-', kg: 55, reps: 8, completed: false },
        ]
      }
    })
  };
}

export function createEmptyWorkout(): ActiveWorkoutState {
  return {
    id: `w-${Date.now()}`,
    name: 'Log Workout',
    startTime: Date.now(),
    exercises: []
  };
}
