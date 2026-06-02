import { useNavigate } from 'react-router-dom';
import { Dumbbell, Apple, Sparkles, ListTodo } from 'lucide-react';
import { motion } from 'motion/react';

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 items-center justify-center h-full w-full bg-zinc-950 p-6 gap-6 select-none overflow-y-auto place-items-center">
      <motion.button
        id="btn-workout-start"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        onClick={() => navigate('/workout')}
        className="bg-red-600 hover:bg-red-500 text-white font-black text-2xl md:text-3xl py-12 px-10 rounded-3xl uppercase tracking-[0.2em] shadow-2xl shadow-red-950/60 hover:shadow-red-500/20 flex flex-col items-center justify-center gap-4 border border-red-500/30 cursor-pointer max-w-xs w-full transition-shadow duration-300"
      >
        <Dumbbell size={44} strokeWidth={3} className="text-white text-opacity-95" />
        <span>Workout</span>
      </motion.button>

      <motion.button
        id="btn-nutrition-start"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
        onClick={() => navigate('/nutrition')}
        className="bg-red-600 hover:bg-red-500 text-white font-black text-2xl md:text-3xl py-12 px-10 rounded-3xl uppercase tracking-[0.2em] shadow-2xl shadow-red-950/60 hover:shadow-red-500/20 flex flex-col items-center justify-center gap-4 border border-red-500/30 cursor-pointer max-w-xs w-full transition-shadow duration-300"
      >
        <Apple size={44} strokeWidth={3} className="text-white text-opacity-95" />
        <span>Nutrition</span>
      </motion.button>

      <motion.button
        id="btn-ai-start"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.2 }}
        onClick={() => navigate('/ai')}
        className="bg-red-600 hover:bg-red-500 text-white font-black text-2xl md:text-3xl py-12 px-10 rounded-3xl uppercase tracking-[0.2em] shadow-2xl shadow-red-950/60 hover:shadow-red-500/20 flex flex-col items-center justify-center gap-4 border border-red-500/30 cursor-pointer max-w-xs w-full transition-shadow duration-300"
      >
        <Sparkles size={44} strokeWidth={3} className="text-white text-opacity-95" />
        <span>AI Coach</span>
      </motion.button>

      <motion.button
        id="btn-tasks-start"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.3 }}
        onClick={() => navigate('/tasks')}
        className="bg-red-600 hover:bg-red-500 text-white font-black text-2xl md:text-3xl py-12 px-10 rounded-3xl uppercase tracking-[0.2em] shadow-2xl shadow-red-950/60 hover:shadow-red-500/20 flex flex-col items-center justify-center gap-4 border border-red-500/30 cursor-pointer max-w-xs w-full transition-shadow duration-300"
      >
        <ListTodo size={44} strokeWidth={3} className="text-white text-opacity-95" />
        <span>Tasks</span>
      </motion.button>
    </div>
  );
}

