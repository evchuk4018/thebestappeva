import { Dumbbell } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import type { WorkoutSession } from '../../../shared/workout-contract';

export function WorkoutResumeBar({ session }: { session: WorkoutSession }) {
  const navigate = useNavigate();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="pointer-events-auto flex w-full max-w-3xl items-center gap-3 rounded-[28px] border border-blue-400/25 bg-zinc-950/95 px-4 py-3 text-white shadow-2xl shadow-blue-950/30 backdrop-blur"
      >
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-600 text-white">
          <Dumbbell size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-300">Active workout</p>
          <p className="truncate text-sm font-semibold text-white">{session.name}</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/workout', { state: { openSession: true } })}
          className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400/70"
        >
          Resume
        </motion.button>
      </motion.div>
    </div>
  );
}
