export type SetType = 'W' | 'N' | 'D' | 'F';

export interface WorkoutSet {
  id: string;
  type: SetType;
  previous: string;
  kg: number | string;
  reps: number | string;
  completed: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  notes?: string;
  sets: WorkoutSet[];
}

export interface ActiveWorkoutState {
  id: string;
  name: string;
  startTime: number;
  exercises: Exercise[];
}

export interface Routine {
  id: string;
  name: string;
  exercises: string[];
}
