/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReactNode } from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { RequireOwner } from './auth/RequireOwner';
import { useAuth } from './auth/AuthProvider';
import HomePage from './components/HomePage';
import AiTab from './components/AiTab';
import RetiredRoutePage from './components/RetiredRoutePage';
import CalendarPage from './components/calendar/CalendarPage';
import DocsHomePage from './components/docs/DocsHomePage';
import DocsEditorPage from './components/docs/DocsEditorPage';
import DocsNewRedirect from './components/docs/DocsNewRedirect';
import NutritionPage from './components/nutrition/NutritionPage';
import WorkoutPage from './components/workout/WorkoutPage';
import { WorkoutSessionSummaryProvider } from './components/workout/WorkoutSessionSummaryContext';
import { AiAutomationRuntime } from './components/ai-tab/AiAutomationRuntime';
import { AiControllerProvider } from './components/ai-tab/AiControllerContext';

function AnimatedPage({ children, className = 'h-full min-h-0 w-full' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function AppContent() {
  const auth = useAuth();
  const location = useLocation();
  const usesFullBleedLayout = location.pathname.startsWith('/docs') || location.pathname === '/ai' || location.pathname === '/calendar' || location.pathname === '/workout' || location.pathname === '/nutrition';

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-zinc-950 font-sans text-zinc-50 selection:bg-blue-500/30">
      <main className={`relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden ${usesFullBleedLayout ? '' : 'mx-auto max-w-5xl md:border-x md:border-zinc-900'}`}>
        <button
          className="absolute right-4 top-4 z-20 rounded-full border border-zinc-800 bg-zinc-950/90 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-red-400 hover:text-white"
          onClick={() => void auth.logout()}
          type="button"
        >
          Log out
        </button>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<HomePage />} />
            <Route path="/ai" element={<AnimatedPage><AiTab /></AnimatedPage>} />
            <Route path="/calendar" element={<AnimatedPage className="h-full w-full"><CalendarPage /></AnimatedPage>} />
            <Route path="/docs" element={<AnimatedPage className="h-full w-full"><DocsHomePage /></AnimatedPage>} />
            <Route path="/docs/new" element={<AnimatedPage className="h-full w-full"><DocsNewRedirect /></AnimatedPage>} />
            <Route path="/docs/:docId" element={<AnimatedPage className="h-full w-full"><DocsEditorPage /></AnimatedPage>} />
            <Route path="/workout" element={<AnimatedPage className="h-full w-full"><WorkoutPage /></AnimatedPage>} />
            <Route path="/nutrition" element={<AnimatedPage className="h-full w-full"><NutritionPage /></AnimatedPage>} />
            <Route path="/tasks" element={<RetiredRoutePage />} />
            <Route path="/notes" element={<RetiredRoutePage />} />
            <Route path="*" element={<RetiredRoutePage />} />
          </Routes>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <RequireOwner>
      <Router>
        <AiControllerProvider>
          <WorkoutSessionSummaryProvider>
            <AiAutomationRuntime />
            <AppContent />
          </WorkoutSessionSummaryProvider>
        </AiControllerProvider>
      </Router>
    </RequireOwner>
  );
}
