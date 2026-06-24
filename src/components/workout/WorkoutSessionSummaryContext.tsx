import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { WorkoutSession } from '../../../shared/workout-contract';
import { fetchWorkoutBootstrap } from './workout-api';

interface WorkoutSessionSummaryContextValue {
  loading: boolean;
  session: WorkoutSession | null;
  refresh: () => Promise<void>;
  setSession: (session: WorkoutSession | null) => void;
}

const WorkoutSessionSummaryContext = createContext<WorkoutSessionSummaryContextValue | null>(null);

export function WorkoutSessionSummaryProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const bootstrap = await fetchWorkoutBootstrap();
      setSession(bootstrap.activeSession);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo(() => ({ loading, session, refresh, setSession }), [loading, session]);
  return <WorkoutSessionSummaryContext.Provider value={value}>{children}</WorkoutSessionSummaryContext.Provider>;
}

export function useWorkoutSessionSummary() {
  const context = useContext(WorkoutSessionSummaryContext);
  if (!context) throw new Error('WorkoutSessionSummaryProvider is missing.');
  return context;
}
