import type { ToolDefinition } from './types';

export const workoutToolDefinition: ToolDefinition = {
  id: 'workout',
  label: 'Workout',
  alias: '/workout',
  description: [
    'Reads and writes the local workout module, including exercise data, routines, the active workout session, completed workout history, and direct history logging.',
    'Read the overview before writing when ids are unknown, and never replace an unfinished active workout implicitly.',
  ].join(' '),
  enabledByDefault: true,
  functions: [
    { name: 'get_workout_overview', description: 'Load exercises, routines, and the current active workout session.', parameters: [] },
    { name: 'search_workout_exercises', description: 'Search workout exercises from the local library.', parameters: [
      { name: 'query', type: 'string', description: 'Optional exercise name search.' },
      { name: 'category', type: 'string', description: 'Optional category filter.' },
      { name: 'equipment', type: 'string', description: 'Optional equipment filter.' },
      { name: 'limit', type: 'number', description: 'Optional max results, default 25.' },
    ] },
    { name: 'create_workout_exercise', description: 'Create a custom workout exercise.', parameters: [
      { name: 'name', type: 'string', description: 'Exercise name.', required: true },
      { name: 'category', type: 'string', description: 'Optional category.' },
      { name: 'equipment', type: 'string', description: 'Optional equipment.' },
    ] },
    { name: 'create_workout_routine', description: 'Create a workout routine from a WorkoutRoutineInput object.', parameters: [{ name: 'routine', type: 'object', description: 'WorkoutRoutineInput with name and exercises[].', required: true }] },
    { name: 'update_workout_routine', description: 'Replace an existing workout routine.', parameters: [{ name: 'routineId', type: 'string', description: 'Routine id.', required: true }, { name: 'routine', type: 'object', description: 'WorkoutRoutineInput with name and exercises[].', required: true }] },
    { name: 'delete_workout_routine', description: 'Delete a workout routine by id.', parameters: [{ name: 'routineId', type: 'string', description: 'Routine id.', required: true }] },
    { name: 'start_empty_workout_session', description: 'Start an empty workout session, or return the current active session.', parameters: [] },
    { name: 'start_routine_workout_session', description: 'Start a workout session from a routine id, or return the current active session.', parameters: [{ name: 'routineId', type: 'string', description: 'Routine id.', required: true }] },
    { name: 'update_workout_session', description: 'Save an in-progress or finished workout session object.', parameters: [{ name: 'session', type: 'object', description: 'Full WorkoutSession object.', required: true }] },
    { name: 'finish_workout_session', description: 'Finish a workout session object.', parameters: [{ name: 'session', type: 'object', description: 'Full WorkoutSession object.', required: true }] },
    { name: 'cancel_workout_session', description: 'Delete a workout session by id.', parameters: [{ name: 'sessionId', type: 'string', description: 'Session id.', required: true }] },
    { name: 'list_past_workouts', description: 'List completed workout history summaries.', parameters: [
      { name: 'limit', type: 'number', description: 'Optional max results, default 20.' },
      { name: 'query', type: 'string', description: 'Optional search against workout name or exercise names.' },
      { name: 'exerciseId', type: 'string', description: 'Optional exercise id filter.' },
    ] },
    { name: 'get_workout_session', description: 'Load one workout session by id.', parameters: [{ name: 'sessionId', type: 'string', description: 'Session id.', required: true }] },
    { name: 'log_completed_workout', description: 'Log a completed workout directly into history from a WorkoutLoggedSessionInput object without replacing the active session.', parameters: [{ name: 'session', type: 'object', description: 'WorkoutLoggedSessionInput with startedAt, finishedAt, and exercises[].', required: true }] },
  ],
};
