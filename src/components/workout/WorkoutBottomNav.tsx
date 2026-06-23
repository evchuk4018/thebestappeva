import { Dumbbell, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function WorkoutBottomNav({ onWorkout }: { onWorkout: () => void }) {
  const navigate = useNavigate();
  const itemClass = 'flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition';

  return (
    <nav className="sticky bottom-0 z-20 border-t border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-md gap-3 rounded-[28px] border border-zinc-800 bg-zinc-900 p-2 shadow-2xl shadow-black/40">
        <button onClick={() => navigate('/')} className={`${itemClass} text-zinc-300 hover:bg-zinc-800 hover:text-white`}>
          <Home size={19} /> Home
        </button>
        <button onClick={onWorkout} className={`${itemClass} bg-blue-600 text-white shadow-lg shadow-blue-950/40 hover:bg-blue-500`}>
          <Dumbbell size={19} /> Workout
        </button>
      </div>
    </nav>
  );
}
