import {
  createWorkoutExercise,
  createWorkoutRoutine,
  deleteWorkoutRoutine,
  deleteWorkoutSession,
  fetchWorkoutBootstrap,
  fetchWorkoutHistory,
  fetchWorkoutSession,
  finishWorkoutSession,
  logWorkoutSession,
  saveWorkoutSession,
  startEmptyWorkoutSession,
  startWorkoutSessionFromRoutine,
  updateWorkoutRoutine,
} from '../../workout/workout-api';
import { workoutToolDefinition } from './workout-tool-definition';
import { parseExerciseInputArg, parseExerciseSearchArgs, parseHistoryArgs, parseLoggedSessionArg, parseRoutineInputArg, parseSessionArg, requiredString } from './workout-tool-parsers';
import type { ToolRegistryEntry, ToolResult } from './types';

function result(toolId: string, functionName: string, summary: string, data: Record<string, unknown> = {}): ToolResult {
  return { toolId, functionName, ok: true, summary, data };
}

function error(toolId: string, functionName: string, message: string): ToolResult {
  return { toolId, functionName, ok: false, summary: message, error: message };
}

function summarizeCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

async function executeWorkoutFunction(functionName: string, args: Record<string, unknown>, toolId: string) {
  if (functionName === 'get_workout_overview') {
    const overview = await fetchWorkoutBootstrap();
    return result(toolId, functionName, `Loaded workout overview with ${summarizeCount(overview.exercises.length, 'exercise')} and ${summarizeCount(overview.routines.length, 'routine')}.`, overview as unknown as Record<string, unknown>);
  }
  if (functionName === 'search_workout_exercises') {
    const input = parseExerciseSearchArgs(args);
    const overview = await fetchWorkoutBootstrap();
    const exercises = overview.exercises.filter((exercise) => {
      if (input.query && !exercise.name.toLowerCase().includes(input.query)) return false;
      if (input.category && !exercise.category.toLowerCase().includes(input.category)) return false;
      if (input.equipment && !exercise.equipment.toLowerCase().includes(input.equipment)) return false;
      return true;
    }).slice(0, input.limit);
    return result(toolId, functionName, `Found ${summarizeCount(exercises.length, 'exercise')} matching the workout search.`, { exercises });
  }
  if (functionName === 'create_workout_exercise') {
    const item = await createWorkoutExercise(parseExerciseInputArg(args));
    return result(toolId, functionName, `Created workout exercise "${item.name}".`, { item });
  }
  if (functionName === 'create_workout_routine') {
    const item = await createWorkoutRoutine(parseRoutineInputArg(args));
    return result(toolId, functionName, `Created workout routine "${item.name}".`, { item });
  }
  if (functionName === 'update_workout_routine') {
    const item = await updateWorkoutRoutine(requiredString(args, 'routineId'), parseRoutineInputArg(args));
    return result(toolId, functionName, `Updated workout routine "${item.name}".`, { item });
  }
  if (functionName === 'delete_workout_routine') {
    const routineId = requiredString(args, 'routineId');
    await deleteWorkoutRoutine(routineId);
    return result(toolId, functionName, `Deleted workout routine "${routineId}".`, { routineId });
  }
  if (functionName === 'start_empty_workout_session') {
    const item = await startEmptyWorkoutSession();
    return result(toolId, functionName, `Loaded active workout session "${item.name}".`, { item });
  }
  if (functionName === 'start_routine_workout_session') {
    const item = await startWorkoutSessionFromRoutine(requiredString(args, 'routineId'));
    return result(toolId, functionName, `Loaded active workout session "${item.name}".`, { item });
  }
  if (functionName === 'update_workout_session') {
    const item = await saveWorkoutSession(parseSessionArg(args));
    return result(toolId, functionName, `Saved workout session "${item.name}".`, { item });
  }
  if (functionName === 'finish_workout_session') {
    const item = await finishWorkoutSession(parseSessionArg(args));
    return result(toolId, functionName, `Finished workout session "${item.name}".`, { item });
  }
  if (functionName === 'cancel_workout_session') {
    const sessionId = requiredString(args, 'sessionId');
    await deleteWorkoutSession(sessionId);
    return result(toolId, functionName, `Deleted workout session "${sessionId}".`, { sessionId });
  }
  if (functionName === 'list_past_workouts') {
    const input = parseHistoryArgs(args);
    const sessions = await fetchWorkoutHistory(input);
    return result(toolId, functionName, `Loaded ${summarizeCount(sessions.length, 'completed workout')} from history.`, { sessions });
  }
  if (functionName === 'get_workout_session') {
    const item = await fetchWorkoutSession(requiredString(args, 'sessionId'));
    return result(toolId, functionName, `Loaded workout session "${item.name}".`, { item });
  }
  if (functionName === 'log_completed_workout') {
    const item = await logWorkoutSession(parseLoggedSessionArg(args));
    return result(toolId, functionName, `Logged completed workout "${item.name}" without replacing the active session.`, { item });
  }
  return error(toolId, functionName, `Unknown workout function "${functionName}".`);
}

export const workoutTool: ToolRegistryEntry = {
  definition: workoutToolDefinition,
  async execute(invocation) {
    try {
      return await executeWorkoutFunction(invocation.functionName, invocation.args, invocation.toolId);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Workout action failed.';
      return error(invocation.toolId, invocation.functionName, message);
    }
  },
};
