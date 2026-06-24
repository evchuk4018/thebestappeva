const WORKOUT_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function getWorkoutSessionExpiry(startedAt: string) {
  return new Date(Date.parse(startedAt) + WORKOUT_SESSION_MAX_AGE_MS).toISOString();
}

export function isWorkoutSessionExpired(startedAt: string, finishedAt: string | null | undefined, nowIso: string) {
  if (finishedAt) return false;
  return getWorkoutSessionExpiry(startedAt) <= nowIso;
}
