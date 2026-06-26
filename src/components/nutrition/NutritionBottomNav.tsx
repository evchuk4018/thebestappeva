import { BarChart3, Home } from 'lucide-react';

export function NutritionBottomNav({
  active,
  onDashboard,
  onHome,
}: {
  active: 'dashboard' | 'recipes';
  onDashboard: () => void;
  onHome: () => void;
}) {
  const itemClass = 'flex flex-1 flex-col items-center justify-center gap-1 rounded-md px-3 py-2 text-xs transition';

  return (
    <nav className="sticky bottom-0 z-20 border-t border-[#2a2a2a] bg-[#202123] px-3 pb-3 pt-2">
      <div className="mx-auto flex max-w-[390px] items-center gap-2">
        <button onClick={onDashboard} className={`${itemClass} ${active === 'dashboard' ? 'text-white' : 'text-zinc-500 hover:text-zinc-200'}`}>
          <span className={`rounded-md p-1 ${active === 'dashboard' ? 'bg-zinc-600' : ''}`}><BarChart3 size={20} /></span>
          Dashboard
        </button>
        <button onClick={onHome} className={`${itemClass} text-zinc-500 hover:text-zinc-200`}>
          <span className="rounded-md p-1"><Home size={20} /></span>
          Home
        </button>
      </div>
    </nav>
  );
}
