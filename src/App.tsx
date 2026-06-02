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

function AppContent() {
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkoutState | null>(null);
  const location = useLocation();

  return (
    <div className="flex bg-zinc-950 text-zinc-50 h-[100dvh] overflow-hidden selection:bg-blue-500/30 font-sans">
      <main className="flex-1 relative flex flex-col h-full overflow-hidden w-full max-w-5xl mx-auto md:border-x md:border-zinc-900">
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
                      className="w-full h-full"
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
      <AppContent />
    </Router>
  );
}
