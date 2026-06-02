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

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export type TaskPriority = 'low' | 'medium' | 'high';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
  dueAt: string;
  category: string;
  subtasks: Subtask[];
}
