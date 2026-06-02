import { MoreVertical, Check, Plus, Image as ImageIcon, Clock } from 'lucide-react';
import { Exercise } from '../types';

interface Props {
  exercise: Exercise;
  onToggleSet: (id: string) => void;
  index: number;
}

export default function ExerciseCard({ exercise, onToggleSet, index }: Props) {
  return (
    <div className="md:mt-4 bg-zinc-950 md:bg-zinc-900/50 border-t md:border border-zinc-800 md:rounded-2xl pb-4 overflow-hidden shadow-sm">
       {/* Exercise Header */}
       <div className="flex items-center justify-between p-4 px-4 md:px-6">
         <div className="flex items-center gap-3 text-blue-500 font-semibold cursor-pointer hover:text-blue-400 transition-colors">
           <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 shrink-0">
             <ImageIcon size={18} />
           </div>
           <h2 className="text-[17px]">{exercise.name}</h2>
         </div>
         <button className="text-zinc-500 hover:text-zinc-300 p-2 -mr-2 transition-colors rounded-full active:bg-zinc-800">
           <MoreVertical size={20} />
         </button>
       </div>

       {/* Notes */}
       <div className="px-4 md:px-6 mb-4">
         <input 
           type="text" 
           placeholder="Add notes here..." 
           className="w-full bg-transparent border-none text-sm text-zinc-400 placeholder-zinc-600 focus:outline-none focus:ring-0"
           defaultValue={exercise.notes}
         />
       </div>

       {/* Rest Timer Hint */}
       <div className="px-4 md:px-6 mb-3 flex items-center gap-1.5 text-xs text-blue-500 font-bold">
         <Clock size={14} strokeWidth={2.5} /> Rest Timer: 2min 0s
       </div>

       {/* Sets header */}
       <div className="grid grid-cols-[3rem_minmax(4rem,1fr)_4.5rem_4.5rem_3.5rem] gap-2 px-4 md:px-6 mb-2 text-[10px] font-bold text-zinc-500 tracking-wider">
         <div className="text-center">SET</div>
         <div className="text-center">PREVIOUS</div>
         <div className="text-center">KG</div>
         <div className="text-center">REPS</div>
         <div className="text-center flex justify-center"><Check size={14} /></div>
       </div>

       {/* Sets rows */}
       <div className="space-y-0.5">
         {exercise.sets.map((set, setIdx) => {
           const isComplete = set.completed;
           let setLabel: React.ReactNode = setIdx + 1;
           let labelColor = "text-zinc-400 font-semibold text-sm";
           if (set.type === 'W') { setLabel = 'W'; labelColor = "text-yellow-500 font-semibold text-sm"; }
           
           return (
             <div 
               key={set.id}
               className={`grid grid-cols-[3rem_minmax(4rem,1fr)_4.5rem_4.5rem_3.5rem] items-center gap-2 px-2 md:px-4 py-2 transition-colors ${
                 isComplete ? 'bg-emerald-500/10' : 'hover:bg-zinc-800/30'
               }`}
             >
               <div className={`text-center ${isComplete ? 'text-zinc-50 font-bold text-sm' : labelColor}`}>
                 {setLabel}
               </div>

               <div className="text-zinc-500 text-sm text-center truncate font-medium">
                 {set.previous}
               </div>

               <div className="text-center bg-transparent">
                 <input 
                   type="text" 
                   defaultValue={set.kg.toString()} 
                   className={`w-[4.5rem] bg-zinc-900 md:bg-zinc-800/80 text-center font-bold text-[15px] rounded-lg py-1.5 focus:outline-none focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 transition-colors ${
                     isComplete ? 'text-zinc-50 bg-transparent! ring-0' : 'text-zinc-200'
                   }`}
                 />
               </div>

               <div className="text-center bg-transparent">
                 <input 
                   type="text" 
                   defaultValue={set.reps.toString()} 
                   className={`w-[4.5rem] bg-zinc-900 md:bg-zinc-800/80 text-center font-bold text-[15px] rounded-lg py-1.5 focus:outline-none focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500 transition-colors ${
                     isComplete ? 'text-zinc-50 bg-transparent! ring-0' : 'text-zinc-200'
                   }`}
                 />
               </div>

               <div className="flex justify-center shrink-0">
                 <button 
                   onClick={() => onToggleSet(set.id)}
                   className={`w-7 h-7 md:w-8 md:h-8 rounded-[10px] flex items-center justify-center transition-all ${
                     isComplete 
                       ? 'bg-emerald-500 text-emerald-950 scale-105 shadow-sm shadow-emerald-500/20' 
                       : 'bg-zinc-800/50 text-transparent border-2 border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800'
                   }`}
                 >
                   <Check size={16} strokeWidth={isComplete ? 4 : 3} />
                 </button>
               </div>
             </div>
           )
         })}
       </div>

       {/* Add Set Button */}
       <div className="px-4 md:px-6 pt-4">
         <button className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-zinc-800/30 border border-zinc-800 hover:bg-zinc-800/80 transition-colors text-zinc-400">
           <Plus size={16} /> Add Set
         </button>
       </div>
    </div>
  )
}
