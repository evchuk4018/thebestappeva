import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  Target, Settings, Megaphone, Apple, 
  HeartPulse, Timer, BarChart2, User, HelpCircle, 
  ScanBarcode, FileText, Activity, Camera, Plus, ChevronRight
} from 'lucide-react';

// Mock Data

const consumedData = [
  { label: 'Protein', value: 66, percent: 22, color: '#34d399' },
  { label: 'Carbs', value: 158, percent: 54, color: '#3b82f6' },
  { label: 'Fat', value: 68, percent: 23, color: '#ef4444' },
];

const expenditureData = [
  { label: 'BMR', value: 1939, percent: 65, color: '#a855f7' },
  { label: 'Adjusted Baseline Activity', value: 961, percent: 32, color: '#2dd4bf' },
  { label: 'Exercise', value: 36, percent: 1, color: '#f97316' },
  { label: 'TEF', value: 29, percent: 1, color: '#6b7280' },
];

function DonutChart({ size = 120, strokeWidth = 10, centerText, subText, data }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;
  
  const total = data.reduce((sum, item) => sum + item.percent, 0);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#27272a" strokeWidth={strokeWidth} />
        {data.map((item, i) => {
          const dasharray = (item.percent / 100) * circumference;
          const offset = currentOffset;
          currentOffset += dasharray;
          
          if (item.percent === 0) return null;
          
          return (
            <circle
              key={i}
              cx={size/2}
              cy={size/2}
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dasharray} ${circumference}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-zinc-50 font-bold text-lg leading-tight">{centerText}</span>
        <span className="text-zinc-500 text-[10px] uppercase font-medium mt-0.5">{subText}</span>
      </div>
    </div>
  );
}

export default function NutritionTracker() {
  const navigate = useNavigate();
  const [isFabOpen, setIsFabOpen] = useState(false);

  return (
    <div className="flex flex-col h-full bg-[#18181b] font-sans overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-4 pb-4 z-10 bg-[#18181b] md:max-w-2xl md:mx-auto w-full border-b border-zinc-800/50">
        <div className="flex items-center gap-2">
          <div className="text-orange-500">
            <Target size={28} strokeWidth={2.5} />
          </div>
          <h1 className="text-xl font-bold text-zinc-50 tracking-wide">NutriTrack</h1>
        </div>
        <div className="flex items-center gap-4 text-zinc-400">
          <Megaphone size={20} />
          <Settings size={20} />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4 md:max-w-2xl md:mx-auto w-full">
        <motion.div
          key="Report"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex flex-col gap-4"
        >
          <div className="flex justify-between items-center px-1 text-sm font-medium text-zinc-500 mb-1">
            <span>Daily Average for Dec 13 - 19, 2025</span>
            <ChevronRight size={16} />
          </div>

          {/* Calories Consumed */}
          <div className="bg-[#212126] rounded-2xl p-5 border border-zinc-800/50">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-zinc-50 font-medium text-[15px]">Calories Consumed (kcals)</h3>
              <ChevronRight size={18} className="text-zinc-500 -rotate-90" />
            </div>
            <div className="flex items-center gap-6">
              <DonutChart size={100} strokeWidth={8} centerText="292" subText="kcal" data={consumedData} />
              <div className="flex-1 text-sm">
                {consumedData.map((item, i) => (
                  <div key={i} className="flex justify-between items-center mb-3 last:mb-0">
                    <span style={{ color: item.color }} className="font-medium text-[13px]">{item.label}</span>
                    <div className="flex items-center justify-end font-medium">
                      <span className="text-zinc-300 w-12 text-right">{item.value}</span>
                      <span className="text-zinc-500 w-10 text-right text-xs">{item.percent}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-2 text-center">
               <span className="text-zinc-50 font-semibold text-[13px]">Consumed</span>
            </div>
          </div>

          {/* Calorie Expenditure */}
          <div className="bg-[#212126] rounded-2xl p-5 border border-zinc-800/50">
             <div className="flex justify-between items-center mb-6">
              <h3 className="text-zinc-50 font-medium text-[15px]">Calorie Expenditure (kcals)</h3>
              <ChevronRight size={18} className="text-zinc-500 -rotate-90" />
            </div>
            <div className="flex items-center gap-6">
              <DonutChart size={100} strokeWidth={8} centerText="2964" subText="kcal" data={expenditureData} />
              <div className="flex-1 text-sm">
                {expenditureData.map((item, i) => (
                  <div key={i} className="flex justify-between items-center mb-3 last:mb-0">
                    <span style={{ color: item.color }} className="font-medium text-[13px] leading-tight w-[80px]">{item.label}</span>
                    <div className="flex items-center justify-end font-medium">
                      <span className="text-zinc-300 w-12 text-right">{item.value}</span>
                      <span className="text-zinc-500 w-10 text-right text-xs">{item.percent}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
             <div className="mt-2 text-center">
               <span className="text-zinc-50 font-semibold text-[13px]">Expenditure</span>
            </div>
          </div>
        </motion.div>
      </main>

      {/* FAB Overlay */}
      <AnimatePresence>
         {isFabOpen && (
            <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="fixed inset-0 z-40 bg-zinc-950/80 backdrop-blur-sm flex flex-col justify-end pb-32 px-4"
               onClick={() => setIsFabOpen(false)}
            >
               {/* Tooltip above FAB */}
               <motion.div 
                 initial={{ y: 20, opacity: 0 }}
                 animate={{ y: 0, opacity: 1 }}
                 className="absolute bottom-28 left-1/2 -translate-x-1/2 bg-teal-600/90 text-white text-[11px] font-medium px-4 py-2 rounded-lg whitespace-nowrap mb-4 border border-teal-500/50"
               >
                 Long press on an icon<br/>to edit your menu.
                 <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-teal-600/90 rotate-45 border-r border-b border-teal-500/50"></div>
               </motion.div>

               <motion.div 
                 initial={{ y: 50, opacity: 0, scale: 0.95 }}
                 animate={{ y: 0, opacity: 1, scale: 1 }}
                 exit={{ y: 50, opacity: 0, scale: 0.95 }}
                 onClick={(e) => e.stopPropagation()}
                 className="grid grid-cols-3 gap-y-6 gap-x-2 pt-6 pb-6 bg-[#212126] rounded-3xl border border-zinc-800 shadow-2xl relative z-50 mb-4 max-w-sm mx-auto w-full"
               >
                  {[
                     { label: 'Suggest Food', icon: HelpCircle, color: 'text-amber-400', bg: 'bg-amber-400/20' },
                     { label: 'Add Food', icon: Apple, color: 'text-red-400', bg: 'bg-red-400/20' },
                     { label: 'Scan Food', icon: ScanBarcode, color: 'text-zinc-50', bg: 'bg-zinc-700' },
                     { label: 'Add Biometric', icon: HeartPulse, color: 'text-pink-400', bg: 'bg-pink-400/20' },
                     { label: 'Add Note', icon: FileText, color: 'text-yellow-400', bg: 'bg-yellow-400/20' },
                     { label: 'New Fast', icon: Timer, color: 'text-teal-400', bg: 'bg-teal-400/20' },
                     { label: 'Add Exercise', icon: Activity, color: 'text-teal-500', bg: 'bg-teal-500/20' },
                     { label: 'Photo Log', icon: Camera, color: 'text-teal-300', bg: 'bg-teal-300/20' },
                  ].map((btn, i) => (
                     <div key={i} className="flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-zinc-800/50 py-2 rounded-xl transition-colors">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${btn.bg} shadow-inner bg-opacity-80`}>
                           <btn.icon size={22} className={btn.color} strokeWidth={2} />
                        </div>
                        <span className="text-[11px] font-medium text-zinc-300 tracking-wide text-center leading-tight w-20">{btn.label}</span>
                     </div>
                  ))}
               </motion.div>
            </motion.div>
         )}
      </AnimatePresence>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#18181b] border-t border-zinc-800 pb-[env(safe-area-inset-bottom)] md:max-w-2xl md:mx-auto md:border-x">
        <div className="grid grid-cols-3 items-center h-16 relative px-2">
          
          <button className="flex flex-col items-center justify-center gap-1 text-orange-500 group">
            <BarChart2 size={22} strokeWidth={2.5}/>
            <span className="text-[10px] font-semibold tracking-wider">Nutrition</span>
          </button>

          <div className="flex justify-center relative w-full h-full">
            <div className="absolute bottom-3">
               <button 
                 onClick={() => setIsFabOpen(!isFabOpen)}
                 className={`w-14 h-14 bg-orange-600 rounded-full flex items-center justify-center shadow-lg shadow-orange-900/50 hover:bg-orange-500 transition-transform duration-300 ${isFabOpen ? 'rotate-45' : ''}`}
               >
                  <Plus size={32} className="text-white" strokeWidth={2.5} />
               </button>
            </div>
          </div>

          <button 
             onClick={() => navigate('/')}
             className="flex flex-col items-center justify-center gap-1 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <div className="w-6 h-6 rounded-full border border-zinc-500 flex items-center justify-center bg-zinc-800">
               <User size={14} />
            </div>
            <span className="text-[10px] font-semibold tracking-wider">Profile</span>
          </button>
          
        </div>
      </nav>

    </div>
  );
}
