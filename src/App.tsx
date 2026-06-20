/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ActiveWorkoutState } from './types';
import WorkoutDashboard from './components/WorkoutDashboard';
import ActiveWorkout from './components/ActiveWorkout';
import { BottomNav } from './components/BottomNav';
import HomePage from './components/HomePage';
import NutritionTracker from './components/NutritionTracker';
import AiTab from './components/AiTab';
import TaskManager from './components/TaskManager';
import NotesPage from './components/NotesPage';
import DocsHomePage from './components/docs/DocsHomePage';
import DocsEditorPage from './components/docs/DocsEditorPage';
import DocsNewRedirect from './components/docs/DocsNewRedirect';
import { AiAutomationRuntime } from './components/ai-tab/AiAutomationRuntime';
import { AiControllerProvider } from './components/ai-tab/AiControllerContext';

function AppContent() {
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkoutState | null>(null);
  const location = useLocation();
  const isDocsRoute = location.pathname.startsWith('/docs');
  const usesFullBleedLayout = isDocsRoute || location.pathname === '/ai';

  return (
    <div className="flex bg-zinc-950 text-zinc-50 h-[100dvh] overflow-hidden selection:bg-blue-500/30 font-sans">
      <main className={`relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden ${usesFullBleedLayout ? '' : 'mx-auto max-w-5xl md:border-x md:border-zinc-900'}`}>
         <AnimatePresence mode="wait">
            {activeWorkout ? (
               <ActiveWorkout 
                  key="active-workout"
                  workout={activeWorkout} 
                  onFinish={() => setActiveWorkout(null)} 
               />
            ) : (
              <Routes location={location} key={location.pathname}>
                <Route path="/" element={<HomePage />} />
                <Route 
                  path="/workout" 
                  element={
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      className="w-full h-full overflow-y-auto pb-24"
                    >
                      <WorkoutDashboard onStartWorkout={setActiveWorkout} />
                    </motion.div>
                  } 
                />
                <Route 
                  path="/nutrition" 
                  element={
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      className="w-full h-full"
                    >
                      <NutritionTracker />
                    </motion.div>
                  } 
                />
                <Route 
                  path="/ai" 
                  element={
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      className="h-full min-h-0 w-full"
                    >
                      <AiTab />
                    </motion.div>
                  } 
                />
                <Route
                  path="/tasks"
                  element={
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      className="w-full h-full"
                    >
                      <TaskManager />
                    </motion.div>
                  }
                />
                <Route
                  path="/notes"
                  element={
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      className="w-full h-full"
                    >
                      <NotesPage />
                    </motion.div>
                  }
                />
                <Route
                  path="/docs"
                  element={
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      className="w-full h-full"
                    >
                      <DocsHomePage />
                    </motion.div>
                  }
                />
                <Route
                  path="/docs/new"
                  element={
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      className="w-full h-full"
                    >
                      <DocsNewRedirect />
                    </motion.div>
                  }
                />
                <Route
                  path="/docs/:docId"
                  element={
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      className="w-full h-full"
                    >
                      <DocsEditorPage />
                    </motion.div>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            )}
         </AnimatePresence>
      </main>
      {!activeWorkout && location.pathname === '/workout' && <BottomNav />}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AiControllerProvider>
        <AiAutomationRuntime />
        <AppContent />
      </AiControllerProvider>
    </Router>
  );
}
