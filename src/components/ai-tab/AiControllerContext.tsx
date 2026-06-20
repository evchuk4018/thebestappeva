import { createContext, useContext, type ReactNode } from 'react';
import { useOllamaChat } from './useOllamaChat';

type AiControllerValue = ReturnType<typeof useOllamaChat>;

const AiControllerContext = createContext<AiControllerValue | null>(null);

export function AiControllerProvider({ children }: { children: ReactNode }) {
  const value = useOllamaChat();
  return <AiControllerContext.Provider value={value}>{children}</AiControllerContext.Provider>;
}

export function useAiController() {
  const value = useContext(AiControllerContext);
  if (!value) throw new Error('useAiController must be used within AiControllerProvider.');
  return value;
}
