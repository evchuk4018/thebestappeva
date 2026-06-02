import { Dumbbell, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const isWorkout = location.pathname === '/workout';

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-zinc-900 pb-[env(safe-area-inset-bottom)] z-40 bg-zinc-950/90 backdrop-blur-md">
      <div className="flex justify-around items-center h-16 px-2 max-w-5xl mx-auto">
        <button 
          onClick={() => navigate('/workout')}
          className={`flex-1 flex flex-col items-center justify-center gap-1.5 h-full transition-colors ${isWorkout ? 'text-blue-500' : 'text-zinc-500 hover:text-zinc-400'}`}
        >
          <Dumbbell size={24} strokeWidth={isWorkout ? 2.5 : 2} />
          <span className="text-[10px] font-semibold tracking-wide">Workout</span>
        </button>

        <button 
          id="nav-profile-button"
          onClick={() => navigate('/')}
          className="flex-1 flex flex-col items-center justify-center gap-1.5 h-full transition-colors text-zinc-500 hover:text-zinc-400"
        >
          <div className="w-7 h-7 rounded-full flex items-center justify-center border-2 border-zinc-500 bg-zinc-800">
            <User size={16} strokeWidth={2.5} className="text-zinc-400" />
          </div>
          <span className="text-[10px] font-semibold tracking-wide">Profile</span>
        </button>
      </div>
    </nav>
  );
}
