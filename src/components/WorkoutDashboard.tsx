import { Plus, Search, Folder, MoreHorizontal, ChevronDown } from 'lucide-react';
import { mockRoutines, createWorkoutFromRoutine, createEmptyWorkout } from '../data';
import { ActiveWorkoutState } from '../types';

interface Props {
  onStartWorkout: (w: ActiveWorkoutState) => void;
}

export default function WorkoutDashboard({ onStartWorkout }: Props) {
  return (
    <div className="p-4 md:p-8 space-y-8 select-none">
       {/* Header */}
       <header className="flex justify-center md:justify-start items-center">
         <h1 className="text-lg md:text-2xl font-bold">Workout</h1>
       </header>

       {/* Quick Start */}
       <section>
         <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Quick Start</h2>
         <button 
           onClick={() => onStartWorkout(createEmptyWorkout())}
           className="w-full flex items-center justify-center gap-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 transition-colors py-3.5 rounded-xl font-semibold text-zinc-300 shadow-sm"
         >
           <Plus size={20} />
           Start Empty Workout
         </button>
       </section>

       {/* Routines */}
       <section>
         <div className="flex justify-between items-center mb-3">
           <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
             Routines
           </h2>
           <button className="text-zinc-500 hover:text-zinc-300 p-1">
             <Folder size={18} />
           </button>
         </div>
         <div className="flex gap-3 mb-6">
           <button className="flex-1 flex items-center justify-center gap-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 py-2.5 rounded-xl text-sm font-semibold transition-colors text-zinc-300 shadow-sm">
              <Plus size={16} strokeWidth={2.5} /> New Routine
           </button>
           <button className="flex-1 flex items-center justify-center gap-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 py-2.5 rounded-xl text-sm font-semibold transition-colors text-zinc-300 shadow-sm">
              <Search size={16} strokeWidth={2.5} /> Explore
           </button>
         </div>

         {/* Routine List */}
         <div className="space-y-4">
           <div className="flex items-center gap-1.5 text-zinc-400 text-sm font-semibold">
              <ChevronDown size={16} /> My Routines ({mockRoutines.length})
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {mockRoutines.map(r => (
               <div key={r.id} className="bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-2xl p-5 flex flex-col hover:border-zinc-700 transition-colors shadow-sm">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-semibold text-zinc-100 text-[17px]">{r.name}</h3>
                    <button className="p-1 -mt-1 -mr-2 text-zinc-500 hover:text-zinc-300">
                      <MoreHorizontal size={20} />
                    </button>
                  </div>
                  <p className="text-sm text-zinc-500 flex-1 mb-6 line-clamp-2 leading-relaxed">
                    {r.exercises.join(', ')}
                  </p>
                  <button 
                    onClick={() => onStartWorkout(createWorkoutFromRoutine(r))}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-xl transition-all shrink-0 shadow-sm shadow-blue-900/20 active:scale-[0.98]"
                  >
                    Start Routine
                  </button>
               </div>
             ))}
           </div>
         </div>
       </section>
    </div>
  )
}
