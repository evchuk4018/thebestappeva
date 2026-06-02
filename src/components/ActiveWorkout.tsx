import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Clock } from 'lucide-react';
import { ActiveWorkoutState } from '../types';
import ExerciseCard from './ExerciseCard';

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}h ${m}m ${s}s`;
  }
  return `${m}min ${s}s`;
}

interface Props {
  workout: ActiveWorkoutState;
  onFinish: () => void;
}

export default function ActiveWorkout({ workout, onFinish }: Props) {
  const [duration, setDuration] = useState(0);
  const [exercises, setExercises] = useState(workout.exercises);
  const [restTimer, setRestTimer] = useState<number | null>(null); // seconds
  
  // Timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - workout.startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [workout.startTime]);

  // Rest timer tick down
  useEffect(() => {
    if (restTimer !== null && restTimer > 0) {
      const interval = setInterval(() => {
         setRestTimer(v => (v !== null && v > 0 ? v - 1 : null));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [restTimer]);

  const toggleSetComplete = (exerciseId: string, setId: string) => {
    let newlyCompleted = false;
    setExercises(prev => prev.map(ex => {
      if (ex.id !== exerciseId) return ex;
      return {
        ...ex,
        sets: ex.sets.map(s => {
          if (s.id !== setId) return s;
          if (!s.completed) newlyCompleted = true;
          return { ...s, completed: !s.completed };
        })
      };
    }));
    
    // trigger rest timer if marked complete
    if (newlyCompleted) {
      setRestTimer(122); // 2 min 2s visual
    }
  };

  const volume = exercises.reduce((acc, ex) => {
    return acc + ex.sets.reduce((setAcc, set) => {
      if (set.completed && set.kg && set.reps) {
        return setAcc + (Number(set.kg) * Number(set.reps));
      }
      return setAcc;
    }, 0);
  }, 0);

  const completedSetsCount = exercises.reduce((acc, ex) => {
    return acc + ex.sets.filter(s => s.completed).length;
  }, 0);

  return (
    <motion.div 
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%', opacity: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 220 }}
      className="absolute inset-0 bg-zinc-950 z-50 flex flex-col shadow-2xl"
    >
      {/* Header */}
      <header className="sticky top-0 bg-zinc-950/90 backdrop-blur-xl z-20 border-b border-zinc-800">
         <div className="flex justify-between items-center px-4 py-3 max-w-4xl mx-auto w-full">
           <div className="flex items-center gap-3">
             <button onClick={onFinish} className="p-2 -ml-2 text-zinc-400 hover:text-zinc-200 transition-colors active:scale-95">
                <ChevronDown size={26} strokeWidth={2.5}/>
             </button>
             <h1 className="font-bold text-lg">{workout.name}</h1>
           </div>
           <div className="flex items-center gap-4">
             <button className="text-zinc-400 hover:text-zinc-200 transition-colors">
               <Clock size={22} strokeWidth={2.5} />
             </button>
             <button onClick={onFinish} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-1.5 px-5 rounded-lg text-sm transition-colors shadow-sm shadow-blue-500/20 active:scale-95">
               Finish
             </button>
           </div>
         </div>
         {/* Stats bar */}
         <div className="flex px-6 md:px-8 py-3 text-sm border-t border-zinc-800/80 text-center items-center justify-between max-w-4xl mx-auto w-full">
           <div className="flex flex-col items-start md:items-center">
             <span className="text-zinc-500 text-[11px] font-semibold tracking-wider mb-0.5">Duration</span>
             <span className="text-blue-500 font-bold font-mono tracking-tight text-[15px]">{formatDuration(duration)}</span>
           </div>
           <div className="flex flex-col items-center">
             <span className="text-zinc-500 text-[11px] font-semibold tracking-wider mb-0.5">Volume</span>
             <span className="font-bold text-zinc-200 text-[15px]">{volume.toLocaleString()} kg</span>
           </div>
           <div className="flex flex-col items-end md:items-center">
             <span className="text-zinc-500 text-[11px] font-semibold tracking-wider mb-0.5">Sets</span>
             <span className="font-bold text-zinc-200 text-[15px]">{completedSetsCount}</span>
           </div>
         </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto p-0 md:px-4 pb-[200px]">
         {exercises.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-48 text-zinc-500 space-y-4">
             <p className="font-medium text-sm">Add exercises to start your workout.</p>
             <button className="bg-blue-600/10 text-blue-500 font-bold py-2 px-6 rounded-xl border border-blue-500/20">
               Add Exercise
             </button>
           </div>
         ) : (
           <div className="space-y-2 md:space-y-4">
             {exercises.map((ex, idx) => (
               <ExerciseCard key={ex.id} exercise={ex} onToggleSet={(setId) => toggleSetComplete(ex.id, setId)} index={idx} />
             ))}
           </div>
         )}
      </div>

      {/* Floating Rest Timer */}
      <AnimatePresence>
        {restTimer !== null && restTimer > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-[calc(env(safe-area-inset-bottom)+24px)] md:bottom-8 left-1/2 -translate-x-1/2 bg-blue-600 text-white shadow-xl shadow-blue-900/50 rounded-[20px] px-5 py-3 flex items-center justify-center gap-5 z-50 font-semibold text-sm ring-1 ring-blue-500/50"
          >
            <button onClick={() => setRestTimer(v => Math.max(0, (v || 0) - 15))} className="text-blue-200 hover:text-white transition-colors active:scale-90">-15</button>
            <div className="font-mono text-[17px] font-bold min-w-[3.5rem] text-center tracking-tight leading-none">
               {Math.floor(restTimer / 60).toString().padStart(2, '0')}:{(restTimer % 60).toString().padStart(2, '0')}
            </div>
            <button onClick={() => setRestTimer(v => (v || 0) + 15)} className="text-blue-200 hover:text-white transition-colors active:scale-90">+15</button>
            <div className="w-px h-5 bg-blue-400/50"></div>
            <button onClick={() => setRestTimer(null)} className="hover:text-blue-100 transition-colors uppercase tracking-wider text-[11px] font-bold">Skip</button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
